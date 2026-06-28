const mongoose = require("mongoose");

const usersSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      trim: true,
      unique: true,
      lowercase: true
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      select: false
    },

    role: {
      type: String,
      enum: ["admin", "teacher", "user"],
      default: "user",
      index: true
    },

    // ប្រើសម្រាប់ role teacher
    // user ម្នាក់ភ្ជាប់ទៅ teacher profile ម្នាក់
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      default: null,
      index: true
    },

    // រូប Profile របស់ user
    // ឧទាហរណ៍: /uploads/profiles/profile-USERID-1719999999999.png
    profileImage: {
      type: String,
      trim: true,
      default: ""
    },

    isActive: {
      type: Boolean,
      default: true,
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

// បើ role = teacher ត្រូវមាន teacher id
usersSchema.pre("validate", function (next) {
  if (this.role === "teacher" && !this.teacher) {
    this.invalidate(
      "teacher",
      "Teacher account must be linked to a teacher profile"
    );
  }

  if (this.role !== "teacher") {
    this.teacher = null;
  }

  next();
});

// Query លឿនសម្រាប់ user list/filter
usersSchema.index({
  role: 1,
  isActive: 1
});

exports.UserModel = mongoose.model("User", usersSchema);