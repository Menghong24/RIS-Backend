const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true
    },

    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
      index: true
    },

    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      index: true
    },

    // YYYY-MM format: 2026-06
    paymentMonth: {
      type: String,
      required: true,
      trim: true,
      index: true
    },

    // ថ្ងៃត្រូវបង់ប្រាក់
    dueDate: {
      type: Date,
      required: true,
      index: true
    },

    // ថ្ងៃបានបង់ប្រាក់
    payDate: {
      type: Date,
      index: true
    },

    // ថ្លៃសិក្សា
    tuitionFee: {
      type: Number,
      min: 0,
      default: 0
    },

    // សេវាបន្ថែម
    extraFee: {
      type: Number,
      min: 0,
      default: 0
    },

    // ចំនួនត្រូវបង់សរុប = tuitionFee + extraFee
    expectedAmount: {
      type: Number,
      min: 0,
      default: 0
    },

    // ចំនួនបានបង់
    paidAmount: {
      type: Number,
      min: 0,
      default: 0
    },

    // រក្សា amount សម្រាប់ code ចាស់
    // amount = paidAmount
    amount: {
      type: Number,
      min: 0,
      default: 0
    },

    // ចំនួននៅខ្វះ = expectedAmount - paidAmount
    balance: {
      type: Number,
      min: 0,
      default: 0
    },

    status: {
      type: String,
      enum: ["unpaid", "paid", "late", "partial"],
      default: "unpaid",
      index: true
    },

    remark: {
      type: String,
      trim: true,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

const calculatePayment = function () {
  const tuitionFee = Number(this.tuitionFee || 0);
  const extraFee = Number(this.extraFee || 0);

  this.expectedAmount = tuitionFee + extraFee;

  // បើ frontend ផ្ញើ paidAmount ប្រើ paidAmount
  // បើ frontend ចាស់ផ្ញើ amount ប្រើ amount
  const paidAmount = Number(this.paidAmount || this.amount || 0);

  this.paidAmount = paidAmount;
  this.amount = paidAmount;

  this.balance = Math.max(this.expectedAmount - this.paidAmount, 0);

  const today = new Date();
  const dueDate = this.dueDate ? new Date(this.dueDate) : null;

  if (this.paidAmount <= 0) {
    this.status = dueDate && today > dueDate ? "late" : "unpaid";
    this.payDate = undefined;
  } else if (this.balance > 0) {
    this.status = "partial";
    if (!this.payDate) this.payDate = today;
  } else {
    this.status = "paid";
    this.balance = 0;
    if (!this.payDate) this.payDate = today;
  }
};

paymentSchema.pre("save", function (next) {
  calculatePayment.call(this);
  next();
});

paymentSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  const data = update.$set || update;

  const tuitionFee = Number(data.tuitionFee || 0);
  const extraFee = Number(data.extraFee || 0);
  const expectedAmount = tuitionFee + extraFee;

  const paidAmount = Number(data.paidAmount || data.amount || 0);
  const balance = Math.max(expectedAmount - paidAmount, 0);

  data.expectedAmount = expectedAmount;
  data.paidAmount = paidAmount;
  data.amount = paidAmount;
  data.balance = balance;

  const today = new Date();
  const dueDate = data.dueDate ? new Date(data.dueDate) : null;

  if (paidAmount <= 0) {
    data.status = dueDate && today > dueDate ? "late" : "unpaid";
    data.payDate = undefined;
  } else if (balance > 0) {
    data.status = "partial";
    if (!data.payDate) data.payDate = today;
  } else {
    data.status = "paid";
    data.balance = 0;
    if (!data.payDate) data.payDate = today;
  }

  if (update.$set) {
    update.$set = data;
  } else {
    this.setUpdate(data);
  }

  next();
});

// មិនអនុញ្ញាតឱ្យសិស្សម្នាក់បង់ស្ទួនក្នុងថ្នាក់ និងខែដូចគ្នា
paymentSchema.index(
  {
    student: 1,
    class: 1,
    paymentMonth: 1
  },
  {
    unique: true
  }
);

// Query លឿនសម្រាប់ report
paymentSchema.index({
  class: 1,
  paymentMonth: 1,
  status: 1
});

module.exports = mongoose.model("Payment", paymentSchema);