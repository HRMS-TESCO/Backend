const express = require('express');
const asyncHandler = require('express-async-handler');

const Payroll = require('../models/Payroll');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const validateRequest = require('../middleware/validateRequest');
const {
  createPayrollRules,
  updatePayrollRules,
  idParamRule,
} = require('../validators/payrollValidator');

const router = express.Router();

// Helper - employees can only see their own records
const enforceOwnership = (req, payroll) => {
  if (
    req.user.role === 'Employee' &&
    payroll.employee.toString() !== req.user._id.toString()
  ) {
    const err = new Error('Forbidden - you can only view your own payroll');
    err.statusCode = 403;
    throw err;
  }
};

// All payroll routes require authentication
router.use(protect);

/**
 * @desc    Current user's payroll history
 * @route   GET /api/payroll/my
 */
router.get(
  '/my',
  asyncHandler(async (req, res) => {
    const items = await Payroll.find({ employee: req.user._id })
      .sort({ year: -1, month: -1 })
      .lean();
    res.json({ success: true, total: items.length, data: items });
  })
);

/**
 * @desc    Aggregated yearly summary
 * @route   GET /api/payroll/summary/:year
 * @access  Admin / HR
 */
router.get(
  '/summary/:year',
  authorize('Admin', 'HR'),
  asyncHandler(async (req, res) => {
    const year = parseInt(req.params.year, 10);
    if (!year) {
      res.status(400);
      throw new Error('Valid year is required');
    }
    const summary = await Payroll.aggregate([
      { $match: { year } },
      {
        $group: {
          _id: '$month',
          totalGross: { $sum: '$grossSalary' },
          totalDeductions: { $sum: '$totalDeductions' },
          totalNet: { $sum: '$netSalary' },
          employeeCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    res.json({ success: true, year, data: summary });
  })
);

/**
 * @desc    List all payrolls
 * @route   GET /api/payroll
 * @access  Admin / HR
 */
router.get(
  '/',
  authorize('Admin', 'HR'),
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.month) filter.month = parseInt(req.query.month, 10);
    if (req.query.year) filter.year = parseInt(req.query.year, 10);
    if (req.query.status) filter.status = req.query.status;
    if (req.query.employee) filter.employee = req.query.employee;

    const [items, total] = await Promise.all([
      Payroll.find(filter)
        .populate('employee', 'name email department designation employeeId')
        .sort({ year: -1, month: -1, createdAt: -1 })
        .skip(skip).limit(limit).lean(),
      Payroll.countDocuments(filter),
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
 * @desc    Create a payroll record (one per employee/month/year)
 * @route   POST /api/payroll
 * @access  Admin / HR
 */
router.post(
  '/',
  authorize('Admin', 'HR'),
  createPayrollRules,
  validateRequest,
  asyncHandler(async (req, res) => {
    const { employee, month, year } = req.body;

    const emp = await User.findById(employee);
    if (!emp) {
      res.status(404);
      throw new Error('Employee not found');
    }
    const existing = await Payroll.findOne({ employee, month, year });
    if (existing) {
      res.status(409);
      throw new Error(`Payroll already exists for this employee for ${month}/${year}`);
    }

    const payroll = await Payroll.create({
      ...req.body,
      employeeName: emp.name,
      employeeIdCode: emp.employeeId || '',
      processedBy: req.user._id,
    });

    res.status(201).json({ success: true, data: payroll });
  })
);

/**
 * @desc    Get a payroll record by id (Employee can only view own)
 * @route   GET /api/payroll/:id
 */
router.get(
  '/:id',
  idParamRule,
  validateRequest,
  asyncHandler(async (req, res) => {
    const payroll = await Payroll.findById(req.params.id).populate(
      'employee',
      'name email department designation employeeId'
    );
    if (!payroll) {
      res.status(404);
      throw new Error('Payroll record not found');
    }
    enforceOwnership(req, payroll);
    res.json({ success: true, data: payroll });
  })
);

/**
 * @desc    Update a payroll record (auto-recalculates net)
 * @route   PUT /api/payroll/:id
 * @access  Admin / HR
 */
router.put(
  '/:id',
  authorize('Admin', 'HR'),
  idParamRule,
  updatePayrollRules,
  validateRequest,
  asyncHandler(async (req, res) => {
    const payroll = await Payroll.findById(req.params.id);
    if (!payroll) {
      res.status(404);
      throw new Error('Payroll record not found');
    }
    const editable = [
      'basicSalary', 'allowances', 'deductions',
      'workingDays', 'daysPresent', 'leavesTaken',
      'status', 'paymentDate', 'paymentMode', 'remarks',
    ];
    editable.forEach((f) => {
      if (req.body[f] !== undefined) payroll[f] = req.body[f];
    });
    await payroll.save();
    res.json({ success: true, data: payroll });
  })
);

/**
 * @desc    Mark payroll as Paid
 * @route   PATCH /api/payroll/:id/pay
 * @access  Admin / HR
 */
router.patch(
  '/:id/pay',
  authorize('Admin', 'HR'),
  idParamRule,
  validateRequest,
  asyncHandler(async (req, res) => {
    const payroll = await Payroll.findById(req.params.id);
    if (!payroll) {
      res.status(404);
      throw new Error('Payroll record not found');
    }
    payroll.status = 'Paid';
    payroll.paymentDate = req.body.paymentDate || new Date();
    if (req.body.paymentMode) payroll.paymentMode = req.body.paymentMode;
    await payroll.save();
    res.json({ success: true, data: payroll });
  })
);

/**
 * @desc    Delete a payroll record
 * @route   DELETE /api/payroll/:id
 * @access  Admin
 */
router.delete(
  '/:id',
  authorize('Admin'),
  idParamRule,
  validateRequest,
  asyncHandler(async (req, res) => {
    const payroll = await Payroll.findById(req.params.id);
    if (!payroll) {
      res.status(404);
      throw new Error('Payroll record not found');
    }
    await payroll.deleteOne();
    res.json({ success: true, message: 'Payroll record deleted' });
  })
);

/**
 * @desc    Get printable payslip data
 * @route   GET /api/payroll/:id/payslip
 */
router.get(
  '/:id/payslip',
  idParamRule,
  validateRequest,
  asyncHandler(async (req, res) => {
    const payroll = await Payroll.findById(req.params.id).populate(
      'employee',
      'name email department designation employeeId'
    );
    if (!payroll) {
      res.status(404);
      throw new Error('Payroll record not found');
    }
    enforceOwnership(req, payroll);

    const monthNames = [
      'January','February','March','April','May','June',
      'July','August','September','October','November','December',
    ];

    res.json({
      success: true,
      data: {
        payslipId: payroll._id,
        employee: payroll.employee,
        period: `${monthNames[payroll.month - 1]} ${payroll.year}`,
        basicSalary: payroll.basicSalary,
        allowances: payroll.allowances,
        deductions: payroll.deductions,
        grossSalary: payroll.grossSalary,
        totalDeductions: payroll.totalDeductions,
        netSalary: payroll.netSalary,
        workingDays: payroll.workingDays,
        daysPresent: payroll.daysPresent,
        leavesTaken: payroll.leavesTaken,
        status: payroll.status,
        paymentDate: payroll.paymentDate,
        paymentMode: payroll.paymentMode,
        generatedAt: new Date(),
      },
    });
  })
);

module.exports = router;
