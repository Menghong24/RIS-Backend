const { default: mongoose } = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },

    schoolYear: {
      type: String,
      required: true,
    },

    date: {
      type: Date,
      required: true,
    },

    session: {
      type: String,
      enum: ["morning", "afternoon", "evening"],
      default: "morning",
    },

    records: [
      {
        student: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Student",
          required: true,
        },

        status: {
          type: String,
          enum: ["present", "absent", "permission", "late"],
          default: "present",
        },

        remark: {
          type: String,
          trim: true,
        },

        checkedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

attendanceSchema.index(
  {
    class: 1,
    date: 1,
    session: 1,
  },
  {
    unique: true,
  }
);
const AttendanceModel = mongoose.model("Attendance", attendanceSchema);
module.exports = AttendanceModel;