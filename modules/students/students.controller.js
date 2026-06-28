const mongoose = require("mongoose");
const StudentModel = require("./students.model");
const ClassesModel = require("../classes/classes.model");
const { removeLocalFile } = require("../shared/removeLocalFile");

const isAdmin = (req) => req.user?.role === "admin";
const isTeacher = (req) => req.user?.role === "teacher";

const getUserTeacherId = (req) => {
  return String(req.user?.teacher?._id || req.user?.teacher || "");
};

const getUploadedStudentImagePath = (req) => {
  if (!req.file?.filename) return "";

  return `/uploads/students/${req.file.filename}`;
};

const removeUploadedFileIfExists = (req) => {
  const uploadedImagePath = getUploadedStudentImagePath(req);

  if (uploadedImagePath) {
    removeLocalFile(uploadedImagePath);
  }
};

const getTeacherClassData = async (req) => {
  const teacherId = getUserTeacherId(req);

  if (!teacherId) {
    return {
      classIds: [],
      studentIds: []
    };
  }

  const teacherClasses = await ClassesModel.find({
    teacher: teacherId
  }).select("_id students");

  const classIds = teacherClasses.map((cls) => cls._id);
  const studentIds = teacherClasses.flatMap((cls) => cls.students || []);

  return {
    classIds,
    studentIds
  };
};

const buildSearchQuery = (search) => {
  const keyword = String(search || "").trim();

  if (!keyword) return {};

  const searchRegex = {
    $regex: keyword,
    $options: "i"
  };

  return {
    $or: [
      { khmerName: searchRegex },
      { englishName: searchRegex },
      { studentId: searchRegex },
      { idCode: searchRegex }
    ]
  };
};

const buildTeacherStudentQuery = async (req) => {
  if (!isTeacher(req)) return {};

  const { classIds, studentIds } = await getTeacherClassData(req);

  return {
    $or: [
      { _id: { $in: studentIds } },
      { grade: { $in: classIds } },
      { class: { $in: classIds } },
      { classId: { $in: classIds } }
    ]
  };
};

const mergeQueries = (...queries) => {
  const validQueries = queries.filter((query) => {
    return query && Object.keys(query).length > 0;
  });

  if (validQueries.length === 0) return {};
  if (validQueries.length === 1) return validQueries[0];

  return {
    $and: validQueries
  };
};

const canTeacherAccessStudent = async (req, studentId) => {
  if (isAdmin(req)) return true;

  if (!isTeacher(req)) return false;

  if (!mongoose.Types.ObjectId.isValid(String(studentId || ""))) {
    return false;
  }

  const teacherQuery = await buildTeacherStudentQuery(req);

  const student = await StudentModel.findOne({
    _id: studentId,
    ...teacherQuery
  }).select("_id");

  return Boolean(student);
};

const normalizeStudentPayload = (body = {}) => {
  const payload = { ...body };

  if (payload.grade === "" || payload.grade === "null" || payload.grade === "undefined") {
    payload.grade = undefined;
  }

  return payload;
};

// --- CREATE ---
exports.createStudent = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      removeUploadedFileIfExists(req);

      return res.status(403).send({
        err: "មានតែ Admin ប៉ុណ្ណោះដែលអាចបង្កើតសិស្សបាន"
      });
    }

    const payload = normalizeStudentPayload(req.body);

    const uploadedImagePath = getUploadedStudentImagePath(req);

    if (uploadedImagePath) {
      payload.profileImage = uploadedImagePath;
    }

    const result = await StudentModel.create(payload);

    const populated = await StudentModel.findById(result._id).populate(
      "grade",
      "className classGrade timeStudy teacher"
    );

    return res.status(201).send(populated);
  } catch (err) {
    removeUploadedFileIfExists(req);

    if (err.code === 11000) {
      return res.status(409).send({
        err: "Student ID already exists"
      });
    }

    return res.status(400).send({
      err: err.message
    });
  }
};

// --- READ ALL ---
exports.findAllStudent = async (req, res) => {
  try {
    const searchQuery = buildSearchQuery(req.query.search);
    const teacherQuery = await buildTeacherStudentQuery(req);

    const query = mergeQueries(searchQuery, teacherQuery);

    const result = await StudentModel.find(query)
      .populate("grade", "className classGrade timeStudy teacher")
      .sort({
        createdAt: -1
      });

    return res.send(result);
  } catch (err) {
    return res.status(500).send({
      err: err.message || "Internal server error"
    });
  }
};

// --- READ ONE ---
exports.getOneStudent = async (req, res) => {
  try {
    const id = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(String(id || ""))) {
      return res.status(400).send({
        err: "Student ID មិនត្រឹមត្រូវ"
      });
    }

    const allowed = await canTeacherAccessStudent(req, id);

    if (!allowed) {
      return res.status(403).send({
        err: "អ្នកមិនមានសិទ្ធិមើលសិស្សនេះទេ"
      });
    }

    const result = await StudentModel.findById(id).populate(
      "grade",
      "className classGrade timeStudy teacher"
    );

    if (!result) {
      return res.status(404).send({
        err: "Student not found"
      });
    }

    return res.send(result);
  } catch (err) {
    return res.status(500).send({
      err: err.message || "Internal server error"
    });
  }
};

// --- UPDATE ---
exports.updateStudent = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      removeUploadedFileIfExists(req);

      return res.status(403).send({
        err: "មានតែ Admin ប៉ុណ្ណោះដែលអាចកែប្រែសិស្សបាន"
      });
    }

    const id = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(String(id || ""))) {
      removeUploadedFileIfExists(req);

      return res.status(400).send({
        err: "Student ID មិនត្រឹមត្រូវ"
      });
    }

    const existingStudent = await StudentModel.findById(id);

    if (!existingStudent) {
      removeUploadedFileIfExists(req);

      return res.status(404).send({
        err: "Student not found"
      });
    }

    const payload = normalizeStudentPayload(req.body);
    const uploadedImagePath = getUploadedStudentImagePath(req);

    if (uploadedImagePath) {
      if (existingStudent.profileImage) {
        removeLocalFile(existingStudent.profileImage);
      }

      payload.profileImage = uploadedImagePath;
    }

    const result = await StudentModel.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true
    }).populate("grade", "className classGrade timeStudy teacher");

    return res.send(result);
  } catch (err) {
    removeUploadedFileIfExists(req);

    if (err.code === 11000) {
      return res.status(409).send({
        err: "Student ID already exists"
      });
    }

    return res.status(500).send({
      err: err.message || "Internal server error"
    });
  }
};

// --- DELETE ---
exports.deleteStudent = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).send({
        err: "មានតែ Admin ប៉ុណ្ណោះដែលអាចលុបសិស្សបាន"
      });
    }

    const id = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(String(id || ""))) {
      return res.status(400).send({
        err: "Student ID មិនត្រឹមត្រូវ"
      });
    }

    const result = await StudentModel.findByIdAndDelete(id);

    if (!result) {
      return res.status(404).send({
        err: "Student not found"
      });
    }

    if (result.profileImage) {
      removeLocalFile(result.profileImage);
    }

    await ClassesModel.updateMany(
      {
        students: id
      },
      {
        $pull: {
          students: id
        }
      }
    );

    return res.send({
      msg: "Student deleted successfully.",
      result
    });
  } catch (err) {
    return res.status(500).send({
      err: err.message || "Internal server error"
    });
  }
};