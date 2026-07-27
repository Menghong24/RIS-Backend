const mongoose = require("mongoose");

const AttendanceModel = require("./attendance.model");
const ClassesModel = require("../classes/classes.model");
const StudentModel = require("../students/students.model");
const BranchModel = require("../branches/branches.model");

const ATTENDANCE_STATUSES = [
  "present",
  "absent",
  "permission",
  "late"
];

const ATTENDANCE_SESSIONS = [
  "morning",
  "afternoon",
  "evening"
];

const ONE_DAY_IN_MILLISECONDS =
  24 * 60 * 60 * 1000;

// ======================================================
// Basic helpers
// ======================================================

const getId = (value) => {
  return String(
    value?._id || value || ""
  ).trim();
};

const isValidObjectId = (value) => {
  const id = getId(value);

  return (
    Boolean(id) &&
    mongoose.Types.ObjectId.isValid(id)
  );
};

const getRole = (req) => {
  return String(req.user?.role || "")
    .trim()
    .toLowerCase();
};

const isAdmin = (req) => {
  return getRole(req) === "admin";
};

const isTeacher = (req) => {
  return getRole(req) === "teacher";
};

const getUserTeacherId = (req) => {
  return getId(req.user?.teacher);
};

const getUserBranchId = (req) => {
  return getId(req.user?.branch);
};

const isGlobalAdmin = (req) => {
  return (
    req.user?.isGlobalAdmin === true ||
    (
      isAdmin(req) &&
      !getUserBranchId(req)
    )
  );
};

const createHttpError = (
  message,
  status = 400
) => {
  const error = new Error(message);

  error.status = status;

  return error;
};

const assertAttendanceRole = (req) => {
  if (
    !isAdmin(req) &&
    !isTeacher(req)
  ) {
    throw createHttpError(
      "អ្នកមិនមានសិទ្ធិប្រើប្រាស់ទិន្នន័យវត្តមានទេ",
      403
    );
  }
};

// ======================================================
// Branch helpers
// ======================================================

const getRequestedBranchId = (req) => {
  return (
    getId(req.params?.branchId) ||
    getId(req.query?.branchId) ||
    getId(req.query?.branch) ||
    getId(req.body?.branchId) ||
    getId(req.body?.branch) ||
    ""
  );
};

const buildBranchFilter = (req) => {
  assertAttendanceRole(req);

  const requestedBranchId =
    getRequestedBranchId(req);

  if (isGlobalAdmin(req)) {
    if (!requestedBranchId) {
      return {};
    }

    if (
      !isValidObjectId(
        requestedBranchId
      )
    ) {
      throw createHttpError(
        "Branch ID is not valid"
      );
    }

    return {
      branch: requestedBranchId
    };
  }

  const userBranchId =
    getUserBranchId(req);

  if (
    !userBranchId ||
    !isValidObjectId(userBranchId)
  ) {
    throw createHttpError(
      "គណនីនេះមិនទាន់ភ្ជាប់ទៅសាខាទេ",
      403
    );
  }

  if (
    requestedBranchId &&
    requestedBranchId !== userBranchId
  ) {
    throw createHttpError(
      "អ្នកមិនមានសិទ្ធិប្រើប្រាស់សាខានេះទេ",
      403
    );
  }

  return {
    branch: userBranchId
  };
};

const ensureActiveBranch = async (
  branchId
) => {
  if (!isValidObjectId(branchId)) {
    throw createHttpError(
      "Branch ID is not valid"
    );
  }

  const branch =
    await BranchModel.findOne({
      _id: branchId,
      status: "active"
    }).select("_id");

  if (!branch) {
    throw createHttpError(
      "Active branch was not found",
      404
    );
  }

  return branch;
};

// ======================================================
// Date helpers
// ======================================================

const parseAttendanceDate = (
  value
) => {
  if (!value) {
    throw createHttpError(
      "Attendance date is required"
    );
  }

  const rawValue = String(
    value
  ).trim();

  /*
    Parse YYYY-MM-DD directly as UTC to avoid
    timezone changes moving the date backward.
  */
  const dateOnlyMatch =
    rawValue.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  let date;

  if (dateOnlyMatch) {
    const year = Number(
      dateOnlyMatch[1]
    );

    const month = Number(
      dateOnlyMatch[2]
    );

    const day = Number(
      dateOnlyMatch[3]
    );

    date = new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !==
        month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw createHttpError(
        "Attendance date is not valid"
      );
    }

    return date;
  }

  const parsedDate =
    new Date(value);

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    throw createHttpError(
      "Attendance date is not valid"
    );
  }

  return new Date(
    Date.UTC(
      parsedDate.getUTCFullYear(),
      parsedDate.getUTCMonth(),
      parsedDate.getUTCDate()
    )
  );
};

const getNextDay = (date) => {
  return new Date(
    date.getTime() +
    ONE_DAY_IN_MILLISECONDS
  );
};

const getSchoolYearFromDate = (
  date
) => {
  const year =
    date.getUTCFullYear();

  return `${year}-${year + 1}`;
};

// ======================================================
// Session and record normalization
// ======================================================

const normalizeSession = (
  value = "morning"
) => {
  const session = String(
    value || "morning"
  )
    .trim()
    .toLowerCase();

  if (
    !ATTENDANCE_SESSIONS.includes(
      session
    )
  ) {
    throw createHttpError(
      "Invalid attendance session"
    );
  }

  return session;
};

const normalizeAttendanceRecords = (
  records
) => {
  if (
    !Array.isArray(records) ||
    records.length === 0
  ) {
    throw createHttpError(
      "Attendance records are required"
    );
  }

  const normalizedRecords =
    records.map(
      (record, index) => {
        const studentId = getId(
          record?.student
        );

        if (
          !studentId ||
          !isValidObjectId(
            studentId
          )
        ) {
          throw createHttpError(
            `Student ID is not valid at row ${index + 1}`
          );
        }

        const status = String(
          record?.status ||
          "present"
        )
          .trim()
          .toLowerCase();

        if (
          !ATTENDANCE_STATUSES.includes(
            status
          )
        ) {
          throw createHttpError(
            `Attendance status is not valid at row ${index + 1}`
          );
        }

        let checkedAt =
          new Date();

        if (record?.checkedAt) {
          const parsedCheckedAt =
            new Date(
              record.checkedAt
            );

          if (
            Number.isNaN(
              parsedCheckedAt.getTime()
            )
          ) {
            throw createHttpError(
              `checkedAt is not valid at row ${index + 1}`
            );
          }

          checkedAt =
            parsedCheckedAt;
        }

        return {
          student: studentId,
          status,
          remark: String(
            record?.remark || ""
          ).trim(),
          checkedAt
        };
      }
    );

  const studentIds =
    normalizedRecords.map(
      (record) =>
        getId(record.student)
    );

  if (
    new Set(studentIds).size !==
    studentIds.length
  ) {
    throw createHttpError(
      "Duplicate student found"
    );
  }

  return normalizedRecords;
};

// ======================================================
// Class access
// ======================================================

const getAccessibleClass = async (
  req,
  classId
) => {
  assertAttendanceRole(req);

  if (!isValidObjectId(classId)) {
    throw createHttpError(
      "Class ID មិនត្រឹមត្រូវ"
    );
  }

  const query = {
    _id: classId,
    ...buildBranchFilter(req)
  };

  if (isTeacher(req)) {
    const teacherId =
      getUserTeacherId(req);

    if (
      !teacherId ||
      !isValidObjectId(
        teacherId
      )
    ) {
      throw createHttpError(
        "គណនីគ្រូនេះមិនទាន់ភ្ជាប់ទៅ Teacher profile ទេ",
        403
      );
    }

    query.teacher = teacherId;
  }

  const classDocument =
    await ClassesModel.findOne(
      query
    ).select(
      "_id branch classNumber className classGrade timeStudy yearOnStudy status teacher students"
    );

  if (!classDocument) {
    throw createHttpError(
      "Class not found or access denied",
      404
    );
  }

  return classDocument;
};

// ======================================================
// Class students
// ======================================================

const getClassStudents = async (
  classDocument
) => {
  const classStudentIds =
    Array.isArray(
      classDocument.students
    )
      ? classDocument.students
          .map(getId)
          .filter(Boolean)
      : [];

  /*
    Use both references so the system still works
    when Class.students and Student.grade have not
    yet been completely synchronized.
  */
  return StudentModel.find({
    branch: classDocument.branch,

    $or: [
      {
        grade:
          classDocument._id
      },
      {
        _id: {
          $in:
            classStudentIds
        }
      }
    ]
  })
    .select(
      "_id khmerName englishName studentId gender profileImage grade status branch"
    )
    .sort({
      khmerName: 1,
      englishName: 1
    });
};

const validateStudentsForClass =
  async (
    records,
    classDocument
  ) => {
    const studentIds =
      records.map(
        (record) =>
          getId(record.student)
      );

    const classStudentIds =
      Array.isArray(
        classDocument.students
      )
        ? classDocument.students
            .map(getId)
            .filter(Boolean)
        : [];

    const validStudents =
      await StudentModel.find({
        _id: {
          $in: studentIds
        },

        branch:
          classDocument.branch,

        $or: [
          {
            grade:
              classDocument._id
          },
          {
            _id: {
              $in:
                classStudentIds
            }
          }
        ]
      }).select("_id");

    const validStudentIds =
      new Set(
        validStudents.map(
          (student) =>
            getId(student._id)
        )
      );

    const invalidStudentId =
      studentIds.find(
        (studentId) =>
          !validStudentIds.has(
            studentId
          )
      );

    if (invalidStudentId) {
      throw createHttpError(
        "Some students do not belong to this class or branch"
      );
    }
  };

// ======================================================
// Population
// ======================================================

const populateAttendanceQuery = (
  query
) => {
  return query
    .populate(
      "branch",
      "branchCode branchName status"
    )
    .populate(
      "class",
      "classNumber className classGrade timeStudy yearOnStudy teacher branch status"
    )
    .populate(
      "teacher",
      "khmerName englishName phone profileImage branch status"
    )
    .populate(
      "markedBy",
      "username role branch"
    )
    .populate(
      "records.student",
      "khmerName englishName studentId gender profileImage grade branch status"
    );
};

// ======================================================
// Error handler
// ======================================================

const sendControllerError = (
  res,
  error,
  fallbackMessage
) => {
  if (error?.code === 11000) {
    return res.status(409).send({
      err: "Attendance for this class, date and session already exists"
    });
  }

  if (
    error?.name ===
    "ValidationError"
  ) {
    const firstError =
      Object.values(
        error.errors || {}
      )[0];

    return res.status(400).send({
      err:
        firstError?.message ||
        error.message
    });
  }

  if (
    error?.name ===
    "CastError"
  ) {
    return res.status(400).send({
      err: "Invalid ID"
    });
  }

  return res
    .status(error?.status || 500)
    .send({
      err:
        error?.message ||
        fallbackMessage ||
        "Internal server error"
    });
};

// ======================================================
// GET ATTENDANCE
// ======================================================

exports.getAttendance = async (
  req,
  res
) => {
  try {
    const {
      classId,
      class: classQuery,
      date,
      session
    } = req.query;

    const finalClassId =
      classId || classQuery;

    if (
      !finalClassId ||
      !date
    ) {
      throw createHttpError(
        "Class ID and Date are required"
      );
    }

    const classDocument =
      await getAccessibleClass(
        req,
        finalClassId
      );

    const attendanceDate =
      parseAttendanceDate(date);

    const nextDay =
      getNextDay(
        attendanceDate
      );

    const finalSession =
      normalizeSession(session);

    /*
      The date range supports old attendance
      records that were saved with a time value.
    */
    const attendance =
      await populateAttendanceQuery(
        AttendanceModel.findOne({
          branch:
            classDocument.branch,

          class:
            classDocument._id,

          date: {
            $gte:
              attendanceDate,
            $lt: nextDay
          },

          session:
            finalSession
        })
      );

    if (attendance) {
      return res.status(200).send({
        success: true,
        mode: "edit",
        data: attendance
      });
    }

    const students =
      await getClassStudents(
        classDocument
      );

    const blankRecords =
      students.map(
        (student) => ({
          student,
          status: "present",
          remark: "",
          checkedAt:
            new Date()
        })
      );

    return res.status(200).send({
      success: true,
      mode: "create",

      data: {
        branch:
          classDocument.branch,

        class:
          classDocument._id,

        teacher:
          classDocument.teacher ||
          null,

        date:
          attendanceDate,

        session:
          finalSession,

        schoolYear:
          getSchoolYearFromDate(
            attendanceDate
          ),

        records:
          blankRecords
      }
    });
  } catch (error) {
    return sendControllerError(
      res,
      error,
      "Cannot get attendance"
    );
  }
};

// ======================================================
// SAVE ATTENDANCE
// ======================================================

exports.saveAttendance = async (
  req,
  res
) => {
  try {
    const classId = getId(
      req.body?.class ||
      req.body?.classId
    );

    const {
      date,
      session,
      schoolYear,
      records
    } = req.body;

    if (!classId || !date) {
      throw createHttpError(
        "Class and Date are required"
      );
    }

    const classDocument =
      await getAccessibleClass(
        req,
        classId
      );

    await ensureActiveBranch(
      classDocument.branch
    );

    const normalizedRecords =
      normalizeAttendanceRecords(
        records
      );

    await validateStudentsForClass(
      normalizedRecords,
      classDocument
    );

    const attendanceDate =
      parseAttendanceDate(date);

    const nextDay =
      getNextDay(
        attendanceDate
      );

    const finalSession =
      normalizeSession(session);

    const finalSchoolYear =
      String(
        schoolYear ||
        getSchoolYearFromDate(
          attendanceDate
        )
      ).trim();

    if (!finalSchoolYear) {
      throw createHttpError(
        "School year is required"
      );
    }

    /*
      Find old records by date range first so legacy
      records with a time value are updated instead
      of creating a duplicate attendance sheet.
    */
    const existingAttendance =
      await AttendanceModel.findOne({
        branch:
          classDocument.branch,

        class:
          classDocument._id,

        date: {
          $gte:
            attendanceDate,
          $lt: nextDay
        },

        session:
          finalSession
      }).select("_id");

    const updateFilter =
      existingAttendance
        ? {
            _id:
              existingAttendance._id,

            branch:
              classDocument.branch
          }
        : {
            branch:
              classDocument.branch,

            class:
              classDocument._id,

            date:
              attendanceDate,

            session:
              finalSession
          };

    const attendance =
      await AttendanceModel.findOneAndUpdate(
        updateFilter,

        {
          $set: {
            branch:
              classDocument.branch,

            class:
              classDocument._id,

            date:
              attendanceDate,

            session:
              finalSession,

            schoolYear:
              finalSchoolYear,

            teacher:
              classDocument.teacher ||
              (
                isTeacher(req)
                  ? getUserTeacherId(req)
                  : null
              ),

            markedBy:
              req.user?._id ||
              null,

            records:
              normalizedRecords
          }
        },

        {
          new: true,
          upsert:
            !existingAttendance,
          runValidators: true,
          setDefaultsOnInsert: true
        }
      );

    const populatedAttendance =
      await populateAttendanceQuery(
        AttendanceModel.findById(
          attendance._id
        )
      );

    return res.status(200).send({
      success: true,
      msg:
        "Attendance saved successfully",
      data:
        populatedAttendance
    });
  } catch (error) {
    return sendControllerError(
      res,
      error,
      "Cannot save attendance"
    );
  }
};

// ======================================================
// GET ATTENDANCE REPORT
// ======================================================

exports.getAttendanceReport =
  async (req, res) => {
    try {
      const {
        classId,
        class: classQuery,
        month,
        year,
        studentId,
        student,
        session
      } = req.query;

      const finalClassId =
        classId || classQuery;

      const finalStudentId =
        studentId || student;

      if (!finalClassId) {
        throw createHttpError(
          "Class ID is required"
        );
      }

      const classDocument =
        await getAccessibleClass(
          req,
          finalClassId
        );

      const query = {
        branch:
          classDocument.branch,

        class:
          classDocument._id
      };

      if (session && session !== "All") {
        query.session =
          normalizeSession(session);
      }

      if (month && !year) {
        throw createHttpError(
          "Year is required when filtering by month"
        );
      }

      if (year) {
        const numericYear =
          Number(year);

        if (
          !Number.isInteger(
            numericYear
          ) ||
          numericYear < 1900 ||
          numericYear > 3000
        ) {
          throw createHttpError(
            "Year is not valid"
          );
        }

        let startDate;
        let endDate;

        if (month) {
          const numericMonth =
            Number(month);

          if (
            !Number.isInteger(
              numericMonth
            ) ||
            numericMonth < 1 ||
            numericMonth > 12
          ) {
            throw createHttpError(
              "Month must be between 1 and 12"
            );
          }

          startDate = new Date(
            Date.UTC(
              numericYear,
              numericMonth - 1,
              1
            )
          );

          endDate = new Date(
            Date.UTC(
              numericYear,
              numericMonth,
              1
            )
          );
        } else {
          startDate = new Date(
            Date.UTC(
              numericYear,
              0,
              1
            )
          );

          endDate = new Date(
            Date.UTC(
              numericYear + 1,
              0,
              1
            )
          );
        }

        query.date = {
          $gte: startDate,
          $lt: endDate
        };
      }

      if (req.query.schoolYear) {
        query.schoolYear = String(
          req.query.schoolYear
        ).trim();
      }

      const attendances =
        await populateAttendanceQuery(
          AttendanceModel.find(
            query
          ).sort({
            date: 1,
            session: 1
          })
        );

      const currentStudents =
        await getClassStudents(
          classDocument
        );

      const reportMap = {};

      /*
        Add current class students first.
      */
      currentStudents.forEach(
        (currentStudent) => {
          const id = getId(
            currentStudent._id
          );

          reportMap[id] = {
            student: {
              _id:
                currentStudent._id,

              studentId:
                currentStudent.studentId,

              khmerName:
                currentStudent.khmerName,

              englishName:
                currentStudent.englishName,

              gender:
                currentStudent.gender,

              profileImage:
                currentStudent.profileImage
            },

            present: 0,
            absent: 0,
            permission: 0,
            late: 0,
            totalDays: 0
          };
        }
      );

      /*
        Historical attendance can include students
        who have since transferred to another class.
      */
      attendances.forEach(
        (sheet) => {
          sheet.records.forEach(
            (record) => {
              const recordStudent =
                record.student;

              const id = getId(
                recordStudent
              );

              if (!id) {
                return;
              }

              if (!reportMap[id]) {
                reportMap[id] = {
                  student: {
                    _id:
                      recordStudent?._id ||
                      id,

                    studentId:
                      recordStudent?.studentId ||
                      "",

                    khmerName:
                      recordStudent?.khmerName ||
                      "",

                    englishName:
                      recordStudent?.englishName ||
                      "",

                    gender:
                      recordStudent?.gender ||
                      "",

                    profileImage:
                      recordStudent?.profileImage ||
                      ""
                  },

                  present: 0,
                  absent: 0,
                  permission: 0,
                  late: 0,
                  totalDays: 0
                };
              }

              reportMap[id]
                .totalDays += 1;

              if (
                reportMap[id][
                  record.status
                ] !== undefined
              ) {
                reportMap[id][
                  record.status
                ] += 1;
              }
            }
          );
        }
      );

      let reportResult =
        Object.values(reportMap);

      if (finalStudentId) {
        if (
          !isValidObjectId(
            finalStudentId
          )
        ) {
          throw createHttpError(
            "Student ID is not valid"
          );
        }

        reportResult =
          reportResult.filter(
            (item) =>
              getId(
                item.student._id
              ) ===
              getId(
                finalStudentId
              )
          );
      }

      reportResult.sort(
        (firstItem, secondItem) => {
          const firstName =
            firstItem.student
              .khmerName ||
            firstItem.student
              .englishName ||
            "";

          const secondName =
            secondItem.student
              .khmerName ||
            secondItem.student
              .englishName ||
            "";

          return firstName.localeCompare(
            secondName
          );
        }
      );

      return res.status(200).send({
        success: true,

        class: {
          _id:
            classDocument._id,

          classNumber:
            classDocument.classNumber,

          className:
            classDocument.className,

          classGrade:
            classDocument.classGrade,

          branch:
            classDocument.branch
        },

        data: reportResult,

        totalStudents:
          reportResult.length,

        totalAttendanceSheets:
          attendances.length
      });
    } catch (error) {
      return sendControllerError(
        res,
        error,
        "Cannot get attendance report"
      );
    }
  };