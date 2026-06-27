const mongoose = require("mongoose");

// Sub-schema for Address (Reused for PlaceOfBirth and CurrentResidence)
const locationSchema = new mongoose.Schema(
  {
    village: { type: String, trim: true,  },
    commune: { type: String, trim: true,  },
    district: { type: String, trim: true,  },
    province: { type: String, trim: true,  },
  },
  { _id: false } // We don't need a unique ID for every address sub-document
);

const studentSchema = new mongoose.Schema(
  {
    // Identity
    khmerName: {
      type: String,
      required: [true, "Khmer name is required."],
      trim: true,
      index: true, // Indexed for faster search
    },
    englishName: {
      type: String,
      required: [true, "English name is required."],
      trim: true,
      index: true,
    },
    studentId: {
      type: String,
      unique: true, // Ensures no two students have the same ID
      required: [true, "Student ID is required."],
      trim: true,
    },
    gender: {
      type: String,
      required: [true, "Gender is required."],
      enum: ["ស្រី", "ប្រុស", "Other"],
    },
    birthDate: {
      type: Date,
      required: [true, "Birth date is required."],
    },

    // Relationships
    grade: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      // required: [true, "Class/Grade assignment is required"],
    },
   
    joinDate: {
    type: Date,
    required: [true, "It is required."],
    },

    // Detailed Info
    nationality: {
      student: { type: String, default: "ខ្មែរ", trim: true },
     
    },


    // Using the Sub-schema defined above
    placeOfBirth: {
      type: locationSchema,
      // required: [true, "Place of birth is required"],
    },
    currentResidence: {
      type: locationSchema,
      required: [true, "Current residence is required"],
    },

    family: {
      motherFacebook: { type: String, trim: true },
      motherName: { type: String,  trim: true },
      
      motherNumber: { type: String, trim: true },
    },

    status: {
      type: String,
      enum: ["active", "suspended", "dropped", "graduated"],
      default: "active",
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// --- VIRTUALS (Calculated Fields) ---

// 1. Calculate Age automatically
studentSchema.virtual("age").get(function () {
  if (!this.birthDate) return null;
  const today = new Date();
  const birthDate = new Date(this.birthDate);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

// 2. Full Searchable String (Optional helper)
studentSchema.virtual("fullSearchText").get(function () {
  return `${this.khmerName} ${this.englishName} ${this.studentId}`;
});

const StudentModel = mongoose.model("Student", studentSchema);
module.exports = StudentModel;