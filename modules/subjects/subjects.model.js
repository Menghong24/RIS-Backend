const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema(
  {
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      // required: [true, "Branch is required"],
      index: true
    },

    subjectName: {
      type: String,
      required: [true, "Subject name is required"],
      trim: true,
      index: true
    },

    type: {
      type: String,
      enum: ["general", "optional", "skill"],
      default: "general",
      index: true
    },

    // មុខវិជ្ជា ១ អាចភ្ជាប់ទៅថ្នាក់ច្រើន
    classIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Class"
        }
      ],
      default: []
    },

    // Legacy field សម្រាប់រក្សា compatibility ជាមួយ code ចាស់
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      default: null
    },

    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      default: null,
      index: true
    },

    fee: {
      type: Number,
      default: 0,
      min: [0, "Fee cannot be negative"]
    },

    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active",
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

// Remove empty and duplicate class IDs
const normalizeClassIds = (classIds = []) => {
  if (!Array.isArray(classIds)) {
    return [];
  }

  const uniqueIds = new Map();

  classIds
    .filter(Boolean)
    .forEach((classId) => {
      const value = String(classId?._id || classId).trim();

      if (mongoose.Types.ObjectId.isValid(value)) {
        uniqueIds.set(value, classId);
      }
    });

  return Array.from(uniqueIds.values());
};

// Synchronize classIds and legacy classId before validation
subjectSchema.pre("validate", function (next) {
  if (this.subjectName) {
    this.subjectName = String(this.subjectName).trim();
  }

  if (this.remark) {
    this.remark = String(this.remark).trim();
  }

  this.classIds = normalizeClassIds(this.classIds);

  if (this.classIds.length > 0) {
    // Legacy classId always mirrors the first class
    this.classId = this.classIds[0];
  } else if (this.classId) {
    // Support old requests that only send classId
    this.classIds = [this.classId];
  } else {
    this.classId = null;
  }

  next();
});

// Synchronize fields when using findOneAndUpdate
subjectSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};

  const setData = update.$set
    ? { ...update.$set }
    : { ...update };

  if (Object.prototype.hasOwnProperty.call(setData, "classIds")) {
    setData.classIds = normalizeClassIds(setData.classIds);

    setData.classId =
      setData.classIds.length > 0
        ? setData.classIds[0]
        : null;
  } else if (
    Object.prototype.hasOwnProperty.call(setData, "classId")
  ) {
    if (setData.classId) {
      setData.classIds = [setData.classId];
    } else {
      setData.classId = null;
      setData.classIds = [];
    }
  }

  if (setData.subjectName !== undefined) {
    setData.subjectName = String(
      setData.subjectName || ""
    ).trim();
  }

  if (setData.remark !== undefined) {
    setData.remark = String(
      setData.remark || ""
    ).trim();
  }

  /*
    Always use $set so calculated legacy fields are included.
    Preserve other operators such as $unset.
  */
  this.setUpdate({
    ...update,
    $set: setData
  });

  next();
});

// Fast list and search by branch
subjectSchema.index({
  branch: 1,
  status: 1,
  subjectName: 1
});

// Fast teacher subject report inside a branch
subjectSchema.index({
  branch: 1,
  teacher: 1,
  status: 1
});

// Fast class subject lookup
subjectSchema.index({
  branch: 1,
  classIds: 1,
  status: 1
});

// Optional: prevent duplicate subject names in the same branch
subjectSchema.index(
  {
    branch: 1,
    subjectName: 1
  },
  {
    unique: true,
    name: "unique_subject_name_per_branch",
    collation: {
      locale: "en",
      strength: 2
    }
  }
);

module.exports = mongoose.model(
  "Subject",
  subjectSchema
);