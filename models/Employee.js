// =============================================================
// Employee Model
// Matches the employee group header rows in the UI:
//   - initials (LF, ZM, RP, AT, EB)
//   - name, role, department
//   - employeeId (EMP-1001)
// =============================================================
const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: [true, 'Employee ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      // e.g. EMP-1001
      match: [/^EMP-\d{3,}$/, 'Employee ID must look like EMP-1001'],
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      trim: true,
      // e.g. "Frontend Dev", "UX Designer"
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
      // e.g. "Engineering", "Design", "Operations"
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    avatarColor: {
      type: String,
      default: '#E5E7EB', // used for the colored circle behind initials
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Virtual: initials from name -> "Liam Foster" => "LF"
employeeSchema.virtual('initials').get(function () {
  if (!this.name) return '';
  return this.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
});

// Virtual: assets reference (populated on demand)
employeeSchema.virtual('assets', {
  ref: 'Asset',
  localField: '_id',
  foreignField: 'employee',
});

employeeSchema.set('toJSON', { virtuals: true });
employeeSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Employee', employeeSchema);
