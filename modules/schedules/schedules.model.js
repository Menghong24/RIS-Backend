const mongoose = require("mongoose");

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday"
];

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const classScheduleSchema = new mongoose.Schema(
  {
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      // required: [true, "Branch is required"],
      index: true
    },

    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: [true, "Class is required"],
      index: true
    },

    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: [true, "Subject is required"],
      index: true
    },

    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      default: null,
      index: true
    },

    day: {
      type: String,
      enum: DAYS,
      required: [true, "Day is required"],
      default: "Monday",
      index: true
    },

    startTime: {
      type: String,
      required: [true, "Start time is required"],
      default: "07:00",
      trim: true,
      match: [
        TIME_PATTERN,
        "Start time must use HH:mm format"
      ]
    },

    endTime: {
      type: String,
      required: [true, "End time is required"],
      default: "08:00",
      trim: true,
      match: [
        TIME_PATTERN,
        "End time must use HH:mm format"
      ]
    },

    room: {
      type: String,
      default: "A1",
      trim: true,
      index: true
    },

    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active",
      index: true
    },

    academicYear: {
      type: String,
      default: () => {
        const year = new Date().getFullYear();
        return `${year}-${year + 1}`;
      },
      trim: true,
      index: true
    },

    remark: {
      type: String,
      trim: true,
      default: ""
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

classScheduleSchema.pre("validate", function (next) {
  if (this.startTime) {
    this.startTime = String(this.startTime).trim();
  }

  if (this.endTime) {
    this.endTime = String(this.endTime).trim();
  }

  if (this.room) {
    this.room = String(this.room).trim();
  }

  if (this.academicYear) {
    this.academicYear = String(
      this.academicYear
    ).trim();
  }

  if (
    TIME_PATTERN.test(this.startTime || "") &&
    TIME_PATTERN.test(this.endTime || "") &&
    this.startTime >= this.endTime
  ) {
    this.invalidate(
      "endTime",
      "End time must be later than start time"
    );
  }

  next();
});

// Fast class schedule lookup
classScheduleSchema.index({
  branch: 1,
  class: 1,
  academicYear: 1,
  day: 1,
  status: 1
});

// Fast teacher schedule lookup
classScheduleSchema.index({
  branch: 1,
  teacher: 1,
  academicYear: 1,
  day: 1,
  status: 1
});

// Fast room schedule lookup
classScheduleSchema.index({
  branch: 1,
  room: 1,
  academicYear: 1,
  day: 1,
  status: 1
});

// Fast subject schedule lookup
classScheduleSchema.index({
  branch: 1,
  subject: 1,
  academicYear: 1,
  status: 1
});

/*
  Prevent an exact duplicate schedule record.

  This does not detect partial time overlaps such as:
  07:00-08:00 and 07:30-08:30.

  Time-overlap validation should be handled
  inside schedules.controller.js.
*/
classScheduleSchema.index(
  {
    branch: 1,
    class: 1,
    subject: 1,
    day: 1,
    startTime: 1,
    endTime: 1,
    academicYear: 1
  },
  {
    unique: true,
    name: "unique_exact_class_schedule"
  }
);

module.exports = mongoose.model(
  "ClassSchedule",
  classScheduleSchema
);