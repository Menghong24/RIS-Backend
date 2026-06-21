const mongoose = require('mongoose');

const scoreSchema = new mongoose.Schema({
  
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: [true, "Student is required"]
  },

  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: [true, "Class is required"]
  },

  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: [true, "Subject is required"]
  },

  academicYear: {
    type: String,
    default: '2026',
    trim: true
  },

  month: {
    type: String,
    required: [true, "Month is required"],
    enum: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  },

  semester: {
    type: String,
    default: 'Semester 1',
    trim: true
  },

  type: {
    type: String,
    enum: ['monthly', 'semester', 'final'],
    default: 'monthly'
  },

  score: {
    type: Number,
    required: [true, "Score is required"],
    min: [0, "Score cannot be less than 0"],
    max: [100, "Score cannot be greater than 100"]
  },

  remark: {
    type: String,
    default: '',
    trim: true
  }

}, { timestamps: true });

// Compound index to prevent duplicate scores for the same student/subject/month
scoreSchema.index({ studentId: 1, subjectId: 1, month: 1, academicYear: 1 }, { unique: true });

module.exports = mongoose.model('Score', scoreSchema);