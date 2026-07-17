const mongoose = require("mongoose");

const attendanceRecordSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: [true, "Student is required"],
      index: true
    },

    status: {
      type: String,
      enum: ["present", "absent", "permission", "late"],
      default: "present",
      index: true
    },

    remark: {
      type: String,
      trim: true,
      default: ""
    },

    checkedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    _id: false
  }
);

const attendanceSchema = new mongoose.Schema(
  {
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: [true, "Class is required"],
      index: true
    },

    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      default: null,
      index: true
    },

    schoolYear: {
      type: String,
      required: [true, "School year is required"],
      trim: true,
      index: true
    },

    date: {
      type: Date,
      required: [true, "Date is required"],
      index: true
    },

    session: {
      type: String,
      enum: ["morning", "afternoon", "evening"],
      default: "morning",
      index: true
    },

    records: {
      type: [attendanceRecordSchema],
      default: []
    },

    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    }
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

attendanceSchema.pre("validate", function (next) {
  if (!this.schoolYear && this.date) {
    const year = new Date(this.date).getFullYear();
    this.schoolYear = `${year}-${year + 1}`;
  }

  next();
});

attendanceSchema.index(
  {
    class: 1,
    date: 1,
    session: 1
  },
  {
    unique: true
  }
);

// Fast report by class/date/session
attendanceSchema.index({
  class: 1,
  date: 1,
  session: 1
});

// Fast teacher report
attendanceSchema.index({
  teacher: 1,
  date: 1,
  session: 1
});

// Fast school year report
attendanceSchema.index({
  class: 1,
  schoolYear: 1,
  date: 1
});

const AttendanceModel = mongoose.model("Attendance", attendanceSchema);

module.exports = AttendanceModel;