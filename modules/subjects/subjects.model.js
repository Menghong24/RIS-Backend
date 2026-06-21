const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({

  subjectName: {
    type: String,
    required: true,
    trim: true
  },

  gradeLevel: {
    type: String,
    default: '12'
  },

  type: {
    type: String,
    enum: ['general', 'optional', 'skill'],
    default: 'general'
  },
  classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class' // Matches your ClassesModel name
    },

  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    default: null
  },

  fee: {
    type: Number,
    default: 0
  },

  status: {
    type: String,
    enum: ['active', 'disabled'],
    default: 'active'
  },

  remark: String

}, { timestamps: true });

module.exports = mongoose.model('Subject', subjectSchema);
