const mongoose = require("mongoose");

const PaymentModel = require("./payments.model");
const StudentModel = require("../students/students.model");
const ClassesModel = require("../classes/classes.model");

const isAdmin = (req) => req.user?.role === "admin";
const isTeacher = (req) => req.user?.role === "teacher";

const getUserTeacherId = (req) => {
  return String(req.user?.teacher?._id || req.user?.teacher || "");
};

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(String(id || ""));
};

const getStudentCurrentClassId = async (studentId) => {
  if (!isValidObjectId(studentId)) {
    return null;
  }

  const student = await StudentModel.findById(studentId).select("grade");

  if (!student) {
    return null;
  }

  return student.grade || null;
};

const getClassTeacherId = async (classId) => {
  if (!isValidObjectId(classId)) {
    return null;
  }

  const foundClass = await ClassesModel.findById(classId).select("teacher");

  if (!foundClass) {
    return null;
  }

  return foundClass.teacher || null;
};

const canTeacherAccessClass = async (req, classId) => {
  if (isAdmin(req)) return true;
  if (!isTeacher(req)) return false;

  const teacherId = getUserTeacherId(req);

  if (!teacherId || !isValidObjectId(classId)) {
    return false;
  }

  const foundClass = await ClassesModel.findOne({
    _id: classId,
    teacher: teacherId
  }).select("_id");

  return Boolean(foundClass);
};

const normalizePaymentPayload = (body = {}) => {
  const payload = {
    ...body
  };

  if (payload.studentId && !payload.student) {
    payload.student = payload.studentId;
  }

  if (payload.classId && !payload.class) {
    payload.class = payload.classId;
  }

  delete payload.studentId;
  delete payload.classId;

  return payload;
};

const populatePaymentQuery = (query) => {
  return query
    .populate(
      "student",
      "khmerName englishName studentId gender family joinDate profileImage"
    )
    .populate("class", "className classGrade timeStudy teacher")
    .populate("teacher", "khmerName englishName phone");
};

const buildPaymentFilter = async (req) => {
  const {
    classId,
    class: classQuery,
    studentId,
    student,
    status,
    paymentMonth,
    month,
    teacherId,
    teacher
  } = req.query;

  const filter = {};

  const finalClassId = classId || classQuery;
  const finalStudentId = studentId || student;
  const finalPaymentMonth = paymentMonth || month;
  const finalTeacherId = teacherId || teacher;

  if (finalClassId && finalClassId !== "All") {
    filter.class = finalClassId;
  }

  if (finalStudentId && finalStudentId !== "All") {
    filter.student = finalStudentId;
  }

  if (status && status !== "All") {
    filter.status = status;
  }

  if (finalPaymentMonth && finalPaymentMonth !== "All") {
    filter.paymentMonth = finalPaymentMonth;
  }

  if (finalTeacherId && finalTeacherId !== "All") {
    filter.teacher = finalTeacherId;
  }

  if (isTeacher(req)) {
    const teacherObjectId = getUserTeacherId(req);

    const teacherClasses = await ClassesModel.find({
      teacher: teacherObjectId
    }).select("_id");

    const classIds = teacherClasses.map((cls) => cls._id);

    if (filter.class) {
      const allowed = classIds.some((id) => {
        return String(id) === String(filter.class);
      });

      if (!allowed) {
        return {
          _id: null
        };
      }
    } else {
      filter.class = {
        $in: classIds
      };
    }
  }

  return filter;
};

// --- CREATE ---
exports.createPayment = async (req, res) => {
  try {
    const payload = normalizePaymentPayload(req.body);

    if (!payload.student || !isValidObjectId(payload.student)) {
      return res.status(400).send({
        err: "Student ID is required"
      });
    }

    const student = await StudentModel.findById(payload.student).select("grade");

    if (!student) {
      return res.status(404).send({
        err: "Student not found"
      });
    }

    const finalClassId = payload.class || student.grade;

    if (!finalClassId || !isValidObjectId(finalClassId)) {
      return res.status(400).send({
        err: "Student does not have a valid class"
      });
    }

    const classExists = await ClassesModel.findById(finalClassId).select(
      "_id teacher"
    );

    if (!classExists) {
      return res.status(404).send({
        err: "Class not found"
      });
    }

    const allowed = await canTeacherAccessClass(req, finalClassId);

    if (!allowed) {
      return res.status(403).send({
        err: "អ្នកមិនមានសិទ្ធិបង្កើតការបង់ប្រាក់សម្រាប់ថ្នាក់នេះទេ"
      });
    }

    payload.class = finalClassId;

    if (!payload.teacher && classExists.teacher) {
      payload.teacher = classExists.teacher;
    }

    const payment = await PaymentModel.create(payload);

    const populatedPayment = await populatePaymentQuery(
      PaymentModel.findById(payment._id)
    );

    return res.status(201).send(populatedPayment);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).send({
        err: "Payment for this student, class and month already exists"
      });
    }

    return res.status(400).send({
      err: err.message
    });
  }
};

// --- READ ALL ---
exports.getAllPayments = async (req, res) => {
  try {
    const filter = await buildPaymentFilter(req);

    const payments = await populatePaymentQuery(
      PaymentModel.find(filter).sort({
        createdAt: -1
      })
    );

    return res.send(payments);
  } catch (err) {
    return res.status(500).send({
      err: err.message || "Internal server error"
    });
  }
};

// --- READ ONE ---
exports.getOnePayment = async (req, res) => {
  try {
    const id = req.params.id;

    if (!isValidObjectId(id)) {
      return res.status(400).send({
        err: "Payment ID មិនត្រឹមត្រូវ"
      });
    }

    const payment = await populatePaymentQuery(PaymentModel.findById(id));

    if (!payment) {
      return res.status(404).send({
        err: "Payment not found"
      });
    }

    const allowed = await canTeacherAccessClass(req, payment.class?._id || payment.class);

    if (!allowed) {
      return res.status(403).send({
        err: "អ្នកមិនមានសិទ្ធិមើលការបង់ប្រាក់នេះទេ"
      });
    }

    return res.send(payment);
  } catch (err) {
    return res.status(500).send({
      err: err.message || "Internal server error"
    });
  }
};

// --- UPDATE ---
exports.updatePayment = async (req, res) => {
  try {
    const id = req.params.id;

    if (!isValidObjectId(id)) {
      return res.status(400).send({
        err: "Payment ID មិនត្រឹមត្រូវ"
      });
    }

    const existingPayment = await PaymentModel.findById(id).select(
      "student class paymentMonth"
    );

    if (!existingPayment) {
      return res.status(404).send({
        err: "Payment not found"
      });
    }

    const allowed = await canTeacherAccessClass(req, existingPayment.class);

    if (!allowed) {
      return res.status(403).send({
        err: "អ្នកមិនមានសិទ្ធិកែប្រែការបង់ប្រាក់នេះទេ"
      });
    }

    const payload = normalizePaymentPayload(req.body);

    /*
      Keep payment history stable.
      Do not allow update to move an old payment record
      to another student, class or month.
    */
    delete payload.student;
    delete payload.class;
    delete payload.paymentMonth;
    delete payload.teacher;

    const payment = await populatePaymentQuery(
      PaymentModel.findByIdAndUpdate(
        id,
        {
          $set: payload
        },
        {
          new: true,
          runValidators: true
        }
      )
    );

    return res.send(payment);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).send({
        err: "Payment for this student, class and month already exists"
      });
    }

    return res.status(500).send({
      err: err.message || "Internal server error"
    });
  }
};

// --- DELETE ---
exports.deletePayment = async (req, res) => {
  try {
    const id = req.params.id;

    if (!isValidObjectId(id)) {
      return res.status(400).send({
        err: "Payment ID មិនត្រឹមត្រូវ"
      });
    }

    const existingPayment = await PaymentModel.findById(id).select("class");

    if (!existingPayment) {
      return res.status(404).send({
        err: "Payment not found"
      });
    }

    const allowed = await canTeacherAccessClass(req, existingPayment.class);

    if (!allowed) {
      return res.status(403).send({
        err: "អ្នកមិនមានសិទ្ធិលុបការបង់ប្រាក់នេះទេ"
      });
    }

    const payment = await PaymentModel.findByIdAndDelete(id);

    return res.send({
      msg: "Payment deleted successfully",
      result: payment
    });
  } catch (err) {
    return res.status(500).send({
      err: err.message || "Internal server error"
    });
  }
};