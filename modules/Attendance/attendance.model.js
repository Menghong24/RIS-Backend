const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class', // FIXED: Must match the model name "Class"
    required: [true, "Class is required"]
  },

  date: {
    type: Date,
    required: [true, "Attendance date is required"]
  },

  records: [
    {
      student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student', // FIXED: Must match the model name "Student"
        required: true
      },

      status: {
        type: String,
        // Common statuses: Present (វត្តមាន), Absent (អវត្តមាន), Permission (ច្បាប់), Late (យឺត)
        enum: ['present', 'absent', 'permission', 'late'],
        default: 'absent'
      },

      remark: {
        type: String,
        trim: true
      }
    }
  ],

  // Optional: Track which teacher/admin marked this
  markedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' 
  }

}, { timestamps: true });

// --- IMPORTANT IMPROVEMENT ---
// This ensures you cannot accidentally create TWO attendance documents 
// for the "Grade 7A" class on "2026-01-07".
attendanceSchema.index({ class: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);