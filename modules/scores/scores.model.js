const mongoose = require("mongoose");

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

const getDefaultAcademicYear = () => {
  const year = new Date().getFullYear();

  return `${year}-${year + 1}`;
};

const scoreSchema = new mongoose.Schema(
  {
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      // required: [true, "Branch is required"],
      index: true
    },

    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: [true, "Student is required"],
      index: true,
      alias: "studentId"
    },

    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: [true, "Class is required"],
      index: true,
      alias: "classId"
    },

    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: [true, "Subject is required"],
      index: true,
      alias: "subjectId"
    },

    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      default: null,
      index: true
    },

    year: {
      type: String,
      default: getDefaultAcademicYear,
      trim: true,
      index: true,
      alias: "academicYear"
    },

    month: {
      type: String,
      required: [true, "Month is required"],
      enum: MONTHS,
      index: true
    },

    semester: {
      type: String,
      default: "Semester 1",
      trim: true
    },

    examType: {
      type: String,
      enum: ["monthly", "semester", "final"],
      default: "monthly",
      index: true
    },

    score: {
      type: Number,
      required: [true, "Score is required"],
      min: [0, "Score cannot be less than 0"],
      max: [100, "Score cannot be greater than 100"]
    },

    remark: {
      type: String,
      default: "",
      trim: true
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

// Normalize values before validation
scoreSchema.pre("validate", function (next) {
  if (this.year) {
    this.year = String(this.year).trim();
  }

  if (this.semester) {
    this.semester = String(this.semester).trim();
  }

  if (this.remark) {
    this.remark = String(this.remark).trim();
  }

  if (
    this.score !== undefined &&
    this.score !== null &&
    this.score !== ""
  ) {
    this.score = Number(this.score);
  }

  next();
});

/*
  Prevent duplicate score records inside the same branch.

  A student can have only one score for the same:
  branch + class + subject + month + year + exam type.
*/
scoreSchema.index(
  {
    branch: 1,
    student: 1,
    class: 1,
    subject: 1,
    month: 1,
    year: 1,
    examType: 1
  },
  {
    unique: true,
    name: "unique_branch_student_class_subject_month_year_exam"
  }
);

// Fast report by branch, class, month and year
scoreSchema.index(
  {
    branch: 1,
    class: 1,
    year: 1,
    month: 1,
    examType: 1
  },
  {
    name: "score_branch_class_year_month_exam_index"
  }
);

// Fast report by subject inside a branch
scoreSchema.index(
  {
    branch: 1,
    subject: 1,
    year: 1,
    month: 1,
    examType: 1
  },
  {
    name: "score_branch_subject_year_month_exam_index"
  }
);

// Fast student score history inside a branch
scoreSchema.index(
  {
    branch: 1,
    student: 1,
    year: -1,
    month: 1
  },
  {
    name: "score_branch_student_history_index"
  }
);

// Fast teacher report inside a branch
scoreSchema.index(
  {
    branch: 1,
    teacher: 1,
    year: 1,
    month: 1
  },
  {
    name: "score_branch_teacher_year_month_index"
  }
);

module.exports = mongoose.model(
  "Score",
  scoreSchema
);