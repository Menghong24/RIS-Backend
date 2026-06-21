const mongoose = require("mongoose");

const assessmentSchema = new mongoose.Schema({
  name: {
    type: String,
    enum: ['Quiz', 'Assignment', 'Midterm', 'Final', 'Monthly Test'],
    required: true
  },

  semester: {
    type: String,
    enum: ['Semester 1', 'Semester 2'],
    required: true
  },

  academicYear: {
    type: String,
    required: true
  },

  month: String,

  classId: { type: mongoose.Schema.Types.ObjectId, ref: "Class" },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject" }

}, { timestamps: true });

module.exports = mongoose.model("Assessment", assessmentSchema);