const express = require('express');
const asyncHandler = require('express-async-handler');

const Announcement = require('../models/Announcement');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const validateRequest = require('../middleware/validateRequest');
const {
  createAnnouncementRules,
  updateAnnouncementRules,
} = require('../validators/announcementValidator');

const router = express.Router();

// All announcement routes require a logged-in user
router.use(protect);

/**
 * @desc    Get all announcements (filters + pagination)
 * @route   GET /api/announcements
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const filter = { isPublished: true };
    filter.$or = [{ audience: 'All' }, { audience: req.user.role }];
    filter.$and = [
      { $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] },
    ];

    if (req.query.category) filter.category = req.query.category;
    if (req.query.priority) filter.priority = req.query.priority;
    if (req.query.search) {
      filter.$and.push({
        $or: [
          { title: { $regex: req.query.search, $options: 'i' } },
          { content: { $regex: req.query.search, $options: 'i' } },
        ],
      });
    }

    const [items, total] = await Promise.all([
      Announcement.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Announcement.countDocuments(filter),
    ]);

    res.json({
      success: true,
      page, limit, total,
      totalPages: Math.ceil(total / limit),
      data: items,
    });
  })
);

/**
 * @desc    Create a new announcement
 * @route   POST /api/announcements
 * @access  Admin / HR
 */
router.post(
  '/',
  authorize('Admin', 'HR'),
  createAnnouncementRules,
  validateRequest,
  asyncHandler(async (req, res) => {
    const { title, content, category, priority, audience, expiresAt } = req.body;
    const announcement = await Announcement.create({
      title, content, category, priority, audience, expiresAt,
      author: req.user._id,
      authorName: req.user.name,
    });
    res.status(201).json({ success: true, data: announcement });
  })
);

/**
 * @desc    Get a single announcement
 * @route   GET /api/announcements/:id
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      res.status(404);
      throw new Error('Announcement not found');
    }
    res.json({ success: true, data: announcement });
  })
);

/**
 * @desc    Update an announcement
 * @route   PUT /api/announcements/:id
 * @access  Admin / HR (HR can only edit own)
 */
router.put(
  '/:id',
  authorize('Admin', 'HR'),
  updateAnnouncementRules,
  validateRequest,
  asyncHandler(async (req, res) => {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      res.status(404);
      throw new Error('Announcement not found');
    }
    if (
      req.user.role === 'HR' &&
      announcement.author.toString() !== req.user._id.toString()
    ) {
      res.status(403);
      throw new Error('HR can only edit their own announcements');
    }
    const fields = [
      'title', 'content', 'category', 'priority',
      'audience', 'expiresAt', 'isPublished',
    ];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) announcement[f] = req.body[f];
    });
    await announcement.save();
    res.json({ success: true, data: announcement });
  })
);

/**
 * @desc    Delete an announcement
 * @route   DELETE /api/announcements/:id
 * @access  Admin
 */
router.delete(
  '/:id',
  authorize('Admin'),
  asyncHandler(async (req, res) => {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      res.status(404);
      throw new Error('Announcement not found');
    }
    await announcement.deleteOne();
    res.json({ success: true, message: 'Announcement deleted' });
  })
);

/**
 * @desc    Mark an announcement as read by current user
 * @route   PATCH /api/announcements/:id/read
 */
router.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      res.status(404);
      throw new Error('Announcement not found');
    }
    if (!announcement.readBy.includes(req.user._id)) {
      announcement.readBy.push(req.user._id);
      await announcement.save();
    }
    res.json({ success: true, data: { id: announcement._id, read: true } });
  })
);

module.exports = router;
