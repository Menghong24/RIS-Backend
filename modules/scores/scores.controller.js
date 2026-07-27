const mongoose = require("mongoose");

const ScoreModel = require("./scores.model");
const StudentModel = require("../students/students.model");
const ClassesModel = require("../classes/classes.model");
const SubjectModel = require("../subjects/subjects.model");
const TeacherModel = require("../teachers/teachers.model");
const BranchModel = require("../branches/branches.model");

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

const EXAM_TYPES = [
  "monthly",
  "semester",
  "final"
];

// ======================================================
// Basic helpers
// ======================================================

const getId = (value) => {
  return String(value?._id || value || "").trim();
};

const isValidObjectId = (value) => {
  const id = getId(value);

  return Boolean(id) &&
    mongoose.Types.ObjectId.isValid(id);
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
    (isAdmin(req) && !getUserBranchId(req))
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

const assertAllowedRole = (req) => {
  if (!isAdmin(req) && !isTeacher(req)) {
    throw createHttpError(
      "អ្នកមិនមានសិទ្ធិប្រើប្រាស់ទិន្នន័យពិន្ទុទេ",
      403
    );
  }
};

// ======================================================
// Branch helpers
// ======================================================

const getFirstPayloadItem = (body) => {
  if (Array.isArray(body?.scores)) {
    return body.scores[0] || {};
  }

  if (Array.isArray(body)) {
    return body[0] || {};
  }

  if (
    body &&
    typeof body === "object"
  ) {
    return body;
  }

  return {};
};

const getRequestedBranchId = (req) => {
  const firstItem = getFirstPayloadItem(
    req.body
  );

  return (
    getId(req.params?.branchId) ||
    getId(req.query?.branchId) ||
    getId(req.query?.branch) ||
    getId(req.body?.branchId) ||
    getId(req.body?.branch) ||
    getId(firstItem?.branchId) ||
    getId(firstItem?.branch) ||
    ""
  );
};

const getRequestedReadBranchId = (req) => {
  return (
    getId(req.query?.branchId) ||
    getId(req.query?.branch) ||
    ""
  );
};

const resolveBranchForWrite = async (
  req
) => {
  assertAllowedRole(req);

  const requestedBranchId =
    getRequestedBranchId(req);

  let branchId = "";

  if (isGlobalAdmin(req)) {
    branchId = requestedBranchId;

    if (!branchId) {
      throw createHttpError(
        "សូមជ្រើសរើសសាខា"
      );
    }
  } else {
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

    branchId = userBranchId;
  }

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
      "Active branch was not found"
    );
  }

  return getId(branch._id);
};

const buildBranchFilter = (req) => {
  assertAllowedRole(req);

  const requestedBranchId =
    getRequestedReadBranchId(req);

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

// ======================================================
// Payload helpers
// ======================================================

const normalizeMonth = (value) => {
  const month = String(value || "")
    .trim()
    .toLowerCase();

  if (!month) {
    return "";
  }

  return (
    month.charAt(0).toUpperCase() +
    month.slice(1)
  );
};

const normalizeScorePayload = (
  body = {}
) => {
  const payload = {
    ...body
  };

  payload.branch = getId(
    payload.branch ||
    payload.branchId
  );

  payload.student = getId(
    payload.student ||
    payload.studentId
  );

  payload.class = getId(
    payload.class ||
    payload.classId
  );

  payload.subject = getId(
    payload.subject ||
    payload.subjectId
  );

  payload.teacher = getId(
    payload.teacher
  );

  payload.year = String(
    payload.year ||
    payload.academicYear ||
    ""
  ).trim();

  payload.month = normalizeMonth(
    payload.month
  );

  payload.semester = String(
    payload.semester ||
    "Semester 1"
  ).trim();

  payload.examType = String(
    payload.examType ||
    payload.type ||
    "monthly"
  )
    .trim()
    .toLowerCase();

  payload.remark = String(
    payload.remark || ""
  ).trim();

  if (
    payload.score !== "" &&
    payload.score !== null &&
    payload.score !== undefined
  ) {
    payload.score = Number(
      payload.score
    );
  }

  delete payload.branchId;
  delete payload.studentId;
  delete payload.classId;
  delete payload.subjectId;
  delete payload.academicYear;
  delete payload.type;

  return payload;
};

const getPayloadArray = (body) => {
  if (Array.isArray(body?.scores)) {
    return body.scores;
  }

  if (Array.isArray(body)) {
    return body;
  }

  if (
    body &&
    typeof body === "object"
  ) {
    return [body];
  }

  return [];
};

// ======================================================
// Database cache helpers
// ======================================================

const getCachedDocument = async ({
  cache,
  key,
  loader
}) => {
  if (cache.has(key)) {
    return cache.get(key);
  }

  const document = await loader();

  cache.set(key, document);

  return document;
};

const getStudentInBranch = async (
  studentId,
  branchId,
  cache
) => {
  const key = `${branchId}:${studentId}`;

  return getCachedDocument({
    cache,
    key,
    loader: () =>
      StudentModel.findOne({
        _id: studentId,
        branch: branchId
      }).select(
        "_id branch grade class classId classes classIds"
      )
  });
};

const getClassInBranch = async (
  classId,
  branchId,
  cache
) => {
  const key = `${branchId}:${classId}`;

  return getCachedDocument({
    cache,
    key,
    loader: () =>
      ClassesModel.findOne({
        _id: classId,
        branch: branchId
      }).select(
        "_id branch teacher students"
      )
  });
};

const getSubjectInBranch = async (
  subjectId,
  branchId,
  cache
) => {
  const key = `${branchId}:${subjectId}`;

  return getCachedDocument({
    cache,
    key,
    loader: () =>
      SubjectModel.findOne({
        _id: subjectId,
        branch: branchId
      }).select(
        "_id branch teacher classId classIds status"
      )
  });
};

const getTeacherInBranch = async (
  teacherId,
  branchId,
  cache
) => {
  const key = `${branchId}:${teacherId}`;

  return getCachedDocument({
    cache,
    key,
    loader: () =>
      TeacherModel.findOne({
        _id: teacherId,
        branch: branchId
      }).select(
        "_id branch status"
      )
  });
};

// ======================================================
// Relationship validation
// ======================================================

const getStudentClassIds = (
  student
) => {
  if (!student) {
    return [];
  }

  return [
    getId(student.grade),
    getId(student.class),
    getId(student.classId),
    ...(Array.isArray(
      student.classes
    )
      ? student.classes.map(getId)
      : []),
    ...(Array.isArray(
      student.classIds
    )
      ? student.classIds.map(getId)
      : [])
  ].filter(Boolean);
};

const studentBelongsToClass = (
  student,
  classDocument,
  classId
) => {
  const normalizedClassId =
    getId(classId);

  const studentClassIds =
    getStudentClassIds(student);

  if (
    studentClassIds.includes(
      normalizedClassId
    )
  ) {
    return true;
  }

  const classStudentIds =
    Array.isArray(classDocument?.students)
      ? classDocument.students.map(getId)
      : [];

  return classStudentIds.includes(
    getId(student?._id)
  );
};

const subjectBelongsToClass = (
  subject,
  classId
) => {
  const linkedClassIds = [
    getId(subject?.classId),
    ...(Array.isArray(
      subject?.classIds
    )
      ? subject.classIds.map(getId)
      : [])
  ].filter(Boolean);

  /*
    Subject without assigned classes is treated
    as available for the whole branch.
  */
  if (linkedClassIds.length === 0) {
    return true;
  }

  return linkedClassIds.includes(
    getId(classId)
  );
};

const validateTeacherClassAccess = (
  req,
  classDocument
) => {
  if (!isTeacher(req)) {
    return;
  }

  const userTeacherId =
    getUserTeacherId(req);

  if (
    !userTeacherId ||
    !isValidObjectId(userTeacherId)
  ) {
    throw createHttpError(
      "គណនីគ្រូនេះមិនទាន់ភ្ជាប់ទៅ Teacher profile ទេ",
      403
    );
  }

  if (
    getId(classDocument?.teacher) !==
    userTeacherId
  ) {
    throw createHttpError(
      "អ្នកមិនមានសិទ្ធិបញ្ចូលពិន្ទុសម្រាប់ថ្នាក់នេះទេ",
      403
    );
  }
};

// ======================================================
// Score filter
// ======================================================

const validateQueryObjectId = (
  value,
  fieldName
) => {
  if (!value) {
    return "";
  }

  if (!isValidObjectId(value)) {
    throw createHttpError(
      `${fieldName} is not valid`
    );
  }

  return getId(value);
};

const buildScoreFilter = async (
  req
) => {
  const filter = {
    ...buildBranchFilter(req)
  };

  const finalClassId =
    req.query.classId ||
    req.query.class;

  const finalSubjectId =
    req.query.subjectId ||
    req.query.subject;

  const finalStudentId =
    req.query.studentId ||
    req.query.student;

  const finalTeacherId =
    req.query.teacherId ||
    req.query.teacher;

  const finalYear =
    req.query.academicYear ||
    req.query.year;

  const finalExamType =
    req.query.type ||
    req.query.examType;

  if (finalClassId) {
    filter.class =
      validateQueryObjectId(
        finalClassId,
        "Class ID"
      );
  }

  if (finalSubjectId) {
    filter.subject =
      validateQueryObjectId(
        finalSubjectId,
        "Subject ID"
      );
  }

  if (finalStudentId) {
    filter.student =
      validateQueryObjectId(
        finalStudentId,
        "Student ID"
      );
  }

  if (finalTeacherId) {
    filter.teacher =
      validateQueryObjectId(
        finalTeacherId,
        "Teacher ID"
      );
  }

  if (finalYear) {
    filter.year = String(
      finalYear
    ).trim();
  }

  if (req.query.month) {
    const month = normalizeMonth(
      req.query.month
    );

    if (!MONTHS.includes(month)) {
      throw createHttpError(
        "Invalid month"
      );
    }

    filter.month = month;
  }

  if (finalExamType) {
    const examType = String(
      finalExamType
    )
      .trim()
      .toLowerCase();

    if (
      !EXAM_TYPES.includes(
        examType
      )
    ) {
      throw createHttpError(
        "Invalid exam type"
      );
    }

    filter.examType = examType;
  }

  if (isTeacher(req)) {
    const teacherId =
      getUserTeacherId(req);

    const branchId =
      getUserBranchId(req);

    if (
      !teacherId ||
      !isValidObjectId(teacherId)
    ) {
      throw createHttpError(
        "គណនីគ្រូនេះមិនទាន់ភ្ជាប់ទៅ Teacher profile ទេ",
        403
      );
    }

    const teacherClasses =
      await ClassesModel.find({
        teacher: teacherId,
        branch: branchId
      }).select("_id");

    const classIds =
      teacherClasses.map(
        (classDocument) =>
          classDocument._id
      );

    if (filter.class) {
      const allowed =
        classIds.some(
          (id) =>
            getId(id) ===
            getId(filter.class)
        );

      if (!allowed) {
        throw createHttpError(
          "អ្នកមិនមានសិទ្ធិមើលពិន្ទុថ្នាក់នេះទេ",
          403
        );
      }
    } else {
      filter.class = {
        $in: classIds
      };
    }
  }

  return filter;
};

// ======================================================
// Populate
// ======================================================

const populateScoreQuery = (query) => {
  return query
    .populate(
      "branch",
      "branchCode branchName status"
    )
    .populate(
      "student",
      "khmerName englishName studentId idCode gender profileImage branch grade"
    )
    .populate(
      "class",
      "classNumber className classGrade timeStudy yearOnStudy teacher branch"
    )
    .populate(
      "subject",
      "subjectName type branch classIds classId"
    )
    .populate(
      "teacher",
      "khmerName englishName profileImage skill branch"
    );
};

// ======================================================
// Validate bulk items
// ======================================================

const validateAndBuildFinalItems =
  async (
    req,
    payload,
    branchId
  ) => {
    const finalItems = [];

    const studentCache = new Map();
    const classCache = new Map();
    const subjectCache = new Map();
    const teacherCache = new Map();

    for (
      let index = 0;
      index < payload.length;
      index += 1
    ) {
      const item = payload[index];
      const rowNumber = index + 1;

      if (
        item.branch &&
        getId(item.branch) !==
          getId(branchId)
      ) {
        throw createHttpError(
          `Branch does not match at row ${rowNumber}`,
          403
        );
      }

      if (
        !item.student ||
        !isValidObjectId(
          item.student
        )
      ) {
        throw createHttpError(
          `Student ID is required at row ${rowNumber}`
        );
      }

      if (
        !item.subject ||
        !isValidObjectId(
          item.subject
        )
      ) {
        throw createHttpError(
          `Subject ID is required at row ${rowNumber}`
        );
      }

      if (
        !item.month ||
        !MONTHS.includes(item.month)
      ) {
        throw createHttpError(
          `Valid month is required at row ${rowNumber}`
        );
      }

      if (!item.year) {
        throw createHttpError(
          `Academic year is required at row ${rowNumber}`
        );
      }

      if (
        !EXAM_TYPES.includes(
          item.examType
        )
      ) {
        throw createHttpError(
          `Invalid exam type at row ${rowNumber}`
        );
      }

      if (
        item.score === "" ||
        item.score === null ||
        item.score === undefined ||
        Number.isNaN(
          Number(item.score)
        ) ||
        Number(item.score) < 0 ||
        Number(item.score) > 100
      ) {
        throw createHttpError(
          `Score must be between 0 and 100 at row ${rowNumber}`
        );
      }

      const student =
        await getStudentInBranch(
          item.student,
          branchId,
          studentCache
        );

      if (!student) {
        throw createHttpError(
          `Student was not found in this branch at row ${rowNumber}`
        );
      }

      const studentClassIds =
        getStudentClassIds(student);

      const finalClassId =
        item.class ||
        studentClassIds[0] ||
        "";

      if (
        !finalClassId ||
        !isValidObjectId(
          finalClassId
        )
      ) {
        throw createHttpError(
          `Student does not have a valid class at row ${rowNumber}`
        );
      }

      const classDocument =
        await getClassInBranch(
          finalClassId,
          branchId,
          classCache
        );

      if (!classDocument) {
        throw createHttpError(
          `Class was not found in this branch at row ${rowNumber}`
        );
      }

      if (
        !studentBelongsToClass(
          student,
          classDocument,
          finalClassId
        )
      ) {
        throw createHttpError(
          `Student does not belong to this class at row ${rowNumber}`
        );
      }

      validateTeacherClassAccess(
        req,
        classDocument
      );

      const subject =
        await getSubjectInBranch(
          item.subject,
          branchId,
          subjectCache
        );

      if (!subject) {
        throw createHttpError(
          `Subject was not found in this branch at row ${rowNumber}`
        );
      }

      if (
        !subjectBelongsToClass(
          subject,
          finalClassId
        )
      ) {
        throw createHttpError(
          `Subject does not belong to this class at row ${rowNumber}`
        );
      }

      let finalTeacherId = "";

      if (isTeacher(req)) {
        finalTeacherId =
          getUserTeacherId(req);
      } else {
        finalTeacherId =
          item.teacher ||
          getId(
            classDocument.teacher
          ) ||
          getId(subject.teacher);
      }

      if (finalTeacherId) {
        if (
          !isValidObjectId(
            finalTeacherId
          )
        ) {
          throw createHttpError(
            `Teacher ID is not valid at row ${rowNumber}`
          );
        }

        const teacher =
          await getTeacherInBranch(
            finalTeacherId,
            branchId,
            teacherCache
          );

        if (!teacher) {
          throw createHttpError(
            `Teacher was not found in this branch at row ${rowNumber}`
          );
        }
      }

      const finalItem = {
        branch: branchId,
        student: item.student,
        class: finalClassId,
        subject: item.subject,
        year: item.year,
        month: item.month,
        semester:
          item.semester ||
          "Semester 1",
        examType:
          item.examType ||
          "monthly",
        score: Number(item.score),
        remark: item.remark || ""
      };

      if (finalTeacherId) {
        finalItem.teacher =
          finalTeacherId;
      } else {
        finalItem.teacher = null;
      }

      finalItems.push(finalItem);
    }

    return finalItems;
  };

// ======================================================
// Bulk operations
// ======================================================

const buildBulkOps = (
  finalItems
) => {
  return finalItems.map((item) => ({
    updateOne: {
      filter: {
        branch: item.branch,
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
      err: "Duplicate score record. Please reload and try again."
    });
  }

  if (
    error?.name ===
    "ValidationError"
  ) {
    const firstError = Object.values(
      error.errors || {}
    )[0];

    return res.status(400).send({
      err:
        firstError?.message ||
        error.message
    });
  }

  if (
    error?.name === "CastError"
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
// GET SCORES
// ======================================================

const getScoresByClass = async (
  req,
  res
) => {
  try {
    const filter =
      await buildScoreFilter(req);

    const scores =
      await populateScoreQuery(
        ScoreModel.find(filter)
          .sort({
            createdAt: -1
          })
      );

    return res.status(200).send(
      scores
    );
  } catch (error) {
    return sendControllerError(
      res,
      error,
      "Failed to retrieve scores"
    );
  }
};

// ======================================================
// SAVE SCORES
// ======================================================

const saveScore = async (
  req,
  res
) => {
  try {
    const rawPayload =
      getPayloadArray(req.body);

    if (
      rawPayload.length === 0
    ) {
      return res.status(400).send({
        err: "No score data provided"
      });
    }

    const branchId =
      await resolveBranchForWrite(req);

    const normalizedPayload =
      rawPayload.map(
        normalizeScorePayload
      );

    const finalItems =
      await validateAndBuildFinalItems(
        req,
        normalizedPayload,
        branchId
      );

    const bulkOps =
      buildBulkOps(finalItems);

    const result =
      await ScoreModel.bulkWrite(
        bulkOps,
        {
          ordered: true
        }
      );

    const savedScores =
      await populateScoreQuery(
        ScoreModel.find({
          $or: finalItems.map(
            (item) => ({
              branch: item.branch,
              student: item.student,
              class: item.class,
              subject: item.subject,
              month: item.month,
              year: item.year,
              examType:
                item.examType
            })
          )
        })
      );

    return res.status(200).send({
      msg:
        "Scores saved successfully",
      receivedCount:
        rawPayload.length,
      savedCount:
        savedScores.length,
      result: savedScores,
      bulkResult: {
        matchedCount:
          result.matchedCount || 0,
        modifiedCount:
          result.modifiedCount || 0,
        upsertedCount:
          result.upsertedCount || 0
      }
    });
  } catch (error) {
    return sendControllerError(
      res,
      error,
      "Failed to save scores"
    );
  }
};

// ======================================================
// DELETE SCORE
// ======================================================

const deleteScore = async (
  req,
  res
) => {
  try {
    assertAllowedRole(req);

    const id = getId(
      req.params.id
    );

    if (!isValidObjectId(id)) {
      return res.status(400).send({
        err: "Score ID មិនត្រឹមត្រូវ"
      });
    }

    const branchFilter =
      buildBranchFilter(req);

    const existingScore =
      await ScoreModel.findOne({
        _id: id,
        ...branchFilter
      }).select(
        "_id branch class"
      );

    if (!existingScore) {
      return res.status(404).send({
        err: "Score not found"
      });
    }

    if (isTeacher(req)) {
      const teacherId =
        getUserTeacherId(req);

      if (
        !teacherId ||
        !isValidObjectId(
          teacherId
        )
      ) {
        return res.status(403).send({
          err: "គណនីគ្រូនេះមិនទាន់ភ្ជាប់ទៅ Teacher profile ទេ"
        });
      }

      const foundClass =
        await ClassesModel.findOne({
          _id: existingScore.class,
          branch:
            existingScore.branch,
          teacher: teacherId
        }).select("_id");

      if (!foundClass) {
        return res.status(403).send({
          err: "អ្នកមិនមានសិទ្ធិលុបពិន្ទុនេះទេ"
        });
      }
    }

    const deletedScore =
      await ScoreModel.findOneAndDelete({
        _id: existingScore._id,
        branch:
          existingScore.branch
      });

    return res.status(200).send({
      msg:
        "Score deleted successfully",
      result: deletedScore
    });
  } catch (error) {
    return sendControllerError(
      res,
      error,
      "Failed to delete score"
    );
  }
};

module.exports = {
  getScoresByClass,
  saveScore,
  deleteScore
};