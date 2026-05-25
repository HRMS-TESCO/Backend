// models/Employee.js
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const addressSchema = new mongoose.Schema(
  { street: { type: String, default: '' }, city: { type: String, default: '' },
    state:  { type: String, default: '' }, zipCode: { type: String, default: '' },
    country:{ type: String, default: '' } },
  { _id: false }
);

const educationSchema = new mongoose.Schema(
  {
    degree:         { type: String, default: '' },
    university:     { type: String, default: '', trim: true },
    fieldOfStudy:   { type: String, default: '', trim: true },
    graduationYear: { type: Number, default: 2020 },
  },
  { _id: false }
);

const employeeSchema = new mongoose.Schema(
  {
    firstName:      { type: String, required: [true, 'First name is required'], trim: true },
    lastName:       { type: String, required: [true, 'Last name is required'],  trim: true },
    // username — NOT unique at model level; route guarantees uniqueness via timestamp suffix
    username:       { type: String, trim: true, lowercase: true, default: null },
    // password — no minlength, nullable
    password:       { type: String, select: false, default: null },
    // email — NOT unique at model level; multiple employees can share or have null email
    email:          { type: String, lowercase: true, trim: true, default: null },
    phone:          { type: String, trim: true, default: '' },
    address:        { type: addressSchema, default: () => ({}) },
    // employeeId — unique but sparse; route handles conflicts before reaching model
    employeeId:     { type: String, unique: true, sparse: true, trim: true, uppercase: true },
    department:     { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: [true, 'Department is required'] },
    designation:    { type: mongoose.Schema.Types.ObjectId, ref: 'Designation', default: null },
    employmentType: { type: String, enum: ['Full-time', 'Part-time', 'Contract', 'Intern', ''], default: '' },
    joiningDate:    { type: Date, required: [true, 'Joining date is required'] },
    salary:         { type: Number, default: 0, min: 0 },
    assignedTo:     { type: String, default: '', trim: true },
    education:      { type: educationSchema, default: () => ({}) },
    status:         { type: String, enum: ['Active', 'Inactive', 'On Leave', 'Terminated'], default: 'Active' },
    isActive:       { type: Boolean, default: true },
    accessRole:     { type: mongoose.Schema.Types.ObjectId, ref: 'AccessRole', default: null },
    createdBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Auto-generate sequential employeeId if not supplied
employeeSchema.pre('validate', async function () {
  if (!this.employeeId) {
    const Employee = mongoose.model('Employee');
    const last = await Employee.findOne({}, { employeeId: 1 }).sort({ createdAt: -1 }).lean();
    let nextNum = 1001;
    if (last && last.employeeId) {
      const parts = last.employeeId.split('-');
      const n = parseInt(parts[parts.length - 1]);
      if (!isNaN(n)) nextNum = n + 1;
    }
    this.employeeId = `EMP-${nextNum}`;
  }
});

// Hash password before save (only if set and modified)
employeeSchema.pre('save', async function () {
  if (!this.password || !this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

employeeSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

employeeSchema.set('toJSON',   { virtuals: true });
employeeSchema.set('toObject', { virtuals: true });

employeeSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('Employee', employeeSchema);
