const mongoose = require("mongoose");

const classSchema = new mongoose.Schema(
  {
    classNumber: {
      type: Number,
      required: [true, "Class Number is required."],
      index: true,
    },
    className: {
      type: String,
      required: [true, "Class Name is required."],
      trim: true,
    },
    classGrade: {
      type: String,
      required: [true, "Class Grade is required"],
      trim: true,
    },
    typeOfClass: {
      type: String,
      required: [true, "Type of class is required"],
      trim: true,
    },
    yearOnStudy: {
      type: String,
      required: [true, "Year for Study is required"],
      trim: true,
    },
    timeStudy: {
      type: String,
      required: [true, "Time for Study is required"],
      enum: {
        values: ["ព្រឹក", "ល្ងាច", "យប់"],
        message: "{VALUE} is not a valid study time",
      },
    },
    status: {
      type: String,
      enum: ["active", "finished", "archived"],
      default: "active",
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
    },
    
    // !!! FIXED: Renamed from 'studentsIn' to 'students' !!!
    // This must match what you use in .populate('students')
    students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Student",
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual to count how many students are in the class
classSchema.virtual("studentCount").get(function () {
  return this.students ? this.students.length : 0;
});

const ClassesModel = mongoose.model("Class", classSchema);
module.exports = ClassesModel;