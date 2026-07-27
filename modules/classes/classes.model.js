const mongoose = require("mongoose");

const STUDY_TIMES = [
  "ព្រឹក",
  "ល្ងាច",
  "យប់"
];

const CLASS_STATUSES = [
  "active",
  "finished",
  "archived"
];

const classSchema = new mongoose.Schema(
  {
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      // required: [true, "Branch is required"],
      index: true
    },

    classNumber: {
      type: Number,
      required: [true, "Class Number is required."],
      min: [1, "Class Number must be greater than 0"]
    },

    className: {
      type: String,
      required: [true, "Class Name is required."],
      trim: true
    },

    classGrade: {
      type: String,
      required: [true, "Class Grade is required"],
      trim: true
    },

    typeOfClass: {
      type: String,
      required: [true, "Type of class is required"],
      trim: true
    },

    yearOnStudy: {
      type: String,
      required: [true, "Year for Study is required"],
      trim: true
    },

    timeStudy: {
      type: String,
      required: [true, "Time for Study is required"],
      enum: {
        values: STUDY_TIMES,
        message: "{VALUE} is not a valid study time"
      }
    },

    status: {
      type: String,
      enum: CLASS_STATUSES,
      default: "active"
    },

    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      default: null,
      index: true
    },

    students: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Student"
        }
      ],
      default: []
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
// Normalize fields
// ======================================================

classSchema.pre("validate", function (next) {
  if (
    this.classNumber !== undefined &&
    this.classNumber !== null &&
    this.classNumber !== ""
  ) {
    this.classNumber = Number(
      this.classNumber
    );
  }

  if (this.className) {
    this.className = String(
      this.className
    ).trim();
  }

  if (this.classGrade) {
    this.classGrade = String(
      this.classGrade
    ).trim();
  }

  if (this.typeOfClass) {
    this.typeOfClass = String(
      this.typeOfClass
    ).trim();
  }

  if (this.yearOnStudy) {
    this.yearOnStudy = String(
      this.yearOnStudy
    ).trim();
  }

  if (this.timeStudy) {
    this.timeStudy = String(
      this.timeStudy
    ).trim();
  }

  if (this.status) {
    this.status = String(
      this.status
    )
      .trim()
      .toLowerCase();
  }

  next();
});

// ======================================================
// Virtual fields
// ======================================================

classSchema.virtual(
  "studentCount"
).get(function () {
  return Array.isArray(this.students)
    ? this.students.length
    : 0;
});

// ======================================================
// Indexes
// ======================================================

/*
  Prevent duplicate class numbers inside the same branch,
  academic year, and study time.
*/
classSchema.index(
  {
    branch: 1,
    classNumber: 1,
    yearOnStudy: 1,
    timeStudy: 1
  },
  {
    unique: true,
    name: "unique_branch_class_number_year_time"
  }
);

// Teacher class lookup inside a branch
classSchema.index(
  {
    branch: 1,
    teacher: 1,
    status: 1
  },
  {
    name: "class_branch_teacher_status_index"
  }
);

// Search and filter by branch
classSchema.index(
  {
    branch: 1,
    className: 1,
    classGrade: 1,
    yearOnStudy: 1,
    status: 1
  },
  {
    name: "class_branch_search_index"
  }
);

// Filter by grade, study time and academic year
classSchema.index(
  {
    branch: 1,
    classGrade: 1,
    yearOnStudy: 1,
    timeStudy: 1,
    status: 1
  },
  {
    name: "class_branch_grade_year_time_index"
  }
);

// Find classes containing a particular student
classSchema.index(
  {
    branch: 1,
    students: 1
  },
  {
    name: "class_branch_students_index"
  }
);

const ClassesModel = mongoose.model(
  "Class",
  classSchema
);

module.exports = ClassesModel;