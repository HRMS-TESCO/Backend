const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: 200,
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
      trim: true,
    },
    category: {
      type: String,
      enum: ['General', 'Event', 'Benefits', 'Office', 'Policy', 'Holiday'],
      default: 'General',
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Low',
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    authorName: { type: String, required: true },
    isPublished: { type: Boolean, default: true },
    expiresAt: { type: Date, default: null },
    audience: {
      type: String,
      enum: ['All', 'Admin', 'HR', 'Employee'],
      default: 'All',
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  { timestamps: true }
);

// Index for fast filtering by category and recency
announcementSchema.index({ category: 1, createdAt: -1 });

module.exports = mongoose.model('Announcement', announcementSchema);
