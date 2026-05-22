// =============================================================
// Asset Controller
// =============================================================
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Asset = require('../models/Asset');
const Employee = require('../models/Employee');

// @desc    Get all assets (flat list, with filters)
// @route   GET /api/assets
// @access  Public
// @query   search, type, status, condition, employee, page, limit
const getAssets = asyncHandler(async (req, res) => {
  const {
    search,
    type,
    status,
    condition,
    employee,
    page = 1,
    limit = 50,
  } = req.query;

  const filter = {};
  if (type && type !== 'All Types') filter.type = type;
  if (status) filter.status = status;
  if (condition) filter.condition = condition;
  if (employee) filter.employee = employee;

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { assetId: { $regex: search, $options: 'i' } },
      { serialNo: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [assets, total] = await Promise.all([
    Asset.find(filter)
      .populate('employee', 'employeeId name role department avatarColor')
      .sort({ assetId: 1 })
      .skip(skip)
      .limit(Number(limit)),
    Asset.countDocuments(filter),
  ]);

  res.json({
    success: true,
    count: assets.length,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
    data: assets,
  });
});

// @desc    Get assets grouped by employee (matches the UI exactly)
// @route   GET /api/assets/grouped
// @access  Public
const getAssetsGroupedByEmployee = asyncHandler(async (req, res) => {
  const { search, type } = req.query;

  // Search employees (header rows) AND filter assets if search hits a serial/name/id
  const employees = await Employee.find({}).sort({ employeeId: 1 }).lean();

  const assetFilter = {};
  if (type && type !== 'All Types') assetFilter.type = type;
  if (search) {
    assetFilter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { assetId: { $regex: search, $options: 'i' } },
      { serialNo: { $regex: search, $options: 'i' } },
    ];
  }

  const assets = await Asset.find(assetFilter).sort({ assetId: 1 }).lean();

  const groups = employees
    .map((emp) => {
      const empAssets = assets.filter(
        (a) => a.employee && String(a.employee) === String(emp._id)
      );
      // If the user is searching by name/id, also match the employee row
      const empMatchesSearch =
        search &&
        (emp.name.toLowerCase().includes(search.toLowerCase()) ||
          emp.employeeId.toLowerCase().includes(search.toLowerCase()));

      return {
        employee: {
          _id: emp._id,
          employeeId: emp.employeeId,
          name: emp.name,
          role: emp.role,
          department: emp.department,
          avatarColor: emp.avatarColor,
          initials: emp.name
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map((p) => p[0].toUpperCase())
            .join(''),
        },
        assets: empAssets,
        assetCount: empAssets.length,
        matched: empAssets.length > 0 || empMatchesSearch,
      };
    })
    // Only include groups that have at least one matching asset (or matched by name)
    .filter((g) => (search || (type && type !== 'All Types') ? g.matched : true));

  res.json({
    success: true,
    count: groups.length,
    data: groups,
  });
});

// @desc    Get single asset
// @route   GET /api/assets/:id
// @access  Public
const getAsset = asyncHandler(async (req, res) => {
  const asset = await Asset.findById(req.params.id).populate(
    'employee',
    'employeeId name role department'
  );
  if (!asset) {
    res.status(404);
    throw new Error('Asset not found');
  }
  res.json({ success: true, data: asset });
});

// @desc    Create new asset
// @route   POST /api/assets
// @access  Public
const createAsset = asyncHandler(async (req, res) => {
  const {
    assetId,
    name,
    type,
    serialNo,
    issuedDate,
    condition,
    status,
    employee,
    notes,
  } = req.body;

  // Validate employee exists if supplied
  if (employee) {
    if (!mongoose.Types.ObjectId.isValid(employee)) {
      res.status(400);
      throw new Error('Invalid employee id');
    }
    const empExists = await Employee.exists({ _id: employee });
    if (!empExists) {
      res.status(404);
      throw new Error('Employee not found');
    }
  }

  const asset = await Asset.create({
    assetId,
    name,
    type,
    serialNo,
    issuedDate,
    condition,
    status: employee ? status || 'Assigned' : 'Unassigned',
    employee: employee || null,
    notes,
  });

  res.status(201).json({ success: true, data: asset });
});

// @desc    Update asset
// @route   PUT /api/assets/:id
// @access  Public
const updateAsset = asyncHandler(async (req, res) => {
  const asset = await Asset.findById(req.params.id);
  if (!asset) {
    res.status(404);
    throw new Error('Asset not found');
  }

  // If reassigning, validate employee
  if (req.body.employee) {
    const empExists = await Employee.exists({ _id: req.body.employee });
    if (!empExists) {
      res.status(404);
      throw new Error('New employee not found');
    }
  }

  Object.assign(asset, req.body);

  // Keep status in sync when an asset becomes unassigned
  if (!asset.employee) asset.status = 'Unassigned';

  const updated = await asset.save();
  res.json({ success: true, data: updated });
});

// @desc    Delete asset
// @route   DELETE /api/assets/:id
// @access  Public
const deleteAsset = asyncHandler(async (req, res) => {
  const asset = await Asset.findById(req.params.id);
  if (!asset) {
    res.status(404);
    throw new Error('Asset not found');
  }
  await asset.deleteOne();
  res.json({ success: true, message: 'Asset deleted' });
});

// @desc    Assign asset to an employee
// @route   PATCH /api/assets/:id/assign
// @access  Public
const assignAsset = asyncHandler(async (req, res) => {
  const { employeeId } = req.body; // _id of employee
  const asset = await Asset.findById(req.params.id);
  if (!asset) {
    res.status(404);
    throw new Error('Asset not found');
  }
  const employee = await Employee.findById(employeeId);
  if (!employee) {
    res.status(404);
    throw new Error('Employee not found');
  }
  asset.employee = employee._id;
  asset.status = 'Assigned';
  await asset.save();
  res.json({ success: true, data: asset });
});

// @desc    Unassign asset
// @route   PATCH /api/assets/:id/unassign
// @access  Public
const unassignAsset = asyncHandler(async (req, res) => {
  const asset = await Asset.findById(req.params.id);
  if (!asset) {
    res.status(404);
    throw new Error('Asset not found');
  }
  asset.employee = null;
  asset.status = 'Unassigned';
  await asset.save();
  res.json({ success: true, data: asset });
});

// @desc    Get enums (types, conditions, statuses) — handy for dropdowns
// @route   GET /api/assets/meta/enums
// @access  Public
const getAssetEnums = asyncHandler(async (_req, res) => {
  res.json({
    success: true,
    data: {
      types: Asset.ASSET_TYPES,
      conditions: Asset.CONDITIONS,
      statuses: Asset.STATUSES,
    },
  });
});

module.exports = {
  getAssets,
  getAssetsGroupedByEmployee,
  getAsset,
  createAsset,
  updateAsset,
  deleteAsset,
  assignAsset,
  unassignAsset,
  getAssetEnums,
};
