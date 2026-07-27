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

    /*
      admin + branch = Admin ប្រចាំសាខា
      admin + branch null = Global Admin
      teacher/user ត្រូវតែមាន branch
    */
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
      index: true
    },

    // ប្រើសម្រាប់ role teacher
    // User ម្នាក់ភ្ជាប់ទៅ Teacher profile ម្នាក់
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

usersSchema.pre("validate", function (next) {
  const role = String(this.role || "")
    .trim()
    .toLowerCase();

  this.role = role;

  // Teacher account ត្រូវភ្ជាប់ Teacher profile
  if (role === "teacher" && !this.teacher) {
    this.invalidate(
      "teacher",
      "Teacher account must be linked to a teacher profile"
    );
  }

  // Admin និង User មិនត្រូវមាន Teacher profile
  if (role !== "teacher") {
    this.teacher = null;
  }

  /*
    Global admin អាចគ្មាន branch

    Branch admin:
      role = admin
      branch = branch ID

    Teacher និង User ត្រូវតែមាន branch
  */
  if (role !== "admin" && !this.branch) {
    this.invalidate(
      "branch",
      "This account must be linked to a branch"
    );
  }

  next();
});

// Query លឿនសម្រាប់ user list/filter
usersSchema.index({
  role: 1,
  isActive: 1
});

// Query users តាមសាខា និង role
usersSchema.index({
  branch: 1,
  role: 1,
  isActive: 1
});

exports.UserModel = mongoose.model("User", usersSchema);