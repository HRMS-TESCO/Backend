// routes/announcementRoutes.js — Announcement CRUD (open pattern, matches departmentRoutes)
//
// In addition to the local HRMS MongoDB write, every create/update/delete is
// MIRRORED to the Tesco ERM mobile backend so the announcement also appears
// in every employee's mobile app Announcements section. Dual-write is
// fire-and-forget — if the mobile backend is down or slow, the local HRMS
// save still succeeds and the user gets a normal success response.
const express      = require('express');
const router       = express.Router();
const mongoose     = require('mongoose');
const Announcement = require('../models/Announcement');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// ─── Mirror to mobile backend ───────────────────────────────────────────
const MOBILE_API   = (process.env.MOBILE_API_URL    || 'https://backend-emqy.onrender.com').replace(/\/+$/, '');
const ADMIN_SECRET =  process.env.MOBILE_ADMIN_SECRET || '';

function mobileReady() {
  return !!ADMIN_SECRET && typeof fetch === 'function';
}

/**
 * Fire-and-forget call to the mobile backend. Logs failures but never
 * throws. We deliberately don't `await` callers in the hot path because
 * the local HRMS write is the source of truth from the user's perspective.
 */
async function mirrorToMobile(method, path, body) {
  if (!mobileReady()) return;
  try {
    const res = await fetch(MOBILE_API + path, {
      method,
      headers: {
        'Content-Type':   'application/json',
        'x-admin-secret': ADMIN_SECRET,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      console.warn(`[announcement mirror] ${method} ${path} -> ${res.status} ${t.slice(0, 200)}`);
    } else {
      console.log(`[announcement mirror] ✓ ${method} ${path}`);
    }
  } catch (err) {
    console.warn(`[announcement mirror] ${method} ${path} failed: ${err.message}`);
  }
}

// GET /api/announcements — list all active announcements (newest + pinned first)
router.get('/', async (req, res) => {
  try {
    const {
      status,
      category,
      priority,
      pinned,
      search,
      page = 1,
      limit = 50,
    } = req.query;

    const filter = { isActive: true };
    if (status)   filter.status   = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;
    if (pinned === 'true')  filter.isPinned = true;
    if (pinned === 'false') filter.isPinned = false;

    if (search && search.trim()) {
      const rx = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ title: rx }, { description: rx }];
    }

    const pageNum  = Math.max(parseInt(page, 10)  || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const skip     = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      Announcement.find(filter)
        .sort({ isPinned: -1, publishDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean({ virtuals: true }),
      Announcement.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err) {
    console.error('[ANNOUNCEMENT] List error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/announcements/stats — counters
router.get('/stats', async (req, res) => {
  try {
    const filter = { isActive: true };
    const [total, published, draft, archived, pinned, urgent, byCategoryRaw] = await Promise.all([
      Announcement.countDocuments(filter),
      Announcement.countDocuments({ ...filter, status: 'Published' }),
      Announcement.countDocuments({ ...filter, status: 'Draft' }),
      Announcement.countDocuments({ ...filter, status: 'Archived' }),
      Announcement.countDocuments({ ...filter, isPinned: true }),
      Announcement.countDocuments({ ...filter, priority: 'Urgent' }),
      Announcement.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    res.status(200).json({
      success: true,
      stats: {
        total, published, draft, archived, pinned, urgent,
        byCategory: byCategoryRaw.map((c) => ({ category: c._id || 'Uncategorised', count: c.count })),
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[ANNOUNCEMENT] Stats error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/announcements/:id — single announcement (increments view count)
router.get('/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid announcement id' });
    }
    const announcement = await Announcement.findOneAndUpdate(
      { _id: req.params.id, isActive: true },
      { $inc: { views: 1 } },
      { new: true }
    ).lean({ virtuals: true });

    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }
    res.status(200).json({ success: true, data: announcement });
  } catch (err) {
    console.error('[ANNOUNCEMENT] Get error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/announcements — create
// Accepts both { title, content, ... } (frontend) and { title, description, ... } (canonical)
router.post('/', async (req, res) => {
  try {
    const {
      title,
      content,                       // alias for description from frontend
      description,
      category,
      priority,
      status,
      audience,
      departments,
      roles,
      publishDate,
      expiryDate,
      isPinned,
      attachments,
      author,                        // frontend sends 'author' string
      createdByName,
      createdByRole,
    } = req.body;

    const finalDescription = (description ?? content ?? '').toString().trim();

    if (!title || !title.toString().trim()) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }
    if (!finalDescription) {
      return res.status(400).json({ success: false, message: 'Description / content is required' });
    }
    if (expiryDate && publishDate && new Date(expiryDate) <= new Date(publishDate)) {
      return res.status(400).json({ success: false, message: 'Expiry date must be after publish date' });
    }

    // UNIFIED DB — the `announcements` collection is shared with the mobile
    // backend. Mobile reads `body` while HRMS reads `description`. We store
    // BOTH so both apps render correctly without any extra translation. The
    // mobile Announcement model uses `strict: false`-compatible fields, so
    // the extra HRMS-only fields (priority, status, etc.) are silently
    // round-tripped without breaking the mobile UI.
    const announcement = await Announcement.create({
      title:       title.toString().trim(),
      description: finalDescription,
      body:        finalDescription,            // mirror for mobile reader
      category:    category || 'General',
      priority:    priority || 'Normal',
      status:      status   || 'Published',
      audience:    audience || 'All',
      departments: Array.isArray(departments) ? departments : [],
      roles:       Array.isArray(roles)       ? roles       : [],
      publishDate: publishDate || new Date(),
      expiryDate:  expiryDate  || null,
      isPinned:    !!isPinned,
      attachments: Array.isArray(attachments) ? attachments : [],
      createdByName: (createdByName || author || '').toString().trim(),
      createdByRole: (createdByRole || '').toString().trim(),
      postedBy:    (createdByName || author || 'HR').toString().trim(),
      isActive:    true,
    });

    // Mirror to the mobile backend so every employee's mobile app
    // Announcements list also receives this. Only push if the status is
    // a publishable one (Drafts and Archived shouldn't appear in the app).
    if ((announcement.status || 'Published').toLowerCase() === 'published') {
      mirrorToMobile('POST', '/api/announcement/admin', {
        externalId: String(announcement._id),
        title:      announcement.title,
        body:       announcement.description,
        category:   announcement.category,
        postedBy:   announcement.createdByName || 'HR',
        audience:   announcement.audience,
      });
    }

    res.status(201).json({
      success: true,
      data: announcement,
      message: 'Announcement created successfully',
    });
  } catch (err) {
    console.error('[ANNOUNCEMENT] Create error:', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/announcements/:id — update
router.put('/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid announcement id' });
    }

    const allowed = [
      'title', 'description', 'category', 'priority', 'status',
      'audience', 'departments', 'roles',
      'publishDate', 'expiryDate', 'isPinned', 'attachments',
    ];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    // Accept 'content' as alias for description
    if (req.body.content !== undefined && update.description === undefined) {
      update.description = req.body.content;
    }
    if (typeof update.title       === 'string') update.title       = update.title.trim();
    if (typeof update.description === 'string') update.description = update.description.trim();

    const announcement = await Announcement.findOneAndUpdate(
      { _id: req.params.id, isActive: true },
      update,
      { new: true, runValidators: true }
    );

    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    // Mirror the update to the mobile backend by externalId. We always
    // attempt this — if the mobile copy doesn't exist yet (e.g. announcement
    // was created before the mirror was wired) the mirror call just 404s,
    // which we swallow. To self-heal, we could fall back to POST upsert here.
    mirrorToMobile('PATCH', `/api/announcement/admin/by-external/${announcement._id}`, {
      title:    announcement.title,
      body:     announcement.description,
      category: announcement.category,
      postedBy: announcement.createdByName || 'HR',
      audience: announcement.audience,
    });

    res.status(200).json({
      success: true,
      data: announcement,
      message: 'Announcement updated successfully',
    });
  } catch (err) {
    console.error('[ANNOUNCEMENT] Update error:', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/announcements/:id/pin — toggle pinned state
router.patch('/:id/pin', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid announcement id' });
    }
    const current = await Announcement.findOne({ _id: req.params.id, isActive: true });
    if (!current) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }
    current.isPinned = typeof req.body.isPinned === 'boolean' ? req.body.isPinned : !current.isPinned;
    await current.save();
    res.status(200).json({
      success: true,
      data: current,
      message: current.isPinned ? 'Announcement pinned' : 'Announcement unpinned',
    });
  } catch (err) {
    console.error('[ANNOUNCEMENT] Pin error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/announcements/:id/status — change status (Draft / Published / Archived)
router.patch('/:id/status', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid announcement id' });
    }
    const { status } = req.body;
    if (!['Draft', 'Published', 'Archived'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }
    const announcement = await Announcement.findOneAndUpdate(
      { _id: req.params.id, isActive: true },
      { status },
      { new: true }
    );
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }
    res.status(200).json({
      success: true,
      data: announcement,
      message: `Status updated to ${status}`,
    });
  } catch (err) {
    console.error('[ANNOUNCEMENT] Status error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/announcements/:id — soft delete
router.delete('/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid announcement id' });
    }
    const announcement = await Announcement.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    // Mirror the soft-delete to the mobile backend so the announcement
    // disappears from every employee's app at the same time.
    mirrorToMobile('DELETE', `/api/announcement/admin/by-external/${announcement._id}`);

    res.status(200).json({
      success: true,
      message: `Announcement "${announcement.title}" deleted successfully`,
    });
  } catch (err) {
    console.error('[ANNOUNCEMENT] Delete error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
