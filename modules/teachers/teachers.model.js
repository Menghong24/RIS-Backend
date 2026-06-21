const mongoose = require("mongoose");

const teacherSchema = new mongoose.Schema(
  {
    // --- Removed the outer 'teacher' wrapper for easier access ---
    
    khmerName: {
      type: String,
      required: [true, "Khmer name is required"],
    },
    englishName: {
      type: String,
      required: [true, "English name is required"],
    },
    gender: {
      type: String,
      required: [true, "Gender is required"],
      enum: ["ប្រុស", "ស្រី", "other"],
    },
    nationality: {
      type: String,
      required: [true, "Nationality is required"],
    },
    dateOfBirth: {
      type: String, // Or Date if you prefer
      required: [true, "Date of birth is required"],
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String, // CHANGED: Number removes leading 0s (e.g., 012 -> 12). String keeps them.
      required: [true, "Phone number is required"],
    },
    skill: {
      type: String,
      required: [true, "Skill is required"],
    },
    facebook: {
      type: String,
    },
    telegram: {
      type: String,
    },
    currentResidence: {
      village: { type: String },
      commune: { type: String },
      district: { type: String },
      province: { type: String },
    },
    note: {
      type: String,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

const TeacherModel = mongoose.model("Teacher", teacherSchema);
module.exports = TeacherModel;