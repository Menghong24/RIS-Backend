const mongoose = require("mongoose");

const SubjectModel = require("./subjects.model");
const ClassesModel = require("../classes/classes.model");
const TeacherModel = require("../teachers/teachers.model");
const BranchModel = require("../branches/branches.model");

// ======================================================
// Helpers
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

const getUserBranchId = (req) => {
  return toIdString(req.user?.branch);
};

const isGlobalAdmin = (req) => {
  return (
    getUserRole(req) === "admin" &&
    !getUserBranchId(req)
  );
};

const getRequestedBranchId = (req) => {
  return (
    toIdString(req.body?.branch) ||
    toIdString(req.body?.branchId) ||
    toIdString(req.query?.branch) ||
    toIdString(req.query?.branchId) ||
    ""
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
// Class ID normalization
// ======================================================

const getRawClassIds = (body = {}) => {
  if (hasOwnProperty(body, "classIds")) {
    return body.classIds;
  }

  if (hasOwnProperty(body, "classes")) {
    return body.classes;
  }

  if (hasOwnProperty(body, "classId")) {
    return body.classId
      ? [body.classId]
      : [];
  }

  if (hasOwnProperty(body, "class")) {
    return body.class
      ? [body.class]
      : [];
  }

  return undefined;
};

const parseClassIds = (rawValue) => {
  if (
    rawValue === undefined ||
    rawValue === null ||
    rawValue === ""
  ) {
    return [];
  }

  let values = rawValue;

  // Support multipart/form-data JSON string
  if (typeof values === "string") {
    const trimmedValue = values.trim();

    if (!trimmedValue) {
      return [];
    }

    if (trimmedValue.startsWith("[")) {
      try {
        values = JSON.parse(trimmedValue);
      } catch (error) {
        throw createHttpError(
          "classIds must be a valid JSON array"
        );
      }
    } else if (trimmedValue.includes(",")) {
      values = trimmedValue.split(",");
    } else {
      values = [trimmedValue];
    }
  }

  if (!Array.isArray(values)) {
    values = [values];
  }

  const uniqueIds = [];

  values.forEach((value) => {
    const id = toIdString(value);

    if (!id) {
      return;
    }

    if (!isValidObjectId(id)) {
      throw createHttpError(
        `Class ID is not valid: ${id}`
      );
    }

    if (!uniqueIds.includes(id)) {
      uniqueIds.push(id);
    }
  });

  return uniqueIds;
};

// ======================================================
// Payload normalization
// ======================================================

const normalizeSubjectPayload = (
  body = {},
  { partial = false } = {}
) => {
  const payload = {};

  const allowedFields = [
    "subjectName",
    "type",
    "fee",
    "status",
    "remark"
  ];

  allowedFields.forEach((field) => {
    if (
      !partial ||
      hasOwnProperty(body, field)
    ) {
      if (body[field] !== undefined) {
        payload[field] = body[field];
      }
    }
  });

  if (hasOwnProperty(body, "teacher")) {
    if (
      body.teacher === null ||
      String(body.teacher || "").trim() === ""
    ) {
      payload.teacher = null;
    } else {
      const teacherId = toIdString(
        body.teacher
      );

      if (!isValidObjectId(teacherId)) {
        throw createHttpError(
          "Teacher ID is not valid"
        );
      }

      payload.teacher = teacherId;
    }
  } else if (!partial) {
    payload.teacher = null;
  }

  const rawClassIds = getRawClassIds(body);
  const hasClassInput =
    rawClassIds !== undefined;

  if (hasClassInput || !partial) {
    const classIds = parseClassIds(
      rawClassIds
    );

    payload.classIds = classIds;
    payload.classId =
      classIds[0] || null;
  }

  return {
    payload,
    hasClassInput
  };
};

// ======================================================
// Branch helpers
// ======================================================

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

  const branch = await BranchModel.findOne({
    _id: branchId,
    status: "active"
  }).select("_id branchCode branchName");

  if (!branch) {
    throw createHttpError(
      "Active branch was not found"
    );
  }

  return branch._id;
};

const buildBranchFilter = (req) => {
  const requestedBranchId =
    getRequestedBranchId(req);

  // Global admin can view all branches
  if (isGlobalAdmin(req)) {
    if (!requestedBranchId) {
      return {};
    }

    if (!isValidObjectId(requestedBranchId)) {
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
// Relationship validation
// ======================================================

const validateSubjectRelations = async ({
  branchId,
  classIds = [],
  teacherId = null
}) => {
  const normalizedBranchId =
    toIdString(branchId);

  if (
    !normalizedBranchId ||
    !isValidObjectId(normalizedBranchId)
  ) {
    throw createHttpError(
      "Branch ID is not valid"
    );
  }

  if (classIds.length > 0) {
    const totalClasses =
      await ClassesModel.countDocuments({
        _id: {
          $in: classIds
        },
        branch: normalizedBranchId
      });

    if (totalClasses !== classIds.length) {
      throw createHttpError(
        "One or more selected classes do not belong to this branch"
      );
    }
  }

  if (teacherId) {
    if (!isValidObjectId(teacherId)) {
      throw createHttpError(
        "Teacher ID is not valid"
      );
    }

    const teacher =
      await TeacherModel.findOne({
        _id: teacherId,
        branch: normalizedBranchId
      }).select("_id");

    if (!teacher) {
      throw createHttpError(
        "The selected teacher does not belong to this branch"
      );
    }
  }
};

// ======================================================
// Populate
// ======================================================

const populateSubject = (query) => {
  return query
    .populate(
      "branch",
      "branchCode branchName status"
    )
    .populate(
      "teacher",
      "khmerName englishName profileImage skill status branch"
    )
    .populate(
      "classIds",
      "classNumber className classGrade yearOnStudy timeStudy status branch"
    )
    .populate(
      "classId",
      "classNumber className classGrade yearOnStudy timeStudy status branch"
    );
};

const populateSubjectDocument = async (
  subject
) => {
  await subject.populate([
    {
      path: "branch",
      select:
        "branchCode branchName status"
    },
    {
      path: "teacher",
      select:
        "khmerName englishName profileImage skill status branch"
    },
    {
      path: "classIds",
      select:
        "classNumber className classGrade yearOnStudy timeStudy status branch"
    },
    {
      path: "classId",
      select:
        "classNumber className classGrade yearOnStudy timeStudy status branch"
    }
  ]);

  return subject;
};

// ======================================================
// Error handler
// ======================================================

const sendControllerError = (
  res,
  error
) => {
  if (error?.code === 11000) {
    return res.status(409).send({
      err: "Subject name already exists in this branch"
    });
  }

  if (error?.name === "ValidationError") {
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

exports.createSubject = async (
  req,
  res
) => {
  try {
    const {
      payload
    } = normalizeSubjectPayload(
      req.body,
      {
        partial: false
      }
    );

    const branchId =
      await resolveBranchForWrite(req);

    payload.branch = branchId;

    await validateSubjectRelations({
      branchId,
      classIds: payload.classIds,
      teacherId: payload.teacher
    });

    const subject =
      await SubjectModel.create(payload);

    await populateSubjectDocument(subject);

    return res.status(201).send({
      success: true,
      message:
        "Subject created successfully",
      result: subject
    });
  } catch (error) {
    return sendControllerError(
      res,
      error
    );
  }
};

// ======================================================
// READ ALL
// ======================================================

exports.getAllSubjects = async (
  req,
  res
) => {
  try {
    const query = {
      ...buildBranchFilter(req)
    };

    const search = String(
      req.query.search || ""
    ).trim();

    const type = String(
      req.query.type || ""
    )
      .trim()
      .toLowerCase();

    const status = String(
      req.query.status || ""
    )
      .trim()
      .toLowerCase();

    const requestedClassId =
      req.query.classId &&
      req.query.classId !== "All"
        ? req.query.classId
        : req.query.class &&
            req.query.class !== "All"
          ? req.query.class
          : "";

    if (search) {
      query.subjectName = {
        $regex: escapeRegex(search),
        $options: "i"
      };
    }

    if (type && type !== "all") {
      const allowedTypes = [
        "general",
        "optional",
        "skill"
      ];

      if (!allowedTypes.includes(type)) {
        return res.status(400).send({
          err: "Invalid subject type"
        });
      }

      query.type = type;
    }

    if (status && status !== "all") {
      const allowedStatuses = [
        "active",
        "disabled"
      ];

      if (
        !allowedStatuses.includes(status)
      ) {
        return res.status(400).send({
          err: "Invalid subject status"
        });
      }

      query.status = status;
    }

    if (requestedClassId) {
      if (
        !isValidObjectId(
          requestedClassId
        )
      ) {
        return res.status(400).send({
          err: "Class ID is not valid"
        });
      }

      query.$or = [
        {
          classIds: requestedClassId
        },
        {
          classId: requestedClassId
        }
      ];
    }

    if (
      req.query.teacher &&
      req.query.teacher !== "All"
    ) {
      if (
        !isValidObjectId(
          req.query.teacher
        )
      ) {
        return res.status(400).send({
          err: "Teacher ID is not valid"
        });
      }

      query.teacher =
        req.query.teacher;
    }

    const page = Math.max(
      Number.parseInt(
        req.query.page,
        10
      ) || 1,
      1
    );

    const limit = Math.min(
      Math.max(
        Number.parseInt(
          req.query.limit,
          10
        ) || 20,
        1
      ),
      100
    );

    const skip =
      (page - 1) * limit;

    const [subjects, totalSubjects] =
      await Promise.all([
        populateSubject(
          SubjectModel.find(query)
            .sort({
              createdAt: -1
            })
            .skip(skip)
            .limit(limit)
        ),

        SubjectModel.countDocuments(query)
      ]);

    return res.status(200).send({
      success: true,
      page,
      limit,
      totalSubjects,
      totalPages:
        Math.ceil(
          totalSubjects / limit
        ) || 1,
      result: subjects
    });
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

exports.getOneSubject = async (
  req,
  res
) => {
  try {
    const subjectId =
      toIdString(req.params.id);

    if (!isValidObjectId(subjectId)) {
      return res.status(400).send({
        err: "Subject ID is not valid"
      });
    }

    const subject =
      await populateSubject(
        SubjectModel.findOne({
          _id: subjectId,
          ...buildBranchFilter(req)
        })
      );

    if (!subject) {
      return res.status(404).send({
        err: "Subject not found"
      });
    }

    return res.status(200).send({
      success: true,
      result: subject
    });
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

exports.updateSubject = async (
  req,
  res
) => {
  try {
    const subjectId =
      toIdString(req.params.id);

    if (!isValidObjectId(subjectId)) {
      return res.status(400).send({
        err: "Subject ID is not valid"
      });
    }

    const subject =
      await SubjectModel.findOne({
        _id: subjectId,
        ...buildBranchFilter(req)
      });

    if (!subject) {
      return res.status(404).send({
        err: "Subject not found"
      });
    }

    const {
      payload,
      hasClassInput
    } = normalizeSubjectPayload(
      req.body,
      {
        partial: true
      }
    );

    const branchId =
      await resolveBranchForWrite(
        req,
        subject.branch
      );

    const effectiveClassIds =
      hasClassInput
        ? payload.classIds
        : (subject.classIds || []).map(
            toIdString
          );

    const effectiveTeacherId =
      hasOwnProperty(
        payload,
        "teacher"
      )
        ? payload.teacher
        : toIdString(
            subject.teacher
          ) || null;

    await validateSubjectRelations({
      branchId,
      classIds:
        effectiveClassIds,
      teacherId:
        effectiveTeacherId
    });

    payload.branch = branchId;

    subject.set(payload);

    await subject.save();
    await populateSubjectDocument(
      subject
    );

    return res.status(200).send({
      success: true,
      message:
        "Subject updated successfully",
      result: subject
    });
  } catch (error) {
    return sendControllerError(
      res,
      error
    );
  }
};

// ======================================================
// DELETE
// ======================================================

exports.deleteSubject = async (
  req,
  res
) => {
  try {
    const subjectId =
      toIdString(req.params.id);

    if (!isValidObjectId(subjectId)) {
      return res.status(400).send({
        err: "Subject ID is not valid"
      });
    }

    const subject =
      await SubjectModel.findOneAndDelete({
        _id: subjectId,
        ...buildBranchFilter(req)
      });

    if (!subject) {
      return res.status(404).send({
        err: "Subject not found"
      });
    }

    return res.status(200).send({
      success: true,
      message:
        "Subject deleted successfully",
      result: subject
    });
  } catch (error) {
    return sendControllerError(
      res,
      error
    );
  }
};