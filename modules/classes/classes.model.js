const mongoose = require("mongoose");

const classSchema = new mongoose.Schema(
  {
    classNumber: {
      type: Number,
      required: [true, "Class Number is required."],
      min: [1, "Class Number must be greater than 0"],
      index: true
    },

    className: {
      type: String,
      required: [true, "Class Name is required."],
      trim: true,
      index: true
    },

    classGrade: {
      type: String,
      required: [true, "Class Grade is required"],
      trim: true,
      index: true
    },

    typeOfClass: {
      type: String,
      required: [true, "Type of class is required"],
      trim: true,
      index: true
    },

    yearOnStudy: {
      type: String,
      required: [true, "Year for Study is required"],
      trim: true,
      index: true
    },

    timeStudy: {
      type: String,
      required: [true, "Time for Study is required"],
      enum: {
        values: ["ព្រឹក", "ល្ងាច", "យប់"],
        message: "{VALUE} is not a valid study time"
      },
      index: true
    },

    status: {
      type: String,
      enum: ["active", "finished", "archived"],
      default: "active",
      index: true
    },

    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      default: null,
      index: true
    },

    students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Student"
      }
    ]
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true
    },
    toObject: {
      virtuals: true
    }
  }
);

// Default empty students array
classSchema.path("students").default([]);

// Count students in class
classSchema.virtual("studentCount").get(function () {
  return Array.isArray(this.students) ? this.students.length : 0;
});

// Prevent duplicated class number in same year and study time
classSchema.index(
  {
    classNumber: 1,
    yearOnStudy: 1,
    timeStudy: 1
  },
  {
    unique: true
  }
);

// Useful for teacher role restriction
classSchema.index({
  teacher: 1,
  status: 1
});

// Useful for search/filter
classSchema.index({
  className: 1,
  classGrade: 1,
  yearOnStudy: 1
});

const ClassesModel = mongoose.model("Class", classSchema);

module.exports = ClassesModel;