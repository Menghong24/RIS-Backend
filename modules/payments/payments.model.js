const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: [true, "Student is required"],
      index: true
    },

    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: [true, "Class is required"],
      index: true
    },

    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      index: true,
      default: null
    },

    // YYYY-MM format: 2026-06
    paymentMonth: {
      type: String,
      required: [true, "Payment month is required"],
      trim: true,
      match: [/^\d{4}-(0[1-9]|1[0-2])$/, "Payment month must be YYYY-MM"],
      index: true
    },

    // ថ្ងៃត្រូវបង់ប្រាក់
    dueDate: {
      type: Date,
      required: [true, "Due date is required"],
      index: true
    },

    // ថ្ងៃបានបង់ប្រាក់
    payDate: {
      type: Date,
      index: true,
      default: null
    },

    // ថ្លៃសិក្សា
    tuitionFee: {
      type: Number,
      min: [0, "Tuition fee cannot be negative"],
      default: 0
    },

    // សេវាបន្ថែម
    extraFee: {
      type: Number,
      min: [0, "Extra fee cannot be negative"],
      default: 0
    },

    // ចំនួនត្រូវបង់សរុប = tuitionFee + extraFee
    expectedAmount: {
      type: Number,
      min: [0, "Expected amount cannot be negative"],
      default: 0
    },

    // ចំនួនបានបង់
    paidAmount: {
      type: Number,
      min: [0, "Paid amount cannot be negative"],
      default: 0
    },

    // រក្សា amount សម្រាប់ code ចាស់
    // amount = paidAmount
    amount: {
      type: Number,
      min: [0, "Amount cannot be negative"],
      default: 0
    },

    // ចំនួននៅខ្វះ = expectedAmount - paidAmount
    balance: {
      type: Number,
      min: [0, "Balance cannot be negative"],
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
    timestamps: true,
    toJSON: {
      virtuals: true
    },
    toObject: {
      virtuals: true
    }
  }
);

const startOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const normalizeMoney = (value) => {
  const number = Number(value || 0);

  if (Number.isNaN(number)) {
    return 0;
  }

  return Math.max(number, 0);
};

const calculateStatus = ({ paidAmount, balance, dueDate }) => {
  const today = startOfDay(new Date());
  const due = dueDate ? startOfDay(dueDate) : null;

  if (paidAmount <= 0) {
    return due && today > due ? "late" : "unpaid";
  }

  if (balance > 0) {
    return "partial";
  }

  return "paid";
};

const calculatePaymentValues = ({
  tuitionFee,
  extraFee,
  paidAmount,
  amount,
  dueDate
}) => {
  const safeTuitionFee = normalizeMoney(tuitionFee);
  const safeExtraFee = normalizeMoney(extraFee);
  const expectedAmount = safeTuitionFee + safeExtraFee;

  const rawPaidAmount =
    paidAmount !== undefined
      ? paidAmount
      : amount !== undefined
        ? amount
        : 0;

  const safePaidAmount = normalizeMoney(rawPaidAmount);
  const finalPaidAmount = Math.min(safePaidAmount, expectedAmount);

  const balance = Math.max(expectedAmount - finalPaidAmount, 0);

  const status = calculateStatus({
    paidAmount: finalPaidAmount,
    balance,
    dueDate
  });

  return {
    tuitionFee: safeTuitionFee,
    extraFee: safeExtraFee,
    expectedAmount,
    paidAmount: finalPaidAmount,
    amount: finalPaidAmount,
    balance: status === "paid" ? 0 : balance,
    status
  };
};

const applyPaymentCalculationToDoc = function () {
  const calculated = calculatePaymentValues({
    tuitionFee: this.tuitionFee,
    extraFee: this.extraFee,
    paidAmount: this.paidAmount,
    amount: this.amount,
    dueDate: this.dueDate
  });

  this.tuitionFee = calculated.tuitionFee;
  this.extraFee = calculated.extraFee;
  this.expectedAmount = calculated.expectedAmount;
  this.paidAmount = calculated.paidAmount;
  this.amount = calculated.amount;
  this.balance = calculated.balance;
  this.status = calculated.status;

  if (calculated.paidAmount <= 0) {
    this.payDate = null;
  } else if (!this.payDate) {
    this.payDate = new Date();
  }
};

paymentSchema.pre("validate", function (next) {
  applyPaymentCalculationToDoc.call(this);
  next();
});

paymentSchema.pre("save", function (next) {
  applyPaymentCalculationToDoc.call(this);
  next();
});

paymentSchema.pre("findOneAndUpdate", async function (next) {
  try {
    const update = this.getUpdate() || {};
    const setData = update.$set ? { ...update.$set } : { ...update };
    const unsetData = update.$unset ? { ...update.$unset } : {};

    const oldDoc = await this.model.findOne(this.getQuery()).lean();

    if (!oldDoc) {
      return next();
    }

    const tuitionFee =
      setData.tuitionFee !== undefined ? setData.tuitionFee : oldDoc.tuitionFee;

    const extraFee =
      setData.extraFee !== undefined ? setData.extraFee : oldDoc.extraFee;

    const dueDate =
      setData.dueDate !== undefined ? setData.dueDate : oldDoc.dueDate;

    const paidAmount =
      setData.paidAmount !== undefined
        ? setData.paidAmount
        : setData.amount !== undefined
          ? setData.amount
          : oldDoc.paidAmount !== undefined
            ? oldDoc.paidAmount
            : oldDoc.amount;

    const calculated = calculatePaymentValues({
      tuitionFee,
      extraFee,
      paidAmount,
      dueDate
    });

    const nextSetData = {
      ...setData,
      ...calculated
    };

    if (calculated.paidAmount <= 0) {
      nextSetData.payDate = null;
      delete unsetData.payDate;
    } else if (!nextSetData.payDate && !oldDoc.payDate) {
      nextSetData.payDate = new Date();
    }

    this.setUpdate({
      ...update,
      $set: nextSetData,
      $unset: unsetData
    });

    next();
  } catch (error) {
    next(error);
  }
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

// Query លឿនសម្រាប់ report by class/month/status
paymentSchema.index({
  class: 1,
  paymentMonth: 1,
  status: 1
});

// Query លឿនសម្រាប់ student payment history
paymentSchema.index({
  student: 1,
  paymentMonth: -1
});

// Query លឿនសម្រាប់ teacher/class report
paymentSchema.index({
  teacher: 1,
  paymentMonth: 1,
  status: 1
});

module.exports = mongoose.model("Payment", paymentSchema);