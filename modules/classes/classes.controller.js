const mongoose = require("mongoose");

const ClassesModel = require("./classes.model");
const StudentModel = require("../students/students.model");
const TeacherModel = require("../teachers/teachers.model");
const BranchModel = require("../branches/branches.model");

const CLASS_STATUSES = [
  "active",
  "finished",
  "archived"
];

const STUDY_TIMES = [
  "ព្រឹក",
  "ល្ងាច",
  "យប់"
];

// ======================================================
// Basic helpers
// ======================================================

const getId = (value) => {
  return String(value?._id || value || "").trim();
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

const hasOwnProperty = (object, key) => {
  return Object.prototype.hasOwnProperty.call(
    object,
    key
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

const assertAdmin = (req) => {
  if (!isAdmin(req)) {
    throw createHttpError(
      "មានតែ Admin ប៉ុណ្ណោះដែលអាចប្រើមុខងារនេះបាន",
      403
    );
  }
};

const assertReadableRole = (req) => {
  if (
    !isAdmin(req) &&
    !isTeacher(req)
  ) {
    throw createHttpError(
      "អ្នកមិនមានសិទ្ធិមើលទិន្នន័យថ្នាក់ទេ",
      403
    );
  }
};

const escapeRegex = (value = "") => {
  return String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
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

const getRequestedReadBranchId = (req) => {
  return (
    getId(req.query?.branchId) ||
    getId(req.query?.branch) ||
    ""
  );
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

  return getId(branch._id);
};

const resolveBranchForCreate = async (
  req
) => {
  assertAdmin(req);

  const requestedBranchId =
    getRequestedBranchId(req);

  if (isGlobalAdmin(req)) {
    if (!requestedBranchId) {
      throw createHttpError(
        "សូមជ្រើសរើសសាខា"
      );
    }

    return ensureActiveBranch(
      requestedBranchId
    );
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

  return ensureActiveBranch(
    userBranchId
  );
};

const buildBranchFilter = (req) => {
  assertReadableRole(req);

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

const resolveBranchForUpdate = async (
  req,
  existingClass
) => {
  const currentBranchId = getId(
    existingClass?.branch
  );

  const requestedBranchId = getId(
    req.body?.branch ||
    req.body?.branchId
  );

  /*
    Global Admin:
    - Existing branch: keep it immutable.
    - Legacy branch:null: allow assigning an active branch.
  */
  if (isGlobalAdmin(req)) {
    if (currentBranchId) {
      if (
        requestedBranchId &&
        requestedBranchId !== currentBranchId
      ) {
        throw createHttpError(
          "Class branch cannot be changed after creation"
        );
      }

      return ensureActiveBranch(
        currentBranchId
      );
    }

    if (!requestedBranchId) {
      throw createHttpError(
        "សូមជ្រើសរើសសាខាសម្រាប់ថ្នាក់ចាស់នេះ"
      );
    }

    return ensureActiveBranch(
      requestedBranchId
    );
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
    !currentBranchId ||
    currentBranchId !== userBranchId
  ) {
    throw createHttpError(
      "Class not found or access denied",
      404
    );
  }

  if (
    requestedBranchId &&
    requestedBranchId !== userBranchId
  ) {
    throw createHttpError(
      "អ្នកមិនមានសិទ្ធិប្ដូរសាខារបស់ថ្នាក់នេះទេ",
      403
    );
  }

  return ensureActiveBranch(
    userBranchId
  );
};

// ======================================================
// Search and payload helpers
// ======================================================

const buildClassSearchQuery = (
  search
) => {
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
        className: searchRegex
      },
      {
        classGrade: searchRegex
      },
      {
        typeOfClass: searchRegex
      },
      {
        yearOnStudy: searchRegex
      },
      {
        timeStudy: searchRegex
      }
    ]
  };
};

const parseArrayInput = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return [];
  }

  if (typeof value === "string") {
    const trimmedValue =
      value.trim();

    if (!trimmedValue) {
      return [];
    }

    if (
      trimmedValue.startsWith("[")
    ) {
      try {
        const parsedValue =
          JSON.parse(trimmedValue);

        return Array.isArray(parsedValue)
          ? parsedValue
          : [parsedValue];
      } catch (error) {
        throw createHttpError(
          "studentIds must be a valid array"
        );
      }
    }

    return trimmedValue
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [value];
};

const normalizeStudentIds = (
  body = {}
) => {
  let values = [];

  if (
    hasOwnProperty(body, "students")
  ) {
    values = parseArrayInput(
      body.students
    );
  } else if (
    hasOwnProperty(body, "studentIds")
  ) {
    values = parseArrayInput(
      body.studentIds
    );
  } else if (
    hasOwnProperty(body, "studentId")
  ) {
    values = [body.studentId];
  }

  return [
    ...new Set(
      values
        .map(getId)
        .filter(Boolean)
    )
  ];
};

const normalizeClassPayload = (
  body = {},
  {
    partial = false
  } = {}
) => {
  const payload = {};

  const normalFields = [
    "classNumber",
    "className",
    "classGrade",
    "typeOfClass",
    "yearOnStudy",
    "timeStudy",
    "status"
  ];

  normalFields.forEach((field) => {
    if (
      hasOwnProperty(body, field)
    ) {
      payload[field] = body[field];
    }
  });

  if (
    hasOwnProperty(body, "teacher")
  ) {
    const teacherId = getId(
      body.teacher
    );

    if (
      teacherId &&
      !isValidObjectId(teacherId)
    ) {
      throw createHttpError(
        "Teacher ID is not valid"
      );
    }

    payload.teacher =
      teacherId || null;
  }

  const hasStudentsInput =
    hasOwnProperty(body, "students") ||
    hasOwnProperty(body, "studentIds") ||
    hasOwnProperty(body, "studentId");

  if (hasStudentsInput) {
    payload.students =
      normalizeStudentIds(body);
  }

  if (
    payload.classNumber !== undefined &&
    payload.classNumber !== ""
  ) {
    payload.classNumber = Number(
      payload.classNumber
    );

    if (
      !Number.isFinite(
        payload.classNumber
      ) ||
      payload.classNumber < 1
    ) {
      throw createHttpError(
        "Class Number must be greater than 0"
      );
    }
  }

  [
    "className",
    "classGrade",
    "typeOfClass",
    "yearOnStudy",
    "timeStudy"
  ].forEach((field) => {
    if (payload[field] !== undefined) {
      payload[field] = String(
        payload[field] || ""
      ).trim();
    }
  });

  if (
    payload.timeStudy !== undefined &&
    !STUDY_TIMES.includes(
      payload.timeStudy
    )
  ) {
    throw createHttpError(
      "Invalid study time"
    );
  }

  if (payload.status !== undefined) {
    payload.status = String(
      payload.status || ""
    )
      .trim()
      .toLowerCase();

    if (
      !CLASS_STATUSES.includes(
        payload.status
      )
    ) {
      throw createHttpError(
        "Invalid class status"
      );
    }
  }

  if (!partial) {
    payload.students =
      payload.students || [];
  }

  return {
    payload,
    hasStudentsInput
  };
};

// ======================================================
// Related record validation
// ======================================================

const validateTeacherForBranch = async (
  teacherId,
  branchId
) => {
  if (!teacherId) {
    return null;
  }

  if (!isValidObjectId(teacherId)) {
    throw createHttpError(
      "Teacher ID is not valid"
    );
  }

  const teacher =
    await TeacherModel.findOne({
      _id: teacherId,
      branch: branchId,
      $or: [
        {
          status: "active"
        },
        {
          status: {
            $exists: false
          }
        }
      ]
    }).select("_id branch status");

  if (!teacher) {
    throw createHttpError(
      "Active teacher was not found in this branch",
      404
    );
  }

  return teacher;
};

const validateStudentsForBranch = async (
  studentIds,
  branchId,
  {
    allowLegacyWithoutBranch = false
  } = {}
) => {
  const cleanStudentIds = [
    ...new Set(
      studentIds
        .map(getId)
        .filter(Boolean)
    )
  ];

  if (cleanStudentIds.length === 0) {
    return [];
  }

  const invalidStudentId =
    cleanStudentIds.find(
      (id) => !isValidObjectId(id)
    );

  if (invalidStudentId) {
    throw createHttpError(
      "Student ID មិនត្រឹមត្រូវ"
    );
  }

  const branchFilter =
    allowLegacyWithoutBranch
      ? {
          $or: [
            {
              branch: branchId
            },
            {
              branch: null
            },
            {
              branch: {
                $exists: false
              }
            }
          ]
        }
      : {
          branch: branchId
        };

  const students =
    await StudentModel.find({
      _id: {
        $in: cleanStudentIds
      },
      ...branchFilter
    }).select("_id branch grade");

  if (
    students.length !==
    cleanStudentIds.length
  ) {
    throw createHttpError(
      allowLegacyWithoutBranch
        ? "មានសិស្សខ្លះស្ថិតនៅសាខាផ្សេងពីសាខាថ្មីរបស់ថ្នាក់"
        : "មានសិស្សខ្លះរកមិនឃើញក្នុងសាខានេះ",
      404
    );
  }

  return students;
};

// ======================================================
// Student/class synchronization
// ======================================================

const removeStudentsFromOtherClasses =
  async (
    studentIds,
    targetClassId,
    branchId
  ) => {
    if (studentIds.length === 0) {
      return;
    }

    await ClassesModel.updateMany(
      {
        branch: branchId,
        _id: {
          $ne: targetClassId
        },
        students: {
          $in: studentIds
        }
      },
      {
        $pull: {
          students: {
            $in: studentIds
          }
        }
      }
    );
  };

const syncStudentsToClass = async (
  studentIds,
  classId,
  branchId
) => {
  if (studentIds.length === 0) {
    return;
  }

  await StudentModel.updateMany(
    {
      branch: branchId,
      _id: {
        $in: studentIds
      }
    },
    {
      $set: {
        grade: classId
      }
    },
    {
      runValidators: true
    }
  );
};

const unsyncStudentsFromClass =
  async (
    studentIds,
    classId,
    branchId
  ) => {
    if (studentIds.length === 0) {
      return;
    }

    await StudentModel.updateMany(
      {
        branch: branchId,
        _id: {
          $in: studentIds
        },
        grade: classId
      },
      {
        $unset: {
          grade: ""
        }
      }
    );
  };

// ======================================================
// Teacher access
// ======================================================

const applyTeacherClassFilter = (
  req,
  query
) => {
  if (!isTeacher(req)) {
    return query;
  }

  const teacherId =
    getUserTeacherId(req);

  if (
    !teacherId ||
    !isValidObjectId(teacherId)
  ) {
    throw createHttpError(
      "គណនីគ្រូនេះមិនទាន់ភ្ជាប់ទៅ Teacher profile ទេ",
      403
    );
  }

  query.teacher = teacherId;

  return query;
};

// ======================================================
// Populate
// ======================================================

const populateClassQuery = (query) => {
  return query
    .populate(
      "branch",
      "branchCode branchName status"
    )
    .populate(
      "teacher",
      "khmerName englishName phone profileImage skill branch status"
    )
    .populate(
      "students",
      "khmerName englishName studentId gender profileImage status branch grade"
    );
};

const populateClassDocument =
  async (classDocument) => {
    await classDocument.populate([
      {
        path: "branch",
        select:
          "branchCode branchName status"
      },
      {
        path: "teacher",
        select:
          "khmerName englishName phone profileImage skill branch status"
      },
      {
        path: "students",
        select:
          "khmerName englishName studentId gender profileImage status branch grade"
      }
    ]);

    return classDocument;
  };

// ======================================================
// Error handling
// ======================================================

const sendControllerError = (
  res,
  error,
  fallbackMessage
) => {
  if (error?.code === 11000) {
    return res.status(409).send({
      err: "ថ្នាក់នេះមានរួចហើយ សូមពិនិត្យ classNumber / yearOnStudy / timeStudy"
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
        fallbackMessage ||
        "Internal server error"
    });
};

// ======================================================
// CREATE CLASS
// ======================================================

exports.createClass = async (
  req,
  res
) => {
  try {
    assertAdmin(req);

    const branchId =
      await resolveBranchForCreate(req);

    const {
      payload
    } = normalizeClassPayload(
      req.body,
      {
        partial: false
      }
    );

    await validateTeacherForBranch(
      payload.teacher,
      branchId
    );

    await validateStudentsForBranch(
      payload.students,
      branchId
    );

    payload.branch = branchId;

    const result =
      await ClassesModel.create(
        payload
      );

    if (payload.students.length > 0) {
      await removeStudentsFromOtherClasses(
        payload.students,
        result._id,
        branchId
      );

      await syncStudentsToClass(
        payload.students,
        result._id,
        branchId
      );
    }

    await populateClassDocument(
      result
    );

    return res.status(201).send(
      result
    );
  } catch (error) {
    return sendControllerError(
      res,
      error,
      "Cannot create class"
    );
  }
};

// ======================================================
// READ ALL CLASSES
// ======================================================

exports.findAllClass = async (
  req,
  res
) => {
  try {
    assertReadableRole(req);

    let query = {
      ...buildBranchFilter(req),
      ...buildClassSearchQuery(
        req.query.search
      )
    };

    query =
      applyTeacherClassFilter(
        req,
        query
      );

    if (
      req.query.status &&
      req.query.status !== "All"
    ) {
      const status = String(
        req.query.status
      )
        .trim()
        .toLowerCase();

      if (
        !CLASS_STATUSES.includes(
          status
        )
      ) {
        throw createHttpError(
          "Invalid class status"
        );
      }

      query.status = status;
    }

    if (
      req.query.yearOnStudy &&
      req.query.yearOnStudy !== "All"
    ) {
      query.yearOnStudy = String(
        req.query.yearOnStudy
      ).trim();
    }

    if (
      req.query.timeStudy &&
      req.query.timeStudy !== "All"
    ) {
      if (
        !STUDY_TIMES.includes(
          req.query.timeStudy
        )
      ) {
        throw createHttpError(
          "Invalid study time"
        );
      }

      query.timeStudy =
        req.query.timeStudy;
    }

    if (
      req.query.classGrade &&
      req.query.classGrade !== "All"
    ) {
      query.classGrade = String(
        req.query.classGrade
      ).trim();
    }

    if (
      req.query.typeOfClass &&
      req.query.typeOfClass !== "All"
    ) {
      query.typeOfClass = String(
        req.query.typeOfClass
      ).trim();
    }

    const requestedTeacherId =
      req.query.teacherId ||
      req.query.teacher;

    if (
      requestedTeacherId &&
      requestedTeacherId !== "All"
    ) {
      if (
        !isValidObjectId(
          requestedTeacherId
        )
      ) {
        throw createHttpError(
          "Teacher ID is not valid"
        );
      }

      if (
        isTeacher(req) &&
        getId(requestedTeacherId) !==
          getUserTeacherId(req)
      ) {
        throw createHttpError(
          "អ្នកមិនមានសិទ្ធិមើលថ្នាក់របស់គ្រូនេះទេ",
          403
        );
      }

      query.teacher =
        requestedTeacherId;
    }

    const result =
      await populateClassQuery(
        ClassesModel.find(query)
          .sort({
            createdAt: -1
          })
      );

    return res.status(200).send(
      result
    );
  } catch (error) {
    return sendControllerError(
      res,
      error,
      "Cannot get classes"
    );
  }
};

// ======================================================
// READ ONE CLASS
// ======================================================

exports.getOneClass = async (
  req,
  res
) => {
  try {
    assertReadableRole(req);

    const classId = getId(
      req.params.id
    );

    if (!isValidObjectId(classId)) {
      throw createHttpError(
        "Class ID មិនត្រឹមត្រូវ"
      );
    }

    let query = {
      _id: classId,
      ...buildBranchFilter(req)
    };

    query =
      applyTeacherClassFilter(
        req,
        query
      );

    const result =
      await populateClassQuery(
        ClassesModel.findOne(query)
      );

    if (!result) {
      throw createHttpError(
        "Class not found or access denied",
        404
      );
    }

    return res.status(200).send(
      result
    );
  } catch (error) {
    return sendControllerError(
      res,
      error,
      "Cannot get class"
    );
  }
};

// ======================================================
// UPDATE CLASS
// ======================================================

exports.updateClass = async (
  req,
  res
) => {
  try {
    assertAdmin(req);

    const classId = getId(
      req.params.id
    );

    if (!isValidObjectId(classId)) {
      throw createHttpError(
        "Class ID មិនត្រឹមត្រូវ"
      );
    }

    const lookupFilter =
      isGlobalAdmin(req)
        ? {
            _id: classId
          }
        : {
            _id: classId,
            ...buildBranchFilter(req)
          };

    /*
      Important:
      A Global Admin looks up the Class by _id only.
      The requested target branch belongs to the update payload,
      not to the lookup filter. This supports legacy branch:null
      classes without returning "Class not found".
    */
    const existingClass =
      await ClassesModel.findOne(
        lookupFilter
      );

    if (!existingClass) {
      throw createHttpError(
        "Class not found",
        404
      );
    }

    const previousBranchId = getId(
      existingClass.branch
    );

    const branchId =
      await resolveBranchForUpdate(
        req,
        existingClass
      );

    const isAssigningLegacyBranch =
      isGlobalAdmin(req) &&
      !previousBranchId &&
      Boolean(branchId);

    const {
      payload,
      hasStudentsInput
    } = normalizeClassPayload(
      req.body,
      {
        partial: true
      }
    );

    const finalTeacherId =
      payload.teacher !== undefined
        ? payload.teacher
        : getId(existingClass.teacher);

    await validateTeacherForBranch(
      finalTeacherId,
      branchId
    );

    const oldStudentIds =
      Array.isArray(
        existingClass.students
      )
        ? existingClass.students.map(
            getId
          )
        : [];

    let newStudentIds =
      oldStudentIds;

    if (hasStudentsInput) {
      newStudentIds =
        payload.students;
    }

    if (
      hasStudentsInput ||
      isAssigningLegacyBranch
    ) {
      await validateStudentsForBranch(
        newStudentIds,
        branchId,
        {
          allowLegacyWithoutBranch:
            isAssigningLegacyBranch
        }
      );
    }

    delete payload.branch;
    delete payload.branchId;

    existingClass.set(payload);
    existingClass.branch = branchId;

    await existingClass.save();

    /*
      When a legacy Class receives its first branch, migrate only
      students that were also legacy branch:null. Students already
      assigned to a different branch were rejected above.
    */
    if (
      isAssigningLegacyBranch &&
      newStudentIds.length > 0
    ) {
      await StudentModel.updateMany(
        {
          _id: {
            $in: newStudentIds
          },
          $or: [
            {
              branch: null
            },
            {
              branch: {
                $exists: false
              }
            }
          ]
        },
        {
          $set: {
            branch: branchId,
            grade: existingClass._id
          }
        },
        {
          runValidators: true
        }
      );
    }

    if (hasStudentsInput) {
      const removedStudentIds =
        oldStudentIds.filter(
          (studentId) =>
            !newStudentIds.includes(
              studentId
            )
        );

      const addedStudentIds =
        newStudentIds.filter(
          (studentId) =>
            !oldStudentIds.includes(
              studentId
            )
        );

      if (
        isAssigningLegacyBranch &&
        removedStudentIds.length > 0
      ) {
        await StudentModel.updateMany(
          {
            _id: {
              $in: removedStudentIds
            },
            grade: existingClass._id,
            $or: [
              {
                branch: null
              },
              {
                branch: {
                  $exists: false
                }
              }
            ]
          },
          {
            $unset: {
              grade: ""
            }
          }
        );
      }

      await unsyncStudentsFromClass(
        removedStudentIds,
        existingClass._id,
        branchId
      );

      await removeStudentsFromOtherClasses(
        addedStudentIds,
        existingClass._id,
        branchId
      );

      await syncStudentsToClass(
        addedStudentIds,
        existingClass._id,
        branchId
      );
    }

    await populateClassDocument(
      existingClass
    );

    return res.status(200).send(
      existingClass
    );
  } catch (error) {
    return sendControllerError(
      res,
      error,
      "Cannot update class"
    );
  }
};

// ======================================================
// DELETE CLASS
// ======================================================

exports.deleteClass = async (
  req,
  res
) => {
  try {
    assertAdmin(req);

    const classId = getId(
      req.params.id
    );

    if (!isValidObjectId(classId)) {
      throw createHttpError(
        "Class ID មិនត្រឹមត្រូវ"
      );
    }

    const result =
      await ClassesModel.findOneAndDelete({
        _id: classId,
        ...buildBranchFilter(req)
      });

    if (!result) {
      throw createHttpError(
        "Class not found",
        404
      );
    }

    const studentIds =
      Array.isArray(result.students)
        ? result.students.map(getId)
        : [];

    await unsyncStudentsFromClass(
      studentIds,
      result._id,
      result.branch
    );

    /*
      Also clear students whose grade points to
      this class but were missing from class.students.
    */
    await StudentModel.updateMany(
      {
        branch: result.branch,
        grade: result._id
      },
      {
        $unset: {
          grade: ""
        }
      }
    );

    return res.status(200).send({
      msg:
        "Class deleted and students updated.",
      result
    });
  } catch (error) {
    return sendControllerError(
      res,
      error,
      "Cannot delete class"
    );
  }
};

// ======================================================
// ENROLL STUDENT
// ======================================================

exports.enrollStudent = async (
  req,
  res
) => {
  try {
    assertAdmin(req);

    const classId = getId(
      req.params.id
    );

    if (!isValidObjectId(classId)) {
      throw createHttpError(
        "Class ID មិនត្រឹមត្រូវ"
      );
    }

    const studentIds =
      normalizeStudentIds(req.body);

    if (studentIds.length === 0) {
      throw createHttpError(
        "សូមផ្ញើ studentId ឬ studentIds"
      );
    }

    const invalidStudentId =
      studentIds.find(
        (studentId) =>
          !isValidObjectId(studentId)
      );

    if (invalidStudentId) {
      throw createHttpError(
        "Student ID មិនត្រឹមត្រូវ"
      );
    }

    const targetClass =
      await ClassesModel.findOne({
        _id: classId,
        ...buildBranchFilter(req)
      });

    if (!targetClass) {
      throw createHttpError(
        "Class not found",
        404
      );
    }

    const branchId = getId(
      targetClass.branch
    );

    await validateStudentsForBranch(
      studentIds,
      branchId
    );

    await removeStudentsFromOtherClasses(
      studentIds,
      targetClass._id,
      branchId
    );

    await ClassesModel.updateOne(
      {
        _id: targetClass._id,
        branch: branchId
      },
      {
        $addToSet: {
          students: {
            $each: studentIds
          }
        }
      },
      {
        runValidators: true
      }
    );

    await syncStudentsToClass(
      studentIds,
      targetClass._id,
      branchId
    );

    const updatedClass =
      await populateClassQuery(
        ClassesModel.findOne({
          _id: targetClass._id,
          branch: branchId
        })
      );

    return res.status(200).send({
      msg:
        "Students enrolled successfully.",
      result: updatedClass
    });
  } catch (error) {
    return sendControllerError(
      res,
      error,
      "Cannot enroll students"
    );
  }
};

// ======================================================
// REMOVE STUDENT FROM CLASS
// ======================================================

exports.removeStudentFromClass =
  async (req, res) => {
    try {
      assertAdmin(req);

      const classId = getId(
        req.params.id
      );

      const studentId = getId(
        req.params.studentId ||
        req.body.studentId
      );

      if (
        !isValidObjectId(classId)
      ) {
        throw createHttpError(
          "Class ID មិនត្រឹមត្រូវ"
        );
      }

      if (
        !isValidObjectId(studentId)
      ) {
        throw createHttpError(
          "Student ID មិនត្រឹមត្រូវ"
        );
      }

      const targetClass =
        await ClassesModel.findOne({
          _id: classId,
          ...buildBranchFilter(req)
        }).select(
          "_id branch students"
        );

      if (!targetClass) {
        throw createHttpError(
          "Class not found",
          404
        );
      }

      const branchId = getId(
        targetClass.branch
      );

      const student =
        await StudentModel.findOne({
          _id: studentId,
          branch: branchId
        }).select("_id grade");

      if (!student) {
        throw createHttpError(
          "Student was not found in this branch",
          404
        );
      }

      await ClassesModel.updateOne(
        {
          _id: targetClass._id,
          branch: branchId
        },
        {
          $pull: {
            students: student._id
          }
        }
      );

      await unsyncStudentsFromClass(
        [student._id],
        targetClass._id,
        branchId
      );

      const updatedClass =
        await populateClassQuery(
          ClassesModel.findOne({
            _id: targetClass._id,
            branch: branchId
          })
        );

      return res.status(200).send({
        msg:
          "Student removed from class.",
        result: updatedClass
      });
    } catch (error) {
      return sendControllerError(
        res,
        error,
        "Cannot remove student from class"
      );
    }
  };