// =============================================================
// Asset Model
// Matches the asset rows in the UI:
//   - assetId (AST-001), name (MacBook Pro M2 14"), type, serialNo,
//     issuedDate, condition, status, actions
// =============================================================
const mongoose = require('mongoose');

const ASSET_TYPES = ['Laptop', 'Monitor', 'PC', 'Mouse', 'Keyboard', 'ID Card'];
const CONDITIONS = ['New', 'Good', 'Fair', 'Poor'];
const STATUSES = ['Assigned', 'Unassigned', 'In Repair', 'Retired'];

const assetSchema = new mongoose.Schema(
  {
    assetId: {
      type: String,
      required: [true, 'Asset ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      // e.g. AST-001, IDC-1001
    },
    name: {
      type: String,
      required: [true, 'Asset name is required'],
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: {
        values: ASSET_TYPES,
        message: `Type must be one of: ${ASSET_TYPES.join(', ')}`,
      },
      index: true,
    },
    serialNo: {
      type: String,
      required: [true, 'Serial number is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    issuedDate: {
      type: Date,
      required: [true, 'Issued date is required'],
    },
    condition: {
      type: String,
      enum: CONDITIONS,
      default: 'Good',
    },
    status: {
      type: String,
      enum: STATUSES,
      default: 'Assigned',
      index: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: false, // null if Unassigned
      index: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Quick search by name / serial / assetId
assetSchema.index({ name: 'text', serialNo: 'text', assetId: 'text' });

assetSchema.statics.ASSET_TYPES = ASSET_TYPES;
assetSchema.statics.CONDITIONS = CONDITIONS;
assetSchema.statics.STATUSES = STATUSES;

module.exports = mongoose.model('Asset', assetSchema);
