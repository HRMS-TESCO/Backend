// =============================================================
// Employee Controller
// =============================================================
const asyncHandler = require('express-async-handler');
const Employee = require('../models/Employee');
const Asset = require('../models/Asset');

// @desc    Get all employees
// @route   GET /api/employees
// @access  Public
const getEmployees = asyncHandler(async (req, res) => {
  const { search, department } = req.query;
  const filter = {};
  if (department) filter.department = department;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { employeeId: { $regex: search, $options: 'i' } },
      { role: { $regex: search, $options: 'i' } },
    ];
  }
  const employees = await Employee.find(filter).sort({ employeeId: 1 });
  res.json({ success: true, count: employees.length, data: employees });
});

// @desc    Get single employee with assets
// @route   GET /api/employees/:id
// @access  Public
const getEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.params.id).populate('assets');
  if (!employee) {
    res.status(404);
    throw new Error('Employee not found');
  }
  res.json({ success: true, data: employee });
});

// @desc    Create new employee
// @route   POST /api/employees
// @access  Public
const createEmployee = asyncHandler(async (req, res) => {
  const { employeeId, name, role, department, email, avatarColor } = req.body;
  const employee = await Employee.create({
    employeeId,
    name,
    role,
    department,
    email,
    avatarColor,
  });
  res.status(201).json({ success: true, data: employee });
});

// @desc    Update employee
// @route   PUT /api/employees/:id
// @access  Public
const updateEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!employee) {
    res.status(404);
    throw new Error('Employee not found');
  }
  res.json({ success: true, data: employee });
});

// @desc    Delete employee (and unassign their assets)
// @route   DELETE /api/employees/:id
// @access  Public
const deleteEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.params.id);
  if (!employee) {
    res.status(404);
    throw new Error('Employee not found');
  }
  // Unassign their assets instead of deleting them
  await Asset.updateMany(
    { employee: employee._id },
    { $set: { employee: null, status: 'Unassigned' } }
  );
  await employee.deleteOne();
  res.json({ success: true, message: 'Employee deleted, assets unassigned' });
});

module.exports = {
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
};
