const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher'
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  tuitionFee: {
    type: Number,
    min: 0,
    default: 0
  },
  extraFee: {
    type: Number,
    min: 0,
    default: 0
  },
  amount: {
    type: Number,
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

// គណនាទឹកប្រាក់សរុប (amount) ដោយស្វ័យប្រវត្តមុនពេល Save
paymentSchema.pre('save', function(next) {
  this.amount = (this.tuitionFee || 0) + (this.extraFee || 0);
  next();
});

module.exports = mongoose.model("Payment", paymentSchema);