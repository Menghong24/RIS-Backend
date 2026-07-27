const mongoose = require("mongoose");

const residenceSchema = new mongoose.Schema(
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

/*
  Store only CV file metadata in MongoDB.

  The actual PDF, DOC, or DOCX file should be stored in:
  - local uploads folder
  - cloud storage
  - object storage

  Example:
  /uploads/teacher-cvs/teacher-cv-1719999999999.pdf
*/
const teacherCvSchema = new mongoose.Schema(
  {
    fileUrl: {
      type: String,
      trim: true,
      default: ""
    },

    originalName: {
      type: String,
      trim: true,
      default: ""
    },

    storedName: {
      type: String,
      trim: true,
      default: ""
    },

    mimeType: {
      type: String,
      trim: true,
      default: ""
    },

    fileSize: {
      type: Number,
      min: 0,
      default: 0
    },

    uploadedAt: {
      type: Date,
      default: null
    }
  },
  {
    _id: false
  }
);

const teacherSchema = new mongoose.Schema(
  {
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      // required: [true, "Branch is required"],
      index: true
    },

    khmerName: {
      type: String,
      required: [true, "Khmer name is required"],
      trim: true,
      index: true
    },

    englishName: {
      type: String,
      required: [true, "English name is required"],
      trim: true,
      index: true
    },

    gender: {
      type: String,
      required: [true, "Gender is required"],
      enum: ["ប្រុស", "ស្រី", "other"]
    },

    nationality: {
      type: String,
      required: [true, "Nationality is required"],
      trim: true
    },

    dateOfBirth: {
      type: String,
      required: [true, "Date of birth is required"],
      trim: true
    },

    // Teacher profile image
    // Example:
    // /uploads/teachers/teachers-xxxx-1719999999999.png
    profileImage: {
      type: String,
      trim: true,
      default: ""
    },

    /*
      Teacher CV metadata.

      Example:

      {
        fileUrl: "/uploads/teacher-cvs/teacher-cv-123.pdf",
        originalName: "Sok-Dara-CV.pdf",
        storedName: "teacher-cv-123.pdf",
        mimeType: "application/pdf",
        fileSize: 245678,
        uploadedAt: "2026-07-27T10:30:00.000Z"
      }
    */
    cv: {
      type: teacherCvSchema,
      default: null
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: ""
    },

    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      index: true
    },

    skill: {
      type: String,
      required: [true, "Skill is required"],
      trim: true,
      index: true
    },

    facebook: {
      type: String,
      trim: true,
      default: ""
    },

    telegram: {
      type: String,
      trim: true,
      default: ""
    },

    currentResidence: {
      type: residenceSchema,
      default: {}
    },

    status: {
      type: String,
      enum: [
        "active",
        "disabled",
        "archived"
      ],
      default: "active",
      index: true
    },

    note: {
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

teacherSchema.pre(
  "validate",
  function (next) {
    if (this.khmerName) {
      this.khmerName = String(
        this.khmerName
      ).trim();
    }

    if (this.englishName) {
      this.englishName = String(
        this.englishName
      ).trim();
    }

    if (this.email) {
      this.email = String(
        this.email
      )
        .trim()
        .toLowerCase();
    }

    if (this.phone) {
      this.phone = String(
        this.phone
      ).trim();
    }

    if (this.skill) {
      this.skill = String(
        this.skill
      ).trim();
    }

    next();
  }
);

/*
  Convenient field for frontend/API.

  Example output:

  {
    ...teacher,
    hasCv: true
  }
*/
teacherSchema.virtual("hasCv").get(
  function () {
    return Boolean(
      this.cv?.fileUrl
    );
  }
);

// Fast teacher search inside a branch
teacherSchema.index({
  branch: 1,
  khmerName: 1,
  englishName: 1,
  phone: 1,
  skill: 1
});

// Fast list/filter by branch and status
teacherSchema.index({
  branch: 1,
  status: 1
});

// Prevent duplicated phone numbers
// inside the same branch
teacherSchema.index(
  {
    branch: 1,
    phone: 1
  },
  {
    unique: true,
    name: "unique_teacher_phone_per_branch"
  }
);

const TeacherModel = mongoose.model(
  "Teacher",
  teacherSchema
);

module.exports = TeacherModel;