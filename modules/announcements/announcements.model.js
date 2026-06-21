const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({

  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true
  },

  content: {
    type: String,
    required: [true, 'Content is required']
  },

  targetType: {
    type: String,
    enum: ['all', 'class'],
    default: 'all'
  },

  // FIXED: Changed ref from 'ClassesModel' to 'Class'
  targetClass: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class', 
    default: null
  },

  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    default: null
  },

  postDate: {
    type: Date,
    default: Date.now
  },

  expireDate: {
    type: Date,
    default: null
  },

  status: {
    type: String,
    enum: ['published', 'draft', 'archived'],
    default: 'published'
  },

  // Simple flag (e.g., allow comments or pinned)
  action: {
    type: Boolean,
    default: true
  },

  attachments: [
    {
      name: String,
      path: String
    }
  ],

  remark: String

}, { timestamps: true });

module.exports = mongoose.model('Announcement', announcementSchema);