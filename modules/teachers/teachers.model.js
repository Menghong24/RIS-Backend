const mongoose = require("mongoose");

const residenceSchema = new mongoose.Schema(
  {
    village: {
      type: String,
      trim: true
    },
    commune: {
      type: String,
      trim: true
    },
    district: {
      type: String,
      trim: true
    },
    province: {
      type: String,
      trim: true
    }
  },
  {
    _id: false
  }
);

const teacherSchema = new mongoose.Schema(
  {
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

    // រូប Profile គ្រូ
    // Example: /uploads/teachers/teachers-xxxx-1719999999999.png
    profileImage: {
      type: String,
      trim: true,
      default: ""
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

teacherSchema.index({
  khmerName: 1,
  englishName: 1,
  phone: 1,
  skill: 1
});

const TeacherModel = mongoose.model("Teacher", teacherSchema);

module.exports = TeacherModel;