const mongoose = require('mongoose');

const allowancesSchema = new mongoose.Schema(
  {
    hra: { type: Number, default: 0, min: 0 },
    travel: { type: Number, default: 0, min: 0 },
    medical: { type: Number, default: 0, min: 0 },
    special: { type: Number, default: 0, min: 0 },
    bonus: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const deductionsSchema = new mongoose.Schema(
  {
    pf: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    insurance: { type: Number, default: 0, min: 0 },
    loan: { type: Number, default: 0, min: 0 },
    other: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const payrollSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    employeeName: { type: String, required: true },
    employeeIdCode: { type: String },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    year: { type: Number, required: true, min: 2000, max: 2100 },
    basicSalary: { type: Number, required: true, min: 0 },
    allowances: { type: allowancesSchema, default: () => ({}) },
    deductions: { type: deductionsSchema, default: () => ({}) },

    // Auto-computed
    grossSalary: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    netSalary: { type: Number, default: 0 },

    workingDays: { type: Number, default: 0, min: 0 },
    daysPresent: { type: Number, default: 0, min: 0 },
    leavesTaken: { type: Number, default: 0, min: 0 },

    status: {
      type: String,
      enum: ['Pending', 'Processed', 'Paid', 'Cancelled'],
      default: 'Pending',
    },
    paymentDate: { type: Date, default: null },
    paymentMode: {
      type: String,
      enum: ['Bank Transfer', 'Cash', 'Cheque', 'UPI'],
      default: 'Bank Transfer',
    },
    remarks: { type: String, default: '' },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// One payroll per employee per month/year
payrollSchema.index({ employee: 1, month: 1, year: 1 }, { unique: true });

/**
 * Pre-save hook: compute gross, total deductions, and net salary
 * so the client never has to send those - keeps numbers consistent.
 */
payrollSchema.pre('save', function (next) {
  const a = this.allowances || {};
  const d = this.deductions || {};

  const totalAllowances =
    (a.hra || 0) +
    (a.travel || 0) +
    (a.medical || 0) +
    (a.special || 0) +
    (a.bonus || 0);

  this.grossSalary = (this.basicSalary || 0) + totalAllowances;

  this.totalDeductions =
    (d.pf || 0) +
    (d.tax || 0) +
    (d.insurance || 0) +
    (d.loan || 0) +
    (d.other || 0);

  this.netSalary = this.grossSalary - this.totalDeductions;
  next();
});

module.exports = mongoose.model('Payroll', payrollSchema);
