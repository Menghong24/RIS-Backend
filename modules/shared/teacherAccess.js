const mongoose = require("mongoose");
const ClassesModel = require("../classes/classes.model");
const StudentModel = require("../students/students.model");

const toIdString = (value) => {
  return String(value?._id || value || "").trim();
};

const isValidObjectId = (value) => {
  return mongoose.Types.ObjectId.isValid(toIdString(value));
};

const getUserRole = (req) => {
  return String(req.user?.role || "").toLowerCase();
};

const getUserTeacherId = (req) => {
  return toIdString(req.user?.teacher?._id || req.user?.teacher);
};

const getClassIdFromRequest = (req) => {
  return (
    toIdString(req.params?.classId) ||
    toIdString(req.query?.classId) ||
    toIdString(req.query?.class) ||
    toIdString(req.body?.classId) ||
    toIdString(req.body?.class) ||
    toIdString(req.body?.scores?.[0]?.classId) ||
    toIdString(req.body?.scores?.[0]?.class) ||
    ""
  );
};

const getStudentIdFromRequest = (req) => {
  return (
    toIdString(req.params?.studentId) ||
    toIdString(req.query?.studentId) ||
    toIdString(req.query?.student) ||
    toIdString(req.body?.studentId) ||
    toIdString(req.body?.student) ||
    ""
  );
};

const canAccessClass = async (req, res, next) => {
  try {
    const role = getUserRole(req);

    if (role === "admin") {
      return next();
    }

    if (role !== "teacher") {
      return res.status(403).send({
        err: "អ្នកមិនមានសិទ្ធិប្រើប្រាស់ទិន្នន័យនេះទេ"
      });
    }

    const teacherId = getUserTeacherId(req);

    if (!teacherId || !isValidObjectId(teacherId)) {
      return res.status(403).send({
        err: "គណនីគ្រូនេះមិនទាន់ភ្ជាប់ទៅ Teacher profile ទេ"
      });
    }

    const classId = getClassIdFromRequest(req);

    if (!classId) {
      return res.status(400).send({
        err: "សូមផ្ញើ classId ឬ class"
      });
    }

    if (!isValidObjectId(classId)) {
      return res.status(400).send({
        err: "classId មិនត្រឹមត្រូវ"
      });
    }

    const foundClass = await ClassesModel.findOne({
      _id: classId,
      teacher: teacherId
    }).select("_id");

    if (!foundClass) {
      return res.status(403).send({
        err: "អ្នកមិនមានសិទ្ធិប្រើប្រាស់ថ្នាក់នេះទេ"
      });
    }

    return next();
  } catch (err) {
    return res.status(500).send({
      err: err.message || "Internal server error"
    });
  }
};

const canAccessStudent = async (req, res, next) => {
  try {
    const role = getUserRole(req);

    if (role === "admin") {
      return next();
    }

    if (role !== "teacher") {
      return res.status(403).send({
        err: "អ្នកមិនមានសិទ្ធិប្រើប្រាស់ទិន្នន័យនេះទេ"
      });
    }

    const teacherId = getUserTeacherId(req);

    if (!teacherId || !isValidObjectId(teacherId)) {
      return res.status(403).send({
        err: "គណនីគ្រូនេះមិនទាន់ភ្ជាប់ទៅ Teacher profile ទេ"
      });
    }

    const studentId = getStudentIdFromRequest(req);

    if (!studentId) {
      return res.status(400).send({
        err: "សូមផ្ញើ studentId ឬ student"
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
      _id: studentId,
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

    return next();
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