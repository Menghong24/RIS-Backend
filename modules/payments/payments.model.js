const mongoose = require("mongoose");

const PAYMENT_MONTH_PATTERN =
  /^\d{4}-(0[1-9]|1[0-2])$/;

const paymentSchema = new mongoose.Schema(
  {
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      // required: [true, "Branch is required"],
      index: true
    },

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
      default: null,
      index: true
    },

    // YYYY-MM format, for example: 2026-06
    paymentMonth: {
      type: String,
      required: [true, "Payment month is required"],
      trim: true,
      match: [
        PAYMENT_MONTH_PATTERN,
        "Payment month must be YYYY-MM"
      ],
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
      default: null,
      index: true
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

    // tuitionFee + extraFee
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

    // Legacy field: amount = paidAmount
    amount: {
      type: Number,
      min: [0, "Amount cannot be negative"],
      default: 0
    },

    // expectedAmount - paidAmount
    balance: {
      type: Number,
      min: [0, "Balance cannot be negative"],
      default: 0
    },

    status: {
      type: String,
      enum: [
        "unpaid",
        "paid",
        "late",
        "partial"
      ],
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

// ======================================================
// Payment calculation helpers
// ======================================================

const startOfDay = (date = new Date()) => {
  const normalizedDate = new Date(date);

  normalizedDate.setHours(0, 0, 0, 0);

  return normalizedDate;
};

const normalizeMoney = (value) => {
  const number = Number(value ?? 0);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(number, 0);
};

const calculateStatus = ({
  paidAmount,
  balance,
  dueDate
}) => {
  const today = startOfDay();
  const due = dueDate
    ? startOfDay(dueDate)
    : null;

  if (paidAmount <= 0) {
    return due && today > due
      ? "late"
      : "unpaid";
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
  const safeTuitionFee =
    normalizeMoney(tuitionFee);

  const safeExtraFee =
    normalizeMoney(extraFee);

  const expectedAmount =
    safeTuitionFee + safeExtraFee;

  const rawPaidAmount =
    paidAmount !== undefined
      ? paidAmount
      : amount !== undefined
        ? amount
        : 0;

  const safePaidAmount =
    normalizeMoney(rawPaidAmount);

  // Prevent overpayment
  const finalPaidAmount = Math.min(
    safePaidAmount,
    expectedAmount
  );

  const balance = Math.max(
    expectedAmount - finalPaidAmount,
    0
  );

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
    balance:
      status === "paid" ? 0 : balance,
    status
  };
};

const applyPaymentCalculationToDocument =
  function () {
    const calculated =
      calculatePaymentValues({
        tuitionFee: this.tuitionFee,
        extraFee: this.extraFee,
        paidAmount: this.paidAmount,
        amount: this.amount,
        dueDate: this.dueDate
      });

    this.tuitionFee =
      calculated.tuitionFee;

    this.extraFee =
      calculated.extraFee;

    this.expectedAmount =
      calculated.expectedAmount;

    this.paidAmount =
      calculated.paidAmount;

    this.amount =
      calculated.amount;

    this.balance =
      calculated.balance;

    this.status =
      calculated.status;

    if (calculated.paidAmount <= 0) {
      this.payDate = null;
    } else if (!this.payDate) {
      this.payDate = new Date();
    }
  };

// ======================================================
// Document middleware
// ======================================================

paymentSchema.pre(
  "validate",
  function (next) {
    if (this.paymentMonth) {
      this.paymentMonth = String(
        this.paymentMonth
      ).trim();
    }

    if (this.remark) {
      this.remark = String(
        this.remark
      ).trim();
    }

    applyPaymentCalculationToDocument.call(
      this
    );

    next();
  }
);

// ======================================================
// Query update middleware
// ======================================================

paymentSchema.pre(
  "findOneAndUpdate",
  async function (next) {
    try {
      const update =
        this.getUpdate() || {};

      const oldDocument =
        await this.model
          .findOne(this.getQuery())
          .lean();

      if (!oldDocument) {
        return next();
      }

      /*
        Support both:

        findOneAndUpdate(filter, payload)

        and:

        findOneAndUpdate(filter, {
          $set: payload
        })
      */
      const directFields =
        Object.fromEntries(
          Object.entries(update).filter(
            ([key]) =>
              !key.startsWith("$")
          )
        );

      const setData = {
        ...directFields,
        ...(update.$set || {})
      };

      const unsetData = {
        ...(update.$unset || {})
      };

      const incrementData = {
        ...(update.$inc || {})
      };

      const getNextMoneyValue = (
        field
      ) => {
        if (setData[field] !== undefined) {
          return setData[field];
        }

        if (
          incrementData[field] !==
          undefined
        ) {
          return (
            normalizeMoney(
              oldDocument[field]
            ) +
            Number(
              incrementData[field] || 0
            )
          );
        }

        return oldDocument[field];
      };

      const tuitionFee =
        getNextMoneyValue(
          "tuitionFee"
        );

      const extraFee =
        getNextMoneyValue(
          "extraFee"
        );

      const dueDate =
        setData.dueDate !== undefined
          ? setData.dueDate
          : oldDocument.dueDate;

      let paidAmount;

      if (
        setData.paidAmount !== undefined
      ) {
        paidAmount =
          setData.paidAmount;
      } else if (
        setData.amount !== undefined
      ) {
        paidAmount = setData.amount;
      } else if (
        incrementData.paidAmount !==
        undefined
      ) {
        paidAmount =
          normalizeMoney(
            oldDocument.paidAmount
          ) +
          Number(
            incrementData.paidAmount ||
              0
          );
      } else if (
        incrementData.amount !==
        undefined
      ) {
        paidAmount =
          normalizeMoney(
            oldDocument.amount
          ) +
          Number(
            incrementData.amount || 0
          );
      } else {
        paidAmount =
          oldDocument.paidAmount !==
          undefined
            ? oldDocument.paidAmount
            : oldDocument.amount;
      }

      const calculated =
        calculatePaymentValues({
          tuitionFee,
          extraFee,
          paidAmount,
          dueDate
        });

      const nextSetData = {
        ...setData,
        ...calculated
      };

      /*
        Calculated fields must not also be
        modified through $inc or $unset.
      */
      [
        "tuitionFee",
        "extraFee",
        "expectedAmount",
        "paidAmount",
        "amount",
        "balance",
        "status"
      ].forEach((field) => {
        delete incrementData[field];
        delete unsetData[field];
      });

      if (
        calculated.paidAmount <= 0
      ) {
        nextSetData.payDate = null;
        delete unsetData.payDate;
      } else if (
        setData.payDate !== undefined
      ) {
        nextSetData.payDate =
          setData.payDate;
      } else if (
        !oldDocument.payDate
      ) {
        nextSetData.payDate =
          new Date();
      }

      const nextUpdate = {
        $set: nextSetData
      };

      if (
        Object.keys(unsetData).length >
        0
      ) {
        nextUpdate.$unset =
          unsetData;
      }

      if (
        Object.keys(incrementData)
          .length > 0
      ) {
        nextUpdate.$inc =
          incrementData;
      }

      /*
        Preserve other MongoDB operators.
      */
      Object.entries(update).forEach(
        ([operator, value]) => {
          if (
            operator.startsWith("$") &&
            ![
              "$set",
              "$unset",
              "$inc"
            ].includes(operator)
          ) {
            nextUpdate[operator] =
              value;
          }
        }
      );

      this.setUpdate(nextUpdate);

      return next();
    } catch (error) {
      return next(error);
    }
  }
);

// ======================================================
// Indexes
// ======================================================

// Prevent duplicate monthly payment inside the same branch
paymentSchema.index(
  {
    branch: 1,
    student: 1,
    class: 1,
    paymentMonth: 1
  },
  {
    unique: true,
    name: "unique_branch_student_class_payment_month"
  }
);

// Fast report by branch, class, month and status
paymentSchema.index(
  {
    branch: 1,
    class: 1,
    paymentMonth: 1,
    status: 1
  },
  {
    name: "payment_branch_class_month_status_index"
  }
);

// Fast student payment history
paymentSchema.index(
  {
    branch: 1,
    student: 1,
    paymentMonth: -1
  },
  {
    name: "payment_branch_student_history_index"
  }
);

// Fast teacher payment report
paymentSchema.index(
  {
    branch: 1,
    teacher: 1,
    paymentMonth: 1,
    status: 1
  },
  {
    name: "payment_branch_teacher_month_status_index"
  }
);

// Fast overdue and unpaid report
paymentSchema.index(
  {
    branch: 1,
    status: 1,
    dueDate: 1
  },
  {
    name: "payment_branch_status_due_date_index"
  }
);

module.exports = mongoose.model(
  "Payment",
  paymentSchema
);