const mongoose = require("mongoose");

const StudentModel = require("./students.model");
const ClassesModel = require("../classes/classes.model");
const BranchModel = require("../branches/branches.model");

const {
  removeLocalFile
} = require("../shared/removeLocalFile");

// ======================================================
// Basic helpers
// ======================================================

const toIdString = (value) => {
  return String(value?._id || value || "").trim();
};

const isValidObjectId = (value) => {
  return mongoose.Types.ObjectId.isValid(
    toIdString(value)
  );
};

const getUserRole = (req) => {
  return String(req.user?.role || "")
    .trim()
    .toLowerCase();
};

const isAdmin = (req) => {
  return getUserRole(req) === "admin";
};

const isTeacher = (req) => {
  return getUserRole(req) === "teacher";
};

const getUserTeacherId = (req) => {
  return toIdString(req.user?.teacher);
};

const getUserBranchId = (req) => {
  return toIdString(req.user?.branch);
};

const isGlobalAdmin = (req) => {
  return isAdmin(req) && !getUserBranchId(req);
};

const createHttpError = (
  message,
  status = 400
) => {
  const error = new Error(message);
  error.status = status;

  return error;
};

const escapeRegex = (value = "") => {
  return String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
};

const hasOwnProperty = (object, key) => {
  return Object.prototype.hasOwnProperty.call(
    object,
    key
  );
};

// ======================================================
// Uploaded image helpers
// ======================================================

const getUploadedStudentImagePath = (req) => {
  if (!req.file?.filename) {
    return "";
  }

  return `/uploads/students/${req.file.filename}`;
};

const removeUploadedFileIfExists = (req) => {
  const uploadedImagePath =
    getUploadedStudentImagePath(req);

  if (uploadedImagePath) {
    removeLocalFile(uploadedImagePath);
  }
};

// ======================================================
// Request parsing helpers
// ======================================================

const parseObjectField = (
  value,
  fieldName
) => {
  if (
    value === undefined ||
    value === null
  ) {
    return value;
  }

  if (
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value;
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return {};
    }

    try {
      const parsedValue =
        JSON.parse(trimmedValue);

      if (
        typeof parsedValue !== "object" ||
        Array.isArray(parsedValue) ||
        parsedValue === null
      ) {
        throw new Error();
      }

      return parsedValue;
    } catch (error) {
      throw createHttpError(
        `${fieldName} must be a valid object`
      );
    }
  }

  throw createHttpError(
    `${fieldName} must be a valid object`
  );
};

const getGradeInput = (body = {}) => {
  if (hasOwnProperty(body, "grade")) {
    return {
      exists: true,
      value: body.grade
    };
  }

  if (hasOwnProperty(body, "classId")) {
    return {
      exists: true,
      value: body.classId
    };
  }

  if (hasOwnProperty(body, "class")) {
    return {
      exists: true,
      value: body.class
    };
  }

  return {
    exists: false,
    value: undefined
  };
};

const normalizeGrade = (value) => {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const normalizedValue =
    toIdString(value);

  if (
    !normalizedValue ||
    normalizedValue === "null" ||
    normalizedValue === "undefined"
  ) {
    return null;
  }

  if (!isValidObjectId(normalizedValue)) {
    throw createHttpError(
      "Class ID មិនត្រឹមត្រូវ"
    );
  }

  return normalizedValue;
};

const normalizeStudentPayload = (
  body = {},
  { partial = false } = {}
) => {
  const payload = {};

  const allowedFields = [
    "khmerName",
    "englishName",
    "studentId",
    "gender",
    "birthDate",
    "joinDate",
    "status"
  ];

  allowedFields.forEach((field) => {
    if (
      hasOwnProperty(body, field) &&
      body[field] !== undefined
    ) {
      payload[field] = body[field];
    }
  });

  if (
    hasOwnProperty(body, "nationality")
  ) {
    if (
      typeof body.nationality === "string" &&
      !body.nationality.trim().startsWith("{")
    ) {
      payload.nationality = {
        student: body.nationality.trim()
      };
    } else {
      payload.nationality =
        parseObjectField(
          body.nationality,
          "nationality"
        );
    }
  } else if (!partial) {
    payload.nationality = {
      student: "ខ្មែរ"
    };
  }

  if (
    hasOwnProperty(
      body,
      "currentResidence"
    )
  ) {
    payload.currentResidence =
      parseObjectField(
        body.currentResidence,
        "currentResidence"
      );
  }

  if (hasOwnProperty(body, "family")) {
    payload.family = parseObjectField(
      body.family,
      "family"
    );
  }

  const gradeInput = getGradeInput(body);

  if (gradeInput.exists) {
    payload.grade = normalizeGrade(
      gradeInput.value
    );
  }

  return {
    payload,
    hasGradeInput: gradeInput.exists
  };
};

// ======================================================
// Branch helpers
// ======================================================

const getRequestedBranchId = (req) => {
  return (
    toIdString(req.body?.branch) ||
    toIdString(req.body?.branchId) ||
    toIdString(req.query?.branch) ||
    toIdString(req.query?.branchId) ||
    ""
  );
};

const getRequestedReadBranchId = (req) => {
  return (
    toIdString(req.query?.branch) ||
    toIdString(req.query?.branchId) ||
    ""
  );
};

/*
  Global admin:
  - Must provide branch when creating a student.
  - Can change a student's branch.

  Branch admin:
  - Branch always comes from req.user.branch.
  - Cannot assign a different branch.
*/
const resolveBranchForWrite = async (
  req,
  currentBranchId = null
) => {
  const requestedBranchId =
    getRequestedBranchId(req);

  let branchId = "";

  if (isGlobalAdmin(req)) {
    branchId =
      requestedBranchId ||
      toIdString(currentBranchId);
  } else {
    const userBranchId =
      getUserBranchId(req);

    if (
      !userBranchId ||
      !isValidObjectId(userBranchId)
    ) {
      throw createHttpError(
        "គណនី Admin នេះមិនទាន់ភ្ជាប់ទៅសាខាទេ",
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

  if (!branchId) {
    throw createHttpError(
      "Branch is required"
    );
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

  return branch._id;
};

const buildBranchFilter = (req) => {
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
// Class validation
// ======================================================

const validateClassForBranch = async (
  classId,
  branchId
) => {
  if (!classId) {
    return null;
  }

  if (!isValidObjectId(classId)) {
    throw createHttpError(
      "Class ID មិនត្រឹមត្រូវ"
    );
  }

  const foundClass =
    await ClassesModel.findOne({
      _id: classId,
      branch: branchId
    }).select("_id branch");

  if (!foundClass) {
    throw createHttpError(
      "Class not found in the selected branch",
      404
    );
  }

  return foundClass;
};

// ======================================================
// Teacher access helpers
// ======================================================

const getTeacherClassData = async (
  req,
  branchId
) => {
  const teacherId =
    getUserTeacherId(req);

  if (
    !teacherId ||
    !isValidObjectId(teacherId)
  ) {
    return {
      classIds: [],
      studentIds: []
    };
  }

  const teacherClasses =
    await ClassesModel.find({
      teacher: teacherId,
      branch: branchId
    }).select("_id students");

  const classIds = teacherClasses.map(
    (classDocument) =>
      classDocument._id
  );

  const studentIds =
    teacherClasses.flatMap(
      (classDocument) =>
        classDocument.students || []
    );

  return {
    classIds,
    studentIds
  };
};

const buildTeacherStudentQuery = async (
  req
) => {
  if (!isTeacher(req)) {
    return {};
  }

  const branchId =
    getUserBranchId(req);

  if (
    !branchId ||
    !isValidObjectId(branchId)
  ) {
    throw createHttpError(
      "គណនីគ្រូនេះមិនទាន់ភ្ជាប់ទៅសាខាទេ",
      403
    );
  }

  const {
    classIds,
    studentIds
  } = await getTeacherClassData(
    req,
    branchId
  );

  /*
    Keep legacy class and classId checks
    temporarily for old student records.
  */
  return {
    $or: [
      {
        _id: {
          $in: studentIds
        }
      },
      {
        grade: {
          $in: classIds
        }
      },
      {
        class: {
          $in: classIds
        }
      },
      {
        classId: {
          $in: classIds
        }
      }
    ]
  };
};

const mergeQueries = (...queries) => {
  const validQueries = queries.filter(
    (query) =>
      query &&
      Object.keys(query).length > 0
  );

  if (validQueries.length === 0) {
    return {};
  }

  if (validQueries.length === 1) {
    return validQueries[0];
  }

  return {
    $and: validQueries
  };
};

const buildStudentAccessQuery = async (
  req
) => {
  if (
    !isAdmin(req) &&
    !isTeacher(req)
  ) {
    throw createHttpError(
      "អ្នកមិនមានសិទ្ធិប្រើប្រាស់ទិន្នន័យសិស្សទេ",
      403
    );
  }

  const branchQuery =
    buildBranchFilter(req);

  const teacherQuery =
    await buildTeacherStudentQuery(req);

  return mergeQueries(
    branchQuery,
    teacherQuery
  );
};

// ======================================================
// Search and populate
// ======================================================

const buildSearchQuery = (search) => {
  const keyword = String(
    search || ""
  ).trim();

  if (!keyword) {
    return {};
  }

  const searchRegex = new RegExp(
    escapeRegex(keyword),
    "i"
  );

  return {
    $or: [
      {
        khmerName: searchRegex
      },
      {
        englishName: searchRegex
      },
      {
        studentId: searchRegex
      },
      {
        idCode: searchRegex
      }
    ]
  };
};

const populateStudent = (query) => {
  return query
    .populate(
      "branch",
      "branchCode branchName status"
    )
    .populate(
      "grade",
      "classNumber className classGrade timeStudy yearOnStudy teacher branch status"
    );
};

const populateStudentDocument = async (
  student
) => {
  await student.populate([
    {
      path: "branch",
      select:
        "branchCode branchName status"
    },
    {
      path: "grade",
      select:
        "classNumber className classGrade timeStudy yearOnStudy teacher branch status"
    }
  ]);

  return student;
};

// ======================================================
// Controller error handling
// ======================================================

const sendControllerError = (
  res,
  error
) => {
  if (error?.code === 11000) {
    return res.status(409).send({
      err: "Student ID already exists in this branch"
    });
  }

  if (
    error?.name === "ValidationError"
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

  if (error?.name === "CastError") {
    return res.status(400).send({
      err: "Invalid ID"
    });
  }

  return res
    .status(error?.status || 500)
    .send({
      err:
        error?.message ||
        "Internal server error"
    });
};

// ======================================================
// CREATE
// ======================================================

exports.createStudent = async (
  req,
  res
) => {
  let createdStudent = null;

  try {
    if (!isAdmin(req)) {
      throw createHttpError(
        "មានតែ Admin ប៉ុណ្ណោះដែលអាចបង្កើតសិស្សបាន",
        403
      );
    }

    const {
      payload
    } = normalizeStudentPayload(
      req.body,
      {
        partial: false
      }
    );

    const branchId =
      await resolveBranchForWrite(req);

    payload.branch = branchId;

    if (payload.grade) {
      await validateClassForBranch(
        payload.grade,
        branchId
      );
    }

    const uploadedImagePath =
      getUploadedStudentImagePath(req);

    if (uploadedImagePath) {
      payload.profileImage =
        uploadedImagePath;
    }

    createdStudent =
      await StudentModel.create(payload);

    if (createdStudent.grade) {
      try {
        await ClassesModel.findOneAndUpdate(
          {
            _id: createdStudent.grade,
            branch: branchId
          },
          {
            $addToSet: {
              students:
                createdStudent._id
            }
          }
        );
      } catch (classUpdateError) {
        await StudentModel.findByIdAndDelete(
          createdStudent._id
        );

        throw classUpdateError;
      }
    }

    await populateStudentDocument(
      createdStudent
    );

    return res.status(201).send(
      createdStudent
    );
  } catch (error) {
    removeUploadedFileIfExists(req);

    return sendControllerError(
      res,
      error
    );
  }
};

// ======================================================
// READ ALL
// ======================================================

exports.findAllStudent = async (
  req,
  res
) => {
  try {
    const accessQuery =
      await buildStudentAccessQuery(req);

    const searchQuery =
      buildSearchQuery(
        req.query.search
      );

    const filters = {};

    if (
      req.query.status &&
      req.query.status !== "All"
    ) {
      const status = String(
        req.query.status
      )
        .trim()
        .toLowerCase();

      const allowedStatuses = [
        "active",
        "suspended",
        "dropped",
        "graduated"
      ];

      if (
        !allowedStatuses.includes(
          status
        )
      ) {
        return res.status(400).send({
          err: "Invalid student status"
        });
      }

      filters.status = status;
    }

    const requestedGrade =
      req.query.grade ||
      req.query.class ||
      req.query.classId;

    if (
      requestedGrade &&
      requestedGrade !== "All"
    ) {
      if (
        !isValidObjectId(
          requestedGrade
        )
      ) {
        return res.status(400).send({
          err: "Class ID មិនត្រឹមត្រូវ"
        });
      }

      filters.grade =
        requestedGrade;
    }

    const query = mergeQueries(
      accessQuery,
      searchQuery,
      filters
    );

    const result =
      await populateStudent(
        StudentModel.find(query).sort({
          createdAt: -1
        })
      );

    return res.status(200).send(
      result
    );
  } catch (error) {
    return sendControllerError(
      res,
      error
    );
  }
};

// ======================================================
// READ ONE
// ======================================================

exports.getOneStudent = async (
  req,
  res
) => {
  try {
    const id = toIdString(
      req.params.id
    );

    if (!isValidObjectId(id)) {
      return res.status(400).send({
        err: "Student ID មិនត្រឹមត្រូវ"
      });
    }

    const accessQuery =
      await buildStudentAccessQuery(req);

    const result =
      await populateStudent(
        StudentModel.findOne(
          mergeQueries(
            {
              _id: id
            },
            accessQuery
          )
        )
      );

    if (!result) {
      return res.status(404).send({
        err:
          isTeacher(req)
            ? "Student not found or you do not have permission"
            : "Student not found"
      });
    }

    return res.status(200).send(
      result
    );
  } catch (error) {
    return sendControllerError(
      res,
      error
    );
  }
};

// ======================================================
// UPDATE
// ======================================================

exports.updateStudent = async (
  req,
  res
) => {
  let newImageSavedInDatabase = false;

  try {
    if (!isAdmin(req)) {
      throw createHttpError(
        "មានតែ Admin ប៉ុណ្ណោះដែលអាចកែប្រែសិស្សបាន",
        403
      );
    }

    const id = toIdString(
      req.params.id
    );

    if (!isValidObjectId(id)) {
      throw createHttpError(
        "Student ID មិនត្រឹមត្រូវ"
      );
    }

    const branchFilter =
      buildBranchFilter(req);

    const existingStudent =
      await StudentModel.findOne(
        mergeQueries(
          {
            _id: id
          },
          branchFilter
        )
      );

    if (!existingStudent) {
      throw createHttpError(
        "Student not found",
        404
      );
    }

    const {
      payload,
      hasGradeInput
    } = normalizeStudentPayload(
      req.body,
      {
        partial: true
      }
    );

    const oldBranchId =
      toIdString(
        existingStudent.branch
      );

    const oldClassId =
      toIdString(
        existingStudent.grade
      );

    const nextBranchId =
      toIdString(
        await resolveBranchForWrite(
          req,
          existingStudent.branch
        )
      );

    const branchChanged =
      oldBranchId !== nextBranchId;

    payload.branch = nextBranchId;

    /*
      If a global admin moves a student to another branch
      without selecting a new class, clear the old class.
    */
    if (
      branchChanged &&
      !hasGradeInput
    ) {
      payload.grade = null;
    }

    const nextClassId =
      hasOwnProperty(payload, "grade")
        ? toIdString(payload.grade)
        : oldClassId;

    if (nextClassId) {
      await validateClassForBranch(
        nextClassId,
        nextBranchId
      );
    }

    const uploadedImagePath =
      getUploadedStudentImagePath(req);

    const oldProfileImage =
      existingStudent.profileImage;

    if (uploadedImagePath) {
      payload.profileImage =
        uploadedImagePath;
    }

    existingStudent.set(payload);

    await existingStudent.save();

    newImageSavedInDatabase =
      Boolean(uploadedImagePath);

    const finalClassId =
      toIdString(
        existingStudent.grade
      );

    if (
      oldClassId &&
      oldClassId !== finalClassId
    ) {
      await ClassesModel.findByIdAndUpdate(
        oldClassId,
        {
          $pull: {
            students: existingStudent._id
          }
        }
      );
    }

    if (finalClassId) {
      await ClassesModel.findOneAndUpdate(
        {
          _id: finalClassId,
          branch: nextBranchId
        },
        {
          $addToSet: {
            students: existingStudent._id
          }
        }
      );
    }

    /*
      Delete the previous image only after the
      student and class updates succeed.
    */
    if (
      uploadedImagePath &&
      oldProfileImage &&
      oldProfileImage !==
        uploadedImagePath
    ) {
      removeLocalFile(
        oldProfileImage
      );
    }

    await populateStudentDocument(
      existingStudent
    );

    return res.status(200).send(
      existingStudent
    );
  } catch (error) {
    /*
      Only remove the uploaded image when it was
      not saved as the student's current image.
    */
    if (!newImageSavedInDatabase) {
      removeUploadedFileIfExists(req);
    }

    return sendControllerError(
      res,
      error
    );
  }
};

// ======================================================
// DELETE
// ======================================================

exports.deleteStudent = async (
  req,
  res
) => {
  try {
    if (!isAdmin(req)) {
      throw createHttpError(
        "មានតែ Admin ប៉ុណ្ណោះដែលអាចលុបសិស្សបាន",
        403
      );
    }

    const id = toIdString(
      req.params.id
    );

    if (!isValidObjectId(id)) {
      return res.status(400).send({
        err: "Student ID មិនត្រឹមត្រូវ"
      });
    }

    const result =
      await StudentModel.findOneAndDelete(
        mergeQueries(
          {
            _id: id
          },
          buildBranchFilter(req)
        )
      );

    if (!result) {
      return res.status(404).send({
        err: "Student not found"
      });
    }

    await ClassesModel.updateMany(
      {
        students: result._id
      },
      {
        $pull: {
          students: result._id
        }
      }
    );

    if (result.profileImage) {
      removeLocalFile(
        result.profileImage
      );
    }

    return res.status(200).send({
      msg:
        "Student deleted successfully.",
      result
    });
  } catch (error) {
    return sendControllerError(
      res,
      error
    );
  }
};