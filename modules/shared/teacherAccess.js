const mongoose = require("mongoose");
const ClassesModel = require("../classes/classes.model");
const StudentModel = require("../students/students.model");

const toIdString = (value) => {
  return String(value?._id || value || "").trim();
};

const isValidObjectId = (value) => {
  return mongoose.Types.ObjectId.isValid(toIdString(value));
};

const getUserTeacherId = (req) => {
  return toIdString(req.user?.teacher);
};

const getClassIdFromRequest = (req) => {
  return (
    req.params.classId ||
    req.params.id ||
    req.query.classId ||
    req.query.class ||
    req.body.classId ||
    req.body.class ||
    req.body.scores?.[0]?.classId ||
    req.body.scores?.[0]?.class
  );
};

const getStudentIdFromRequest = (req) => {
  return (
    req.params.studentId ||
    req.params.id ||
    req.query.studentId ||
    req.query.student ||
    req.body.studentId ||
    req.body.student
  );
};

const canAccessClass = async (req, res, next) => {
  try {
    if (req.user?.role === "admin") {
      return next();
    }

    if (req.user?.role !== "teacher") {
      return res.status(403).send({
        err: "អ្នកមិនមានសិទ្ធិប្រើប្រាស់ទិន្នន័យនេះទេ"
      });
    }

    const teacherId = getUserTeacherId(req);

    if (!teacherId) {
      return res.status(403).send({
        err: "គណនីគ្រូនេះមិនទាន់ភ្ជាប់ទៅ Teacher profile ទេ"
      });
    }

    const classId = getClassIdFromRequest(req);

    if (!classId) {
      return res.status(400).send({
        err: "សូមផ្ញើ classId"
      });
    }

    if (!isValidObjectId(classId)) {
      return res.status(400).send({
        err: "classId មិនត្រឹមត្រូវ"
      });
    }

    const foundClass = await ClassesModel.findOne({
      _id: toIdString(classId),
      teacher: teacherId
    }).select("_id");

    if (!foundClass) {
      return res.status(403).send({
        err: "អ្នកមិនមានសិទ្ធិប្រើប្រាស់ថ្នាក់នេះទេ"
      });
    }

    next();
  } catch (err) {
    return res.status(500).send({
      err: err.message || "Internal server error"
    });
  }
};

const canAccessStudent = async (req, res, next) => {
  try {
    if (req.user?.role === "admin") {
      return next();
    }

    if (req.user?.role !== "teacher") {
      return res.status(403).send({
        err: "អ្នកមិនមានសិទ្ធិប្រើប្រាស់ទិន្នន័យនេះទេ"
      });
    }

    const teacherId = getUserTeacherId(req);

    if (!teacherId) {
      return res.status(403).send({
        err: "គណនីគ្រូនេះមិនទាន់ភ្ជាប់ទៅ Teacher profile ទេ"
      });
    }

    const studentId = getStudentIdFromRequest(req);

    if (!studentId) {
      return res.status(400).send({
        err: "សូមផ្ញើ studentId"
      });
    }

    if (!isValidObjectId(studentId)) {
      return res.status(400).send({
        err: "studentId មិនត្រឹមត្រូវ"
      });
    }

    const teacherClasses = await ClassesModel.find({
      teacher: teacherId
    }).select("_id students");

    const classIds = teacherClasses.map((cls) => cls._id);
    const studentIds = teacherClasses.flatMap((cls) => cls.students || []);

    const student = await StudentModel.findOne({
      _id: toIdString(studentId),
      $or: [
        { _id: { $in: studentIds } },
        { grade: { $in: classIds } },
        { class: { $in: classIds } },
        { classId: { $in: classIds } }
      ]
    }).select("_id");

    if (!student) {
      return res.status(403).send({
        err: "អ្នកមិនមានសិទ្ធិប្រើប្រាស់សិស្សនេះទេ"
      });
    }

    next();
  } catch (err) {
    return res.status(500).send({
      err: err.message || "Internal server error"
    });
  }
};

module.exports = {
  canAccessClass,
  canAccessStudent,
  getUserTeacherId,
  getClassIdFromRequest,
  getStudentIdFromRequest
};