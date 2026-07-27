const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
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

const branchSchema = new mongoose.Schema(
  {
    branchCode: {
      type: String,
      required: [true, "Branch code is required"],
      trim: true,
      uppercase: true,
      unique: true,
      match: [
        /^[A-Z0-9_-]+$/,
        "Branch code may only contain letters, numbers, hyphens and underscores"
      ]
    },

    branchName: {
      type: String,
      required: [true, "Branch name is required"],
      trim: true,
      index: true
    },

    phone: {
      type: String,
      trim: true,
      default: ""
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      match: [
        /^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Email address is not valid"
      ]
    },

    address: {
      type: addressSchema,
      default: {}
    },

    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },

    status: {
      type: String,
      enum: ["active", "disabled", "archived"],
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

branchSchema.pre("validate", function (next) {
  if (this.branchCode) {
    this.branchCode = String(this.branchCode)
      .trim()
      .toUpperCase();
  }

  if (this.branchName) {
    this.branchName = String(this.branchName).trim();
  }

  next();
});

// Fast searching and filtering
branchSchema.index({
  branchName: 1,
  status: 1
});

const BranchModel = mongoose.model("Branch", branchSchema);

module.exports = BranchModel;