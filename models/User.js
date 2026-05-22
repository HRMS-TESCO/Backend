const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * Slim User model - only what Announcement + Payroll APIs need:
 *   - identity (name, email, password)
 *   - role for RBAC middleware (Admin, HR, Manager, Employee)
 *   - employeeId so Payroll can identify staff
 */
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 6, select: false },
    role: {
      type: String,
      enum: ['Admin', 'HR', 'Manager', 'Employee'],
      default: 'Employee',
    },
    employeeId: { type: String, unique: true, sparse: true },
    department: { type: String, default: '' },
    designation: { type: String, default: '' },
  },
  { timestamps: true }
);

// Hash password on create / update
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
