const mongoose = require('mongoose');

const classScheduleSchema = new mongoose.Schema({

  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class', // FIXED: Changed from 'ClassesModel' to 'Class'
    required: [true, "Class is required"]
  },

  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: [true, "Subject is required"]
  },

  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    default: null
  },

  day: {
    type: String,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    required: [true, "Day is required"],
    default: 'Monday'
  },

  startTime: {
    type: String,
    required: [true, "Start time is required"],
    default: '07:00'
  },

  endTime: {
    type: String,
    required: [true, "End time is required"],
    default: '08:00'
  },

  room: {
    type: String,
    default: 'A1',
    trim: true
  },

  status: {
    type: String,
    enum: ['active', 'disabled'],
    default: 'active'
  },

  academicYear: {
    type: String,
    default: '2026'
  },

  remark: String

}, { timestamps: true });

// Optional: Compound index to prevent double booking a room at the same time/day is complex
// but we can at least index for faster searching by class
classScheduleSchema.index({ class: 1, day: 1 });

module.exports = mongoose.model('ClassSchedule', classScheduleSchema);