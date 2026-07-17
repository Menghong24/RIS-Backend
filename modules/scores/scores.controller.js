const mongoose = require("mongoose");

const Score = require("./scores.model");
const StudentModel = require("../students/students.model");
const ClassesModel = require("../classes/classes.model");

const getRole = (req) => {
  return String(req.user?.role || "").toLowerCase();
};

const isAdmin = (req) => {
  const role = getRole(req);
  return role === "admin" || role === "superadmin";
};

const isTeacher = (req) => {
  return getRole(req) === "teacher";
};

const getUserTeacherId = (req) => {
  return String(req.user?.teacher?._id || req.user?.teacher || "");
};

const getId = (value) => {
  return String(value?._id || value || "").trim();
};

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(getId(id));
};

const normalizeScorePayload = (body = {}) => {
  const payload = { ...body };

  payload.student = getId(payload.student || payload.studentId);
  payload.class = getId(payload.class || payload.classId);
  payload.subject = getId(payload.subject || payload.subjectId);
  payload.teacher = getId(payload.teacher);

  payload.year = String(payload.year || payload.academicYear || "").trim();
  payload.month = String(payload.month || "").trim();
  payload.semester = String(payload.semester || "Semester 1").trim();
  payload.examType = String(payload.examType || payload.type || "monthly").trim();
  payload.remark = String(payload.remark || "").trim();

  if (
    payload.score !== "" &&
    payload.score !== null &&
    payload.score !== undefined
  ) {
    payload.score = Number(payload.score);
  }

  return payload;
};

const getPayloadArray = (body) => {
  if (Array.isArray(body?.scores)) return body.scores;
  if (Array.isArray(body)) return body;
  if (body && typeof body === "object") return [body];
  return [];
};

const getStudentCurrentClassId = async (studentId) => {
  if (!isValidObjectId(studentId)) return "";

  const student = await StudentModel.findById(studentId).select(
    "grade class classId classes classIds"
  );

  if (!student) return "";

  return getId(
    student.grade ||
      student.class ||
      student.classId ||
      student.classes?.[0] ||
      student.classIds?.[0]
  );
};

const studentBelongsToClass = async (studentId, classId) => {
  if (!isValidObjectId(studentId) || !isValidObjectId(classId)) {
    return false;
  }

  const student = await StudentModel.findById(studentId).select(
    "grade class classId classes classIds"
  );

  if (!student) return false;

  const studentClassIds = [
    getId(student.grade),
    getId(student.class),
    getId(student.classId),
    ...(Array.isArray(student.classes) ? student.classes.map(getId) : []),
    ...(Array.isArray(student.classIds) ? student.classIds.map(getId) : [])
  ].filter(Boolean);

  if (studentClassIds.includes(getId(classId))) {
    return true;
  }

  const foundClass = await ClassesModel.findOne({
    _id: classId,
    students: studentId
  }).select("_id");

  return Boolean(foundClass);
};

const canTeacherAccessClass = async (req, classId) => {
  if (!req.user) return true;

  if (isAdmin(req)) return true;
  if (!isTeacher(req)) return false;

  const teacherId = getUserTeacherId(req);

  if (!teacherId || !isValidObjectId(teacherId) || !isValidObjectId(classId)) {
    return false;
  }

  const foundClass = await ClassesModel.findOne({
    _id: classId,
    teacher: teacherId
  }).select("_id");

  return Boolean(foundClass);
};

const buildScoreFilter = async (req) => {
  const filter = {};

  const finalClassId = req.query.classId || req.query.class;
  const finalSubjectId = req.query.subjectId || req.query.subject;
  const finalStudentId = req.query.studentId || req.query.student;
  const finalYear = req.query.academicYear || req.query.year;
  const finalExamType = req.query.type || req.query.examType;

  if (finalClassId && isValidObjectId(finalClassId)) {
    filter.class = finalClassId;
  }

  if (finalSubjectId && isValidObjectId(finalSubjectId)) {
    filter.subject = finalSubjectId;
  }

  if (finalStudentId && isValidObjectId(finalStudentId)) {
    filter.student = finalStudentId;
  }

  if (finalYear) {
    filter.year = String(finalYear).trim();
  }

  if (req.query.month) {
    filter.month = String(req.query.month).trim();
  }

  if (finalExamType) {
    filter.examType = String(finalExamType).trim();
  }

  if (req.user && isTeacher(req)) {
    const teacherId = getUserTeacherId(req);

    if (!teacherId || !isValidObjectId(teacherId)) {
      return { _id: null };
    }

    const teacherClasses = await ClassesModel.find({
      teacher: teacherId
    }).select("_id");

    const classIds = teacherClasses.map((cls) => cls._id);

    if (filter.class) {
      const allowed = classIds.some((id) => {
        return String(id) === String(filter.class);
      });

      if (!allowed) {
        return { _id: null };
      }
    } else {
      filter.class = { $in: classIds };
    }
  }

  return filter;
};

const getScoresByClass = async (req, res) => {
  try {
    const filter = await buildScoreFilter(req);

    const scores = await Score.find(filter)
      .populate("student", "khmerName englishName studentId idCode gender profileImage")
      .populate("class", "className classGrade timeStudy teacher")
      .populate("subject", "subjectName")
      .populate("teacher", "khmerName englishName")
      .sort({ createdAt: -1 });

    return res.status(200).send(scores);
  } catch (err) {
    return res.status(500).send({
      err: err.message || "Failed to retrieve scores"
    });
  }
};

const validateAndBuildFinalItems = async (req, payload) => {
  const finalItems = [];

  for (let index = 0; index < payload.length; index += 1) {
    const item = payload[index];

    if (!item.student || !isValidObjectId(item.student)) {
      throw new Error(`Student ID is required at row ${index + 1}`);
    }

    if (!item.subject || !isValidObjectId(item.subject)) {
      throw new Error(`Subject ID is required at row ${index + 1}`);
    }

    if (!item.month) {
      throw new Error(`Month is required at row ${index + 1}`);
    }

    if (!item.year) {
      throw new Error(`Academic year is required at row ${index + 1}`);
    }

    if (
      item.score === "" ||
      item.score === null ||
      item.score === undefined ||
      Number.isNaN(Number(item.score)) ||
      Number(item.score) < 0 ||
      Number(item.score) > 100
    ) {
      throw new Error(`Score must be between 0 and 100 at row ${index + 1}`);
    }

    const currentClassId = await getStudentCurrentClassId(item.student);
    const finalClassId = item.class || currentClassId;

    if (!finalClassId || !isValidObjectId(finalClassId)) {
      throw new Error(`Student does not have a valid class at row ${index + 1}`);
    }

    const belongsToClass = await studentBelongsToClass(item.student, finalClassId);

    if (!belongsToClass) {
      throw new Error(`Student does not belong to this class at row ${index + 1}`);
    }

    const allowed = await canTeacherAccessClass(req, finalClassId);

    if (!allowed) {
      throw new Error("អ្នកមិនមានសិទ្ធិបញ្ចូលពិន្ទុសម្រាប់ថ្នាក់នេះទេ");
    }

    const finalTeacherId = item.teacher || getUserTeacherId(req);

    const finalItem = {
      student: item.student,
      class: finalClassId,
      subject: item.subject,
      year: item.year,
      month: item.month,
      semester: item.semester || "Semester 1",
      examType: item.examType || "monthly",
      score: Number(item.score),
      remark: item.remark || ""
    };

    if (finalTeacherId && isValidObjectId(finalTeacherId)) {
      finalItem.teacher = finalTeacherId;
    }

    finalItems.push(finalItem);
  }

  return finalItems;
};

const buildBulkOps = (finalItems) => {
  return finalItems.map((item) => ({
    updateOne: {
      filter: {
        student: item.student,
        class: item.class,
        subject: item.subject,
        month: item.month,
        year: item.year,
        examType: item.examType
      },
      update: {
        $set: item
      },
      upsert: true
    }
  }));
};

const saveScore = async (req, res) => {
  try {
    const rawPayload = getPayloadArray(req.body);

    console.log("Incoming score payload count:", rawPayload.length);

    if (rawPayload.length === 0) {
      return res.status(400).send({
        err: "No score data provided"
      });
    }

    const normalizedPayload = rawPayload.map(normalizeScorePayload);

    const finalItems = await validateAndBuildFinalItems(req, normalizedPayload);

    const bulkOps = buildBulkOps(finalItems);

    const result = await Score.bulkWrite(bulkOps, {
      ordered: true
    });

    const savedScores = await Score.find({
      $or: finalItems.map((item) => ({
        student: item.student,
        class: item.class,
        subject: item.subject,
        month: item.month,
        year: item.year,
        examType: item.examType
      }))
    })
      .populate("student", "khmerName englishName studentId idCode gender profileImage")
      .populate("class", "className classGrade timeStudy teacher")
      .populate("subject", "subjectName")
      .populate("teacher", "khmerName englishName");

    console.log("Saved score count:", savedScores.length);

    return res.status(200).send({
      msg: "Scores saved successfully",
      receivedCount: rawPayload.length,
      savedCount: savedScores.length,
      result: savedScores,
      bulkResult: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        upsertedCount: result.upsertedCount
      }
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).send({
        err: "Duplicate score record. Please reload and try again."
      });
    }

    return res.status(500).send({
      err: err.message || "Failed to save scores"
    });
  }
};

const deleteScore = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).send({
        err: "Score ID មិនត្រឹមត្រូវ"
      });
    }

    const existingScore = await Score.findById(id).select("class");

    if (!existingScore) {
      return res.status(404).send({
        err: "Score not found"
      });
    }

    const allowed = await canTeacherAccessClass(req, existingScore.class);

    if (!allowed) {
      return res.status(403).send({
        err: "អ្នកមិនមានសិទ្ធិលុបពិន្ទុនេះទេ"
      });
    }

    const deletedScore = await Score.findByIdAndDelete(id);

    return res.status(200).send({
      msg: "Score deleted successfully",
      result: deletedScore
    });
  } catch (err) {
    return res.status(500).send({
      err: err.message || "Failed to delete score"
    });
  }
};

module.exports = {
  getScoresByClass,
  saveScore,
  deleteScore
};