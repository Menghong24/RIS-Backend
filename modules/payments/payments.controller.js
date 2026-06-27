// const StudentModel = require('../models/students.model'); // Needed if we implement advanced name search later

const PaymentModel = require("./payments.model");

// --- CREATE ---
exports.createPayment = async (req, res) => {
  try {
    // 1. Create the payment record
    const payment = await PaymentModel.create(req.body);
    
    // 2. Populate related data (Student & Class) immediately so the frontend receives names, not just IDs
    // ⚡ កែសម្រួល៖ បន្ថែម motherPhone និង joinDate ដើម្បីកុំឱ្យ Frontend លោតបាត់ទិន្នន័យពេលចុចបង់រួច
    const populatedPayment = await payment.populate([
  { path: 'student', select: 'khmerName englishName studentId family joinDate' }, // ⚡ កែទៅជា family
  { path: 'class', select: 'className classGrade' }
]);
    res.status(201).send(populatedPayment);
  } catch (err) {
    res.status(400).send({ error: err.message });
  }
};

// --- READ ALL (With Filters) ---
exports.getAllPayments = async (req, res) => {
  try {
    let query = {};
    
    // Filter by Class ID (if provided in URL query: ?classId=...)
    if (req.query.classId && req.query.classId !== 'All') {
      query.class = req.query.classId;
    }

    // Filter by Status (if provided in URL query: ?status=...)
    if (req.query.status && req.query.status !== 'All') {
      query.status = req.query.status;
    }

    // ⚡ កែសម្រួល៖ បន្ថែម motherPhone និង joinDate ទៅក្នុង select នៃ student populate
    const payments = await PaymentModel.find(query)
  .populate('student', 'khmerName englishName studentId photo gender family joinDate') // ⚡ កែទៅជា family
  .populate('class', 'className classGrade')
  .sort({ createdAt: -1 }); // Sort by newest first

    res.send(payments);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

// --- READ ONE ---
exports.getOnePayment = async (req, res) => {
  try {
    const payment = await PaymentModel.findById(req.params.id)
      .populate('student')
      .populate('class');
      
    if (!payment) {
      return res.status(404).send({ error: "Payment not found" });
    }
    
    res.send(payment);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

// --- UPDATE (PATCH) ---
// ⚡ កែសម្រួល៖ ប្តូរឈ្មោះទៅជា patchPayment និងប្រើប្រាស់ $set ព្រមទាំងបន្ថែម field ក្នុង populate ឱ្យត្រូវជាមួយ Frontend
exports.updatePayment = async (req, res) => {
  try {
    const payment = await PaymentModel.findByIdAndUpdate(
      req.params.id, 
      { $set: req.body }, // Update តែ fields ណាដែលផ្ញើមកពី frontend
      { new: true, runValidators: true } // Returns the updated document & checks schema rules
    )
    .populate('student', 'khmerName englishName studentId family joinDate')
    .populate('class', 'className classGrade');
      
    if (!payment) {
      return res.status(404).send({ error: "Payment not found" });
    }
    
    res.send(payment);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

// --- DELETE ---
exports.deletePayment = async (req, res) => {
  try {
    const payment = await PaymentModel.findByIdAndDelete(req.params.id);
    
    if (!payment) {
      return res.status(404).send({ error: "Payment not found" });
    }
    
    res.send({ message: "Payment deleted successfully", deletedPayment: payment });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};