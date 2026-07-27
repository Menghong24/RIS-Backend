const mongoose = require("mongoose");

// Sub-schema for address
const locationSchema = new mongoose.Schema(
  {
    village: {
      type: String,
      trim: true,
      default: ""
    },

    commune: {
      type: String,
      trim: true,
      default: ""
    },

    district: {
      type: String,
      trim: true,
      default: ""
    },

    province: {
      type: String,
      trim: true,
      default: ""
    }
  },
  {
    _id: false
  }
);

const studentSchema = new mongoose.Schema(
  {
    // សាខាដែលសិស្សកំពុងសិក្សា
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      // required: [true, "Branch is required"],
      index: true
    },

    // Identity
    khmerName: {
      type: String,
      required: [true, "Khmer name is required."],
      trim: true,
      index: true
    },

    englishName: {
      type: String,
      required: [true, "English name is required."],
      trim: true,
      index: true
    },

    studentId: {
      type: String,
      required: [true, "Student ID is required."],
      trim: true,
      uppercase: true
    },

    gender: {
      type: String,
      required: [true, "Gender is required."],
      enum: ["ស្រី", "ប្រុស", "Other"]
    },

    birthDate: {
      type: Date,
      required: [true, "Birth date is required."]
    },

    // រូបសិស្ស
    // Example: /uploads/students/students-xxxx-1719999999999.png
    profileImage: {
      type: String,
      trim: true,
      default: ""
    },

    // Class relationship
    grade: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      default: null,
      index: true
    },

    joinDate: {
      type: Date,
      required: [true, "Join date is required."]
    },

    nationality: {
      student: {
        type: String,
        default: "ខ្មែរ",
        trim: true
      }
    },

    currentResidence: {
      type: locationSchema,
      required: [true, "Current residence is required"]
    },

    family: {
      motherFacebook: {
        type: String,
        trim: true,
        default: ""
      },

      motherName: {
        type: String,
        trim: true,
        default: ""
      },

      motherNumber: {
        type: String,
        trim: true,
        default: ""
      }
    },

    status: {
      type: String,
      enum: [
        "active",
        "suspended",
        "dropped",
        "graduated"
      ],
      default: "active",
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

// Normalize data before validation
studentSchema.pre("validate", function (next) {
  if (this.khmerName) {
    this.khmerName = String(this.khmerName).trim();
  }

  if (this.englishName) {
    this.englishName = String(this.englishName).trim();
  }

  if (this.studentId) {
    this.studentId = String(this.studentId)
      .trim()
      .toUpperCase();
  }

  next();
});

// Calculate age automatically
studentSchema.virtual("age").get(function () {
  if (!this.birthDate) {
    return null;
  }

  const today = new Date();
  const birthDate = new Date(this.birthDate);

  let age =
    today.getFullYear() - birthDate.getFullYear();

  const monthDiff =
    today.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 &&
      today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age;
});

// Full searchable string
studentSchema.virtual("fullSearchText").get(function () {
  return [
    this.khmerName,
    this.englishName,
    this.studentId
  ]
    .filter(Boolean)
    .join(" ");
});

/*
  Prevent duplicate Student ID inside the same branch.

  Example:
  Branch A can have ST001
  Branch B can also have ST001
*/
studentSchema.index(
  {
    branch: 1,
    studentId: 1
  },
  {
    unique: true,
    name: "unique_student_id_per_branch"
  }
);

// Fast search inside a branch
studentSchema.index({
  branch: 1,
  khmerName: 1,
  englishName: 1,
  studentId: 1
});

// Fast class and status filtering
studentSchema.index({
  branch: 1,
  grade: 1,
  status: 1
});

// Fast student list by branch and status
studentSchema.index({
  branch: 1,
  status: 1,
  createdAt: -1
});

const StudentModel = mongoose.model(
  "Student",
  studentSchema
);

module.exports = StudentModel;