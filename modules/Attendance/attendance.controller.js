const mongoose = require("mongoose");

const ClassesModel = require("../classes/classes.model");
const AttendanceModel = require("./attendance.model");
const StudentModel = require("../students/students.model");

const isAdmin = (req) => req.user?.role === "admin";
const isTeacher = (req) => req.user?.role === "teacher";

const getUserTeacherId = (req) => {
  return String(req.user?.teacher?._id || req.user?.teacher || "");
};

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(String(id || ""));
};

const getStartOfDay = (date) => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  return startOfDay;
};

const getEndOfDay = (date) => {
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay;
};

const getSchoolYearFromDate = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  return `${year}-${year + 1}`;
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

const populateAttendanceStudents = (query) => {
  return query.populate(
    "records.student",
    "khmerName englishName studentId gender profileImage grade"
  );
};

const normalizeRecordStudentId = (record = {}) => {
  return String(record.student?._id || record.student || "");
};

const normalizeAttendanceRecords = (records = []) => {
  return records.map((record) => ({
    student: record.student?._id || record.student,
    status: record.status || "present",
    remark: record.remark || ""
  }));
};

const getClassStudents = async (classId) => {
  const classData = await ClassesModel.findById(classId).populate(
    "students",
    "khmerName englishName studentId gender profileImage grade"
  );

  return classData;
};

// ==============================
// GET ATTENDANCE
// ==============================
exports.getAttendance = async (req, res) => {
  try {
    const { classId, date, session } = req.query;

    if (!classId || !date) {
      return res.status(400).send({
        err: "Class ID and Date are required"
      });
    }

    if (!isValidObjectId(classId)) {
      return res.status(400).send({
        err: "Class ID មិនត្រឹមត្រូវ"
      });
    }

    const allowed = await canTeacherAccessClass(req, classId);

    if (!allowed) {
      return res.status(403).send({
        err: "អ្នកមិនមានសិទ្ធិមើលវត្តមានថ្នាក់នេះទេ"
      });
    }

    const startOfDay = getStartOfDay(date);
    const endOfDay = getEndOfDay(date);
    const finalSession = session || "morning";

    const attendance = await populateAttendanceStudents(
      AttendanceModel.findOne({
        class: classId,
        date: {
          $gte: startOfDay,
          $lte: endOfDay
        },
        session: finalSession
      })
    );

    if (attendance) {
      return res.status(200).send({
        success: true,
        mode: "edit",
        data: attendance
      });
    }

    const classData = await getClassStudents(classId);

    if (!classData) {
      return res.status(404).send({
        err: "Class not found"
      });
    }

    const studentsList = classData.students || [];

    const blankRecords = studentsList.map((student) => ({
      student,
      status: "present",
      remark: ""
    }));

    return res.status(200).send({
      success: true,
      mode: "create",
      data: {
        class: classId,
        date,
        session: finalSession,
        schoolYear: getSchoolYearFromDate(date),
        records: blankRecords
      }
    });
  } catch (err) {
    return res.status(500).send({
      err: err.message || "Internal server error"
    });
  }
};

// ==============================
// SAVE ATTENDANCE
// ==============================
exports.saveAttendance = async (req, res) => {
  try {
    const {
      class: classId,
      classId: legacyClassId,
      date,
      session,
      schoolYear,
      records
    } = req.body;

    const finalClassId = classId || legacyClassId;

    if (!finalClassId || !date) {
      return res.status(400).send({
        err: "Class and Date are required"
      });
    }

    if (!isValidObjectId(finalClassId)) {
      return res.status(400).send({
        err: "Class ID មិនត្រឹមត្រូវ"
      });
    }

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).send({
        err: "Attendance records are required"
      });
    }

    const allowed = await canTeacherAccessClass(req, finalClassId);

    if (!allowed) {
      return res.status(403).send({
        err: "អ្នកមិនមានសិទ្ធិបញ្ចូលវត្តមានថ្នាក់នេះទេ"
      });
    }

    const classData = await ClassesModel.findById(finalClassId).select(
      "_id students teacher"
    );

    if (!classData) {
      return res.status(404).send({
        err: "Class not found"
      });
    }

    const classStudentIds = (classData.students || []).map((studentId) =>
      String(studentId)
    );

    const recordStudentIds = records.map(normalizeRecordStudentId);

    if (recordStudentIds.some((studentId) => !isValidObjectId(studentId))) {
      return res.status(400).send({
        err: "Student ID មិនត្រឹមត្រូវ"
      });
    }

    if (new Set(recordStudentIds).size !== recordStudentIds.length) {
      return res.status(400).send({
        err: "Duplicate student found"
      });
    }

    const invalidStudent = recordStudentIds.find((studentId) => {
      return !classStudentIds.includes(String(studentId));
    });

    if (invalidStudent) {
      return res.status(400).send({
        err: "Some students are not in this class anymore"
      });
    }

    const startOfDay = getStartOfDay(date);
    const endOfDay = getEndOfDay(date);
    const finalSession = session || "morning";
    const finalSchoolYear = schoolYear || getSchoolYearFromDate(date);

    const attendance = await AttendanceModel.findOneAndUpdate(
      {
        class: finalClassId,
        date: {
          $gte: startOfDay,
          $lte: endOfDay
        },
        session: finalSession
      },
      {
        class: finalClassId,
        date: startOfDay,
        session: finalSession,
        schoolYear: finalSchoolYear,
        teacher: classData.teacher || getUserTeacherId(req) || null,
        markedBy: req.user?._id || null,
        records: normalizeAttendanceRecords(records)
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );

    const result = await populateAttendanceStudents(
      AttendanceModel.findById(attendance._id)
    );

    return res.status(200).send({
      success: true,
      msg: "Attendance saved successfully",
      data: result
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).send({
        err: "Attendance for this class, date and session already exists"
      });
    }

    return res.status(500).send({
      err: err.message || "Internal server error"
    });
  }
};

// ==============================
// GET ATTENDANCE REPORT
// ==============================
exports.getAttendanceReport = async (req, res) => {
  try {
    const { classId, month, year, studentId } = req.query;

    if (!classId) {
      return res.status(400).send({
        err: "Class ID is required"
      });
    }

    if (!isValidObjectId(classId)) {
      return res.status(400).send({
        err: "Class ID មិនត្រឹមត្រូវ"
      });
    }

    const allowed = await canTeacherAccessClass(req, classId);

    if (!allowed) {
      return res.status(403).send({
        err: "អ្នកមិនមានសិទ្ធិមើលរបាយការណ៍វត្តមានថ្នាក់នេះទេ"
      });
    }

    const dateQuery = {};

    if (year) {
      let start;
      let end;

      if (month) {
        start = new Date(Number(year), Number(month) - 1, 1);
        end = new Date(Number(year), Number(month), 0, 23, 59, 59, 999);
      } else {
        start = new Date(Number(year), 0, 1);
        end = new Date(Number(year), 11, 31, 23, 59, 59, 999);
      }

      dateQuery.date = {
        $gte: start,
        $lte: end
      };
    }

    const attendances = await populateAttendanceStudents(
      AttendanceModel.find({
        class: classId,
        ...dateQuery
      }).sort({
        date: 1
      })
    );

    const classData = await getClassStudents(classId);

    if (!classData) {
      return res.status(404).send({
        err: "Class not found"
      });
    }

    const reportMap = {};

    /*
      Include current class students first.
      Then include old transferred students if they still have historical
      attendance records in this class.
    */
    (classData.students || []).forEach((student) => {
      reportMap[String(student._id)] = {
        student: {
          _id: student._id,
          studentId: student.studentId,
          khmerName: student.khmerName,
          englishName: student.englishName,
          gender: student.gender,
          profileImage: student.profileImage
        },
        present: 0,
        absent: 0,
        permission: 0,
        late: 0,
        totalDays: 0
      };
    });

    attendances.forEach((sheet) => {
      sheet.records.forEach((record) => {
        const student = record.student;
        const sId = String(student?._id || student || "");

        if (!sId) return;

        if (!reportMap[sId]) {
          reportMap[sId] = {
            student: {
              _id: student?._id || sId,
              studentId: student?.studentId || "",
              khmerName: student?.khmerName || "",
              englishName: student?.englishName || "",
              gender: student?.gender || "",
              profileImage: student?.profileImage || ""
            },
            present: 0,
            absent: 0,
            permission: 0,
            late: 0,
            totalDays: 0
          };
        }

        reportMap[sId].totalDays += 1;

        if (reportMap[sId][record.status] !== undefined) {
          reportMap[sId][record.status] += 1;
        }
      });
    });

    let reportResult = Object.values(reportMap);

    if (studentId) {
      reportResult = reportResult.filter((item) => {
        return String(item.student._id) === String(studentId);
      });
    }

    return res.status(200).send({
      success: true,
      data: reportResult,
      totalAttendanceSheets: attendances.length
    });
  } catch (err) {
    return res.status(500).send({
      err: err.message || "Internal server error"
    });
  }
};