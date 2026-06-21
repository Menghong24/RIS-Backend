const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
  },

  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
  },

  startDate: {
    type: Date,
    required: [true, "Start date is required"]
  },

  endDate: {
    type: Date,
    required: [true, "End date is required"]
  },

  amount: {
    type: Number,
    required: [true, "Amount is required"],
    min: 0,
    default: 0
  },

  payDate: {
    type: Date
  },

  status: {
    type: String,
    enum: ['unpaid', 'paid', 'late'],
    default: 'unpaid'
  },

  remark: {
    type: String,
    trim: true
  }
}, { timestamps: true });

// FIXED: Model name changed from 'Score' to 'Payment'
// FIXED: Variable name 'paymentSchema' instead of 'playmentSchema'
const PaymentModel = mongoose.model("Payment", paymentSchema);

// FIXED: Exporting 'PaymentModel' instead of 'PlaymentModel'
module.exports = PaymentModel;