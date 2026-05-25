// routes/employeeRoutes.js
const express     = require('express');
const router      = express.Router();
const mongoose    = require('mongoose');
const Employee    = require('../models/Employee');
const Department  = require('../models/Department');
const Designation = require('../models/Designation');
const AccessRole  = require('../models/AccessRole');

const isObjectId = v => v && mongoose.Types.ObjectId.isValid(String(v)) && String(v).length === 24;

const resolveEmployee = (e, deptMap, desigMap, roleMap) => ({
  ...e,
  department:  isObjectId(e.department)  ? (deptMap[String(e.department)]   || { name: '—' })  : { name: String(e.department  || '—') },
  designation: isObjectId(e.designation) ? (desigMap[String(e.designation)] || { title: '—' }) : { title: String(e.designation || '—') },
  accessRole:  isObjectId(e.accessRole)  ? (roleMap[String(e.accessRole)]   || { name: '—' })  : { name: String(e.accessRole  || '—') },
});

const loadLookupMaps = async () => {
  const [depts, desigs, roles] = await Promise.all([
    Department.find({}).lean(),
    Designation.find({}).lean(),
    AccessRole.find({}).lean(),
  ]);
  return {
    deptMap:  Object.fromEntries(depts.map(d  => [String(d._id), d])),
    desigMap: Object.fromEntries(desigs.map(d => [String(d._id), d])),
    roleMap:  Object.fromEntries(roles.map(r  => [String(r._id), r])),
  };
};

// ── GET /api/employees ──────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)   || 1);
    const limit  = Math.min(200, parseInt(req.query.limit) || 20);
    const skip   = (page - 1) * limit;
    const search = req.query.search;
    const filter = {};
    if (search) {
      filter.$or = [
        { firstName:  { $regex: search, $options: 'i' } },
        { lastName:   { $regex: search, $options: 'i' } },
        { email:      { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
      ];
    }
    const [total, raw] = await Promise.all([
      Employee.countDocuments(filter),
      Employee.find(filter).lean().sort({ createdAt: -1 }).skip(skip).limit(limit),
    ]);
    const { deptMap, desigMap, roleMap } = await loadLookupMaps();
    const employees = raw.map(e => resolveEmployee(e, deptMap, desigMap, roleMap));
    return res.status(200).json({ success: true, total, page, pages: Math.ceil(total / limit), employees });
  } catch (err) {
    console.error('[EMPLOYEE] List error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/employees/latest ───────────────────────────────────
router.get('/latest', async (req, res) => {
  try {
    const emp = await Employee.findOne().lean().sort({ createdAt: -1 });
    if (!emp) return res.status(404).json({ success: false, message: 'No employees yet' });
    return res.status(200).json({ success: true, employee: emp });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/employees/:id ──────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id).lean();
    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });
    const { deptMap, desigMap, roleMap } = await loadLookupMaps();
    return res.status(200).json({ success: true, employee: resolveEmployee(emp, deptMap, desigMap, roleMap) });
  } catch (err) {
    if (err.name === 'CastError') return res.status(400).json({ success: false, message: 'Invalid employee id' });
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/employees — create ────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const b = req.body;
    console.log('[EMPLOYEE POST] Received:', b.firstName, b.lastName, '| dept:', b.department, '| desig:', b.designation);

    if (!b.firstName || !b.lastName) {
      return res.status(400).json({ success: false, message: 'firstName and lastName are required' });
    }

    // Drop stale unique indexes on username/email so they never block inserts
    try {
      const indexes = await Employee.collection.indexes();
      for (const idx of indexes) {
        const keys = Object.keys(idx.key || {});
        if (idx.unique && (keys.includes('username') || keys.includes('email'))) {
          await Employee.collection.dropIndex(idx.name);
          console.log('[EMPLOYEE POST] Dropped stale unique index:', idx.name);
        }
      }
    } catch (_) {}

    // ── Resolve department — only match existing, never auto-create ──
    let deptId = null;
    if (b.department) {
      if (isObjectId(b.department)) {
        deptId = b.department;
      } else {
        const dept = await Department.findOne({ name: { $regex: new RegExp(`^${b.department}$`, 'i') } }).lean();
        if (dept) {
          deptId = dept._id;
          console.log('[EMPLOYEE POST] Matched dept:', dept.name, dept._id);
        } else {
          console.log('[EMPLOYEE POST] Dept not found in DB, skipping:', b.department);
        }
      }
    }

    // ── Resolve designation — only match existing, never auto-create ──
    let desigId = null;
    if (b.designation) {
      if (isObjectId(b.designation)) {
        desigId = b.designation;
      } else {
        const desig = await Designation.findOne({ title: { $regex: new RegExp(`^${b.designation}$`, 'i') } }).lean();
        if (desig) {
          desigId = desig._id;
          console.log('[EMPLOYEE POST] Matched desig:', desig.title, desig._id);
        } else {
          console.log('[EMPLOYEE POST] Desig not found in DB, skipping:', b.designation);
        }
      }
    }

    // ── Always generate a unique username from name + full epoch timestamp ──
    // Never use what the frontend sends — epoch guarantees no clash with old indexes
    const namePart = `${b.firstName}${b.lastName}`.toLowerCase().replace(/[^a-z0-9]/g, '');
    const username = `${namePart}_${Date.now()}`;

    // ── Email: null if blank, modify if exact duplicate ───────────
    const rawEmail = (b.email || '').toLowerCase().trim();
    let email = rawEmail || null;
    if (email) {
      const existing = await Employee.findOne({ email }).lean();
      if (existing) {
        const [local, domain] = email.split('@');
        email = `${local}_${Date.now().toString().slice(-6)}@${domain}`;
      }
    }

    // ── EmployeeId: check conflict and suffix if needed ───────────
    let employeeId = (b.employeeId || '').trim().toUpperCase() || undefined;
    if (employeeId) {
      const existing = await Employee.findOne({ employeeId }).lean();
      if (existing) {
        employeeId = `${employeeId}-${Date.now().toString().slice(-4)}`;
        console.log('[EMPLOYEE POST] EmployeeId conflict, using:', employeeId);
      }
    }

    const payload = {
      firstName:      b.firstName,
      lastName:       b.lastName,
      username:       username,
      password:       b.password || null,
      email:          email,
      phone:          b.phone || '',
      address:        b.address || {},
      employeeId:     employeeId,
      department:     deptId,
      designation:    desigId,
      employmentType: b.employmentType || '',
      joiningDate:    b.joiningDate,
      salary:         Number(b.salary) || 0,
      assignedTo:     b.assignedTo || '',
      education:      b.education || {},
      status:         'Active',
      isActive:       true,
    };

    console.log('[EMPLOYEE POST] Saving with username:', username, '| employeeId:', employeeId);
    const employee = await Employee.create(payload);
    console.log('[EMPLOYEE POST] ✅ Created:', employee.employeeId, employee.firstName, employee.lastName);

    // ── Update department & designation headcounts (only if matched) ─
    if (deptId) {
      const deptCount = await Employee.countDocuments({ department: deptId });
      await Department.findByIdAndUpdate(deptId, { count: deptCount });
      console.log('[EMPLOYEE POST] Dept count updated:', deptCount);
    }
    if (desigId) {
      const desigCount = await Employee.countDocuments({ designation: desigId });
      await Designation.findByIdAndUpdate(desigId, { count: desigCount });
      console.log('[EMPLOYEE POST] Desig count updated:', desigCount);
    }

    return res.status(201).json({ success: true, message: 'Employee created successfully', data: employee.toSafeObject() });

  } catch (err) {
    console.error('[EMPLOYEE POST] ❌', err.name, ':', err.message);
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors).map(e => e.message).join(', ');
      return res.status(400).json({ success: false, message: 'Validation failed: ' + msg });
    }
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || 'field';
      return res.status(400).json({ success: false, message: `${field} already exists — please restart the backend and try again.` });
    }
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/employees/:id — update ────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const payload = { ...req.body };
    delete payload.password;
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
    const employee = await Employee.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: false });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    return res.status(200).json({ success: true, message: 'Employee updated', employee: employee.toSafeObject() });
  } catch (err) {
    if (err.name === 'CastError') return res.status(400).json({ success: false, message: 'Invalid employee id' });
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'Duplicate value' });
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/employees/:id — soft delete ─────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      { isActive: false, status: 'Terminated' },
      { new: true }
    );
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    return res.status(200).json({ success: true, message: 'Employee deleted' });
  } catch (err) {
    if (err.name === 'CastError') return res.status(400).json({ success: false, message: 'Invalid employee id' });
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
