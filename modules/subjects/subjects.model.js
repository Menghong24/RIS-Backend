const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema(
  {
    subjectName: {
      type: String,
      required: [true, "Subject name is required"],
      trim: true
    },

    type: {
      type: String,
      enum: ["general", "optional", "skill"],
      default: "general"
    },

    // New: មុខវិជ្ជា ១ អាចភ្ជាប់ច្រើនថ្នាក់
    classIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Class"
      }
    ],

    // Legacy: រក្សាទុកសិន ដើម្បីកុំឱ្យ data ចាស់ខូច
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      default: null
    },

    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      default: null
    },

    fee: {
      type: Number,
      default: 0,
      min: 0
    },

    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active"
    },

    remark: {
      type: String,
      trim: true,
      default: ""
    }
  },
  { timestamps: true }
);

subjectSchema.pre("save", function (next) {
  if (!Array.isArray(this.classIds)) {
    this.classIds = [];
  }

  if (this.classId && this.classIds.length === 0) {
    this.classIds = [this.classId];
  }

  if (!this.classId && this.classIds.length > 0) {
    this.classId = this.classIds[0];
  }

  next();
});

subjectSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  const payload = update.$set || update;

  if (Array.isArray(payload.classIds)) {
    payload.classIds = payload.classIds.filter(Boolean);

    if (payload.classIds.length > 0) {
      payload.classId = payload.classIds[0];
    } else {
      payload.classId = null;
    }
  }

  if (update.$set) {
    update.$set = payload;
  } else {
    this.setUpdate(payload);
  }

  next();
});

module.exports = mongoose.model("Subject", subjectSchema);