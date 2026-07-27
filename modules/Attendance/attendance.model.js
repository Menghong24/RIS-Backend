const mongoose = require("mongoose");

const ATTENDANCE_STATUSES = [
  "present",
  "absent",
  "permission",
  "late"
];

const ATTENDANCE_SESSIONS = [
  "morning",
  "afternoon",
  "evening"
];

const getSchoolYearFromDate = (
  value = new Date()
) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getUTCFullYear();

  return `${year}-${year + 1}`;
};

const normalizeAttendanceDate = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  /*
    Store attendance dates at UTC midnight so records
    for the same calendar date use the same value.
  */
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate()
    )
  );
};

// ======================================================
// Attendance record
// ======================================================

const attendanceRecordSchema =
  new mongoose.Schema(
    {
      student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Student",
        required: [
          true,
          "Student is required"
        ]
      },

      status: {
        type: String,
        enum: ATTENDANCE_STATUSES,
        default: "present"
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

attendanceRecordSchema.pre(
  "validate",
  function (next) {
    if (this.status) {
      this.status = String(
        this.status
      )
        .trim()
        .toLowerCase();
    }

    if (this.remark) {
      this.remark = String(
        this.remark
      ).trim();
    }

    next();
  }
);

// ======================================================
// Attendance document
// ======================================================

const attendanceSchema =
  new mongoose.Schema(
    {
      branch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Branch",
        // required: [
        //   true,
        //   "Branch is required"
        // ],
        index: true
      },

      class: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Class",
        required: [
          true,
          "Class is required"
        ],
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
        required: [
          true,
          "School year is required"
        ],
        trim: true,
        index: true
      },

      date: {
        type: Date,
        required: [
          true,
          "Date is required"
        ],
        index: true
      },

      session: {
        type: String,
        enum: ATTENDANCE_SESSIONS,
        default: "morning",
        index: true
      },

      records: {
        type: [attendanceRecordSchema],
        default: [],
        validate: {
          validator(records) {
            if (!Array.isArray(records)) {
              return true;
            }

            const studentIds = records
              .map((record) =>
                String(
                  record?.student || ""
                )
              )
              .filter(Boolean);

            return (
              studentIds.length ===
              new Set(studentIds).size
            );
          },
          message:
            "A student cannot appear more than once in the same attendance record"
        }
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
      strict: true,
      toJSON: {
        virtuals: true
      },
      toObject: {
        virtuals: true
      }
    }
  );

// ======================================================
// Normalize data
// ======================================================

attendanceSchema.pre(
  "validate",
  function (next) {
    if (this.date) {
      this.date =
        normalizeAttendanceDate(
          this.date
        );
    }

    if (!this.schoolYear && this.date) {
      this.schoolYear =
        getSchoolYearFromDate(
          this.date
        );
    }

    if (this.schoolYear) {
      this.schoolYear = String(
        this.schoolYear
      ).trim();
    }

    if (this.session) {
      this.session = String(
        this.session
      )
        .trim()
        .toLowerCase();
    }

    next();
  }
);

// ======================================================
// Virtual statistics
// ======================================================

attendanceSchema.virtual(
  "totalStudents"
).get(function () {
  return Array.isArray(this.records)
    ? this.records.length
    : 0;
});

attendanceSchema.virtual(
  "presentCount"
).get(function () {
  return Array.isArray(this.records)
    ? this.records.filter(
        (record) =>
          record.status === "present"
      ).length
    : 0;
});

attendanceSchema.virtual(
  "absentCount"
).get(function () {
  return Array.isArray(this.records)
    ? this.records.filter(
        (record) =>
          record.status === "absent"
      ).length
    : 0;
});

attendanceSchema.virtual(
  "permissionCount"
).get(function () {
  return Array.isArray(this.records)
    ? this.records.filter(
        (record) =>
          record.status ===
          "permission"
      ).length
    : 0;
});

attendanceSchema.virtual(
  "lateCount"
).get(function () {
  return Array.isArray(this.records)
    ? this.records.filter(
        (record) =>
          record.status === "late"
      ).length
    : 0;
});

// ======================================================
// Indexes
// ======================================================

/*
  Only one attendance sheet is allowed for the same:

  branch + class + date + session
*/
attendanceSchema.index(
  {
    branch: 1,
    class: 1,
    date: 1,
    session: 1
  },
  {
    unique: true,
    name:
      "unique_branch_class_date_session_attendance"
  }
);

// Fast class attendance reports
attendanceSchema.index(
  {
    branch: 1,
    class: 1,
    schoolYear: 1,
    date: -1,
    session: 1
  },
  {
    name:
      "attendance_branch_class_year_date_index"
  }
);

// Fast teacher attendance reports
attendanceSchema.index(
  {
    branch: 1,
    teacher: 1,
    schoolYear: 1,
    date: -1
  },
  {
    name:
      "attendance_branch_teacher_year_date_index"
  }
);

// Fast student attendance history
attendanceSchema.index(
  {
    branch: 1,
    "records.student": 1,
    date: -1
  },
  {
    name:
      "attendance_branch_student_date_index"
  }
);

// Fast reports by attendance status
attendanceSchema.index(
  {
    branch: 1,
    "records.status": 1,
    date: -1
  },
  {
    name:
      "attendance_branch_status_date_index"
  }
);

// Fast lookup by the user who marked attendance
attendanceSchema.index(
  {
    branch: 1,
    markedBy: 1,
    date: -1
  },
  {
    name:
      "attendance_branch_marked_by_date_index"
  }
);

const AttendanceModel = mongoose.model(
  "Attendance",
  attendanceSchema
);

module.exports = AttendanceModel;