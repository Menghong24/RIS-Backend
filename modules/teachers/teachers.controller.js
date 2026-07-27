const mongoose = require("mongoose");

const TeacherModel = require("./teachers.model");
const BranchModel = require("../branches/branches.model");

const {
  removeLocalFile
} = require("../shared/removeLocalFile");

// ======================================================
// Helpers
// ======================================================

const toIdString = (value) => {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  if (typeof value === "object") {
    return String(
      value._id ||
      value.id ||
      ""
    ).trim();
  }

  return String(value).trim();
};

const isValidObjectId = (value) => {
  return mongoose.Types.ObjectId.isValid(
    toIdString(value)
  );
};

const getUserRole = (req) => {
  return String(
    req.user?.role || ""
  )
    .trim()
    .toLowerCase();
};

const getUserBranchId = (req) => {
  return toIdString(
    req.user?.branch
  );
};

const isGlobalAdmin = (req) => {
  return (
    getUserRole(req) === "admin" &&
    !getUserBranchId(req)
  );
};

const getRequestedBranchId = (req) => {
  return (
    toIdString(
      req.body?.branch
    ) ||
    toIdString(
      req.body?.branchId
    ) ||
    toIdString(
      req.query?.branch
    ) ||
    toIdString(
      req.query?.branchId
    ) ||
    ""
  );
};

const escapeRegex = (
  value = ""
) => {
  return String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
};

const createHttpError = (
  message,
  status = 400
) => {
  const error =
    new Error(message);

  error.status =
    status;

  return error;
};

// ======================================================
// Uploaded files
//
// Router must use:
//
// uploadTeacherFiles.fields([
//   {
//     name: "profileImage",
//     maxCount: 1
//   },
//   {
//     name: "cvFile",
//     maxCount: 1
//   }
// ])
// ======================================================

const getUploadedFile = (
  req,
  fieldName
) => {
  const files =
    req.files?.[fieldName];

  if (
    Array.isArray(files) &&
    files.length > 0
  ) {
    return files[0];
  }

  /*
    Backward compatibility if an old route
    still uses:

    upload.single("profileImage")
  */
  if (
    fieldName === "profileImage" &&
    req.file
  ) {
    return req.file;
  }

  return null;
};

const getUploadedTeacherImagePath = (
  req
) => {
  const file =
    getUploadedFile(
      req,
      "profileImage"
    );

  if (!file?.filename) {
    return "";
  }

  return (
    `/uploads/teachers/` +
    `${file.filename}`
  );
};

const getUploadedTeacherCvData = (
  req
) => {
  const file =
    getUploadedFile(
      req,
      "cvFile"
    );

  if (!file?.filename) {
    return null;
  }

  return {
    fileUrl:
      `/uploads/teacher-cvs/${file.filename}`,

    originalName:
      file.originalname || "",

    storedName:
      file.filename,

    mimeType:
      file.mimetype || "",

    fileSize:
      Number(file.size) || 0,

    uploadedAt:
      new Date()
  };
};

const getUploadedTeacherCvPath = (
  req
) => {
  const file =
    getUploadedFile(
      req,
      "cvFile"
    );

  if (!file?.filename) {
    return "";
  }

  return (
    `/uploads/teacher-cvs/` +
    `${file.filename}`
  );
};

const removeUploadedFilesIfExists = (
  req
) => {
  const uploadedPaths = [
    getUploadedTeacherImagePath(
      req
    ),

    getUploadedTeacherCvPath(
      req
    )
  ].filter(Boolean);

  uploadedPaths.forEach(
    (filePath) => {
      removeLocalFile(
        filePath
      );
    }
  );
};

// ======================================================
// Request payload
// ======================================================

const normalizeTeacherPayload = (
  body = {}
) => {
  const payload = {};

  const allowedFields = [
    "khmerName",
    "englishName",
    "gender",
    "nationality",
    "dateOfBirth",
    "email",
    "phone",
    "skill",
    "facebook",
    "telegram",
    "note",
    "status"
  ];

  allowedFields.forEach(
    (field) => {
      if (
        Object.prototype
          .hasOwnProperty
          .call(
            body,
            field
          )
      ) {
        payload[field] =
          body[field];
      }
    }
  );

  if (
    Object.prototype
      .hasOwnProperty
      .call(
        body,
        "currentResidence"
      )
  ) {
    if (
      typeof body.currentResidence ===
      "string"
    ) {
      try {
        payload.currentResidence =
          JSON.parse(
            body.currentResidence
          );
      } catch (error) {
        throw createHttpError(
          "Current residence must be valid JSON",
          400
        );
      }
    } else {
      payload.currentResidence =
        body.currentResidence;
    }
  }

  return payload;
};

// ======================================================
// Branch security
// ======================================================

/*
  Global Admin:
  - Must provide branch or branchId when creating.
  - Can move a teacher to another active Branch.
  - Update lookup is by teacher _id only.

  Branch Admin:
  - Branch comes from req.user.branch.
  - Cannot create/update a teacher in another Branch.
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
      toIdString(
        currentBranchId
      );
  } else {
    const userBranchId =
      getUserBranchId(req);

    if (
      !userBranchId ||
      !isValidObjectId(
        userBranchId
      )
    ) {
      throw createHttpError(
        "គណនីនេះមិនទាន់ភ្ជាប់ទៅសាខាទេ",
        403
      );
    }

    if (
      requestedBranchId &&
      requestedBranchId !==
        userBranchId
    ) {
      throw createHttpError(
        "អ្នកមិនមានសិទ្ធិប្រើប្រាស់សាខានេះទេ",
        403
      );
    }

    branchId =
      userBranchId;
  }

  if (!branchId) {
    throw createHttpError(
      "Branch is required",
      400
    );
  }

  if (
    !isValidObjectId(
      branchId
    )
  ) {
    throw createHttpError(
      "Branch ID is not valid",
      400
    );
  }

  const branch =
    await BranchModel.findOne({
      _id:
        branchId,

      status:
        "active"
    }).select(
      "_id branchName branchCode"
    );

  if (!branch) {
    throw createHttpError(
      "Active branch was not found",
      400
    );
  }

  return branch._id;
};

/*
  Global Admin:
  - No branch filter: see all Branches.
  - ?branch=ID: selected Branch only.

  Branch Admin/Teacher:
  - Own Branch only.
*/
const buildBranchFilter = (
  req
) => {
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
        "Branch ID is not valid",
        400
      );
    }

    return {
      branch:
        requestedBranchId
    };
  }

  const userBranchId =
    getUserBranchId(req);

  if (
    !userBranchId ||
    !isValidObjectId(
      userBranchId
    )
  ) {
    throw createHttpError(
      "គណនីនេះមិនទាន់ភ្ជាប់ទៅសាខាទេ",
      403
    );
  }

  if (
    requestedBranchId &&
    requestedBranchId !==
      userBranchId
  ) {
    throw createHttpError(
      "អ្នកមិនមានសិទ្ធិប្រើប្រាស់សាខានេះទេ",
      403
    );
  }

  return {
    branch:
      userBranchId
  };
};

const buildTeacherLookupForUpdate = (
  req,
  teacherId
) => {
  /*
    Important:

    Global Admin must find the existing teacher
    by _id only.

    req.body.branch may be the new target Branch,
    not the teacher's current Branch.
  */
  if (isGlobalAdmin(req)) {
    return {
      _id:
        teacherId
    };
  }

  return {
    _id:
      teacherId,

    ...buildBranchFilter(
      req
    )
  };
};

// ======================================================
// Populate
// ======================================================

const populateTeacher = async (
  teacher
) => {
  if (!teacher) {
    return teacher;
  }

  await teacher.populate({
    path:
      "branch",

    select:
      "branchCode branchName status phone email address"
  });

  return teacher;
};

// ======================================================
// Error handling
// ======================================================

const sendControllerError = (
  res,
  error
) => {
  if (
    error?.code === 11000
  ) {
    if (
      error.keyPattern?.phone ||
      error.keyValue?.phone
    ) {
      return res
        .status(409)
        .send({
          err:
            "Phone number already exists in this branch"
        });
    }

    return res
      .status(409)
      .send({
        err:
          "Duplicate teacher data"
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

    return res
      .status(400)
      .send({
        err:
          firstError?.message ||
          error.message
      });
  }

  if (
    error?.name ===
    "CastError"
  ) {
    return res
      .status(400)
      .send({
        err:
          "Invalid ID"
      });
  }

  return res
    .status(
      error?.status || 500
    )
    .send({
      err:
        error?.message ||
        "Internal server error"
    });
};

// ======================================================
// CREATE
// POST /teachers
// ======================================================

exports.createTeacher = async (
  req,
  res
) => {
  try {
    const payload =
      normalizeTeacherPayload(
        req.body
      );

    payload.branch =
      await resolveBranchForWrite(
        req
      );

    const uploadedImagePath =
      getUploadedTeacherImagePath(
        req
      );

    const uploadedCvData =
      getUploadedTeacherCvData(
        req
      );

    if (uploadedImagePath) {
      payload.profileImage =
        uploadedImagePath;
    }

    if (uploadedCvData) {
      payload.cv =
        uploadedCvData;
    }

    const result =
      await TeacherModel.create(
        payload
      );

    await populateTeacher(
      result
    );

    return res
      .status(201)
      .send({
        success:
          true,

        message:
          "Teacher created successfully",

        result
      });
  } catch (error) {
    /*
      Multer stores files before the controller.
      Remove new files when validation or database
      creation fails.
    */
    removeUploadedFilesIfExists(
      req
    );

    return sendControllerError(
      res,
      error
    );
  }
};

// ======================================================
// READ ALL
// GET /teachers
// ======================================================

exports.getAllTeacher = async (
  req,
  res
) => {
  try {
    const query = {
      ...buildBranchFilter(
        req
      )
    };

    const search =
      String(
        req.query.search || ""
      ).trim();

    const status =
      String(
        req.query.status || ""
      )
        .trim()
        .toLowerCase();

    if (search) {
      const searchRegex =
        new RegExp(
          escapeRegex(
            search
          ),
          "i"
        );

      query.$or = [
        {
          khmerName:
            searchRegex
        },

        {
          englishName:
            searchRegex
        },

        {
          skill:
            searchRegex
        },

        {
          phone:
            searchRegex
        },

        {
          email:
            searchRegex
        }
      ];
    }

    if (status) {
      const allowedStatuses = [
        "active",
        "disabled",
        "archived"
      ];

      if (
        !allowedStatuses.includes(
          status
        )
      ) {
        return res
          .status(400)
          .send({
            err:
              "Invalid teacher status"
          });
      }

      query.status =
        status;
    }

    const page =
      Math.max(
        Number.parseInt(
          req.query.page,
          10
        ) || 1,
        1
      );

    const limit =
      Math.min(
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
      (page - 1) *
      limit;

    const [
      result,
      totalTeachers
    ] = await Promise.all([
      TeacherModel.find(
        query
      )
        .populate(
          "branch",
          "branchCode branchName status"
        )
        .sort({
          createdAt:
            -1
        })
        .skip(
          skip
        )
        .limit(
          limit
        ),

      TeacherModel
        .countDocuments(
          query
        )
    ]);

    return res
      .status(200)
      .send({
        success:
          true,

        page,

        limit,

        totalTeachers,

        totalPages:
          Math.ceil(
            totalTeachers /
            limit
          ) || 1,

        result
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
// GET /teachers/:id
// ======================================================

exports.getOneTeacher = async (
  req,
  res
) => {
  try {
    const id =
      toIdString(
        req.params.id
      );

    if (
      !isValidObjectId(
        id
      )
    ) {
      return res
        .status(400)
        .send({
          err:
            "Teacher ID មិនត្រឹមត្រូវ"
        });
    }

    const result =
      await TeacherModel.findOne({
        _id:
          id,

        ...buildBranchFilter(
          req
        )
      }).populate(
        "branch",
        "branchCode branchName status phone email address"
      );

    if (!result) {
      return res
        .status(404)
        .send({
          err:
            "Teacher not found"
        });
    }

    return res
      .status(200)
      .send({
        success:
          true,

        result
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
// PATCH /teachers/:id
// ======================================================

exports.updateTeacher = async (
  req,
  res
) => {
  let uploadedFilesCommitted =
    false;

  try {
    const id =
      toIdString(
        req.params.id
      );

    if (
      !isValidObjectId(
        id
      )
    ) {
      throw createHttpError(
        "Teacher ID មិនត្រឹមត្រូវ",
        400
      );
    }

    const existingTeacher =
      await TeacherModel.findOne(
        buildTeacherLookupForUpdate(
          req,
          id
        )
      );

    if (!existingTeacher) {
      throw createHttpError(
        "Teacher not found",
        404
      );
    }

    const payload =
      normalizeTeacherPayload(
        req.body
      );

    payload.branch =
      await resolveBranchForWrite(
        req,
        existingTeacher.branch
      );

    const uploadedImagePath =
      getUploadedTeacherImagePath(
        req
      );

    const uploadedCvData =
      getUploadedTeacherCvData(
        req
      );

    const oldProfileImage =
      existingTeacher
        .profileImage || "";

    const oldCvPath =
      existingTeacher
        .cv?.fileUrl || "";

    if (uploadedImagePath) {
      payload.profileImage =
        uploadedImagePath;
    }

    if (uploadedCvData) {
      payload.cv =
        uploadedCvData;
    }

    existingTeacher.set(
      payload
    );

    await existingTeacher.save();

    /*
      The database now references the new files.
      Do not delete new files if populate or response
      handling fails afterward.
    */
    uploadedFilesCommitted =
      Boolean(
        uploadedImagePath ||
        uploadedCvData
      );

    /*
      Delete replaced files only after the
      database update succeeds.
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

    if (
      uploadedCvData?.fileUrl &&
      oldCvPath &&
      oldCvPath !==
        uploadedCvData.fileUrl
    ) {
      removeLocalFile(
        oldCvPath
      );
    }

    await populateTeacher(
      existingTeacher
    );

    return res
      .status(200)
      .send({
        success:
          true,

        message:
          "Teacher updated successfully",

        result:
          existingTeacher
      });
  } catch (error) {
    if (
      !uploadedFilesCommitted
    ) {
      /*
        Remove newly uploaded files if validation
        or database updating fails.
      */
      removeUploadedFilesIfExists(
        req
      );
    }

    return sendControllerError(
      res,
      error
    );
  }
};

// ======================================================
// DELETE
// DELETE /teachers/:id
// ======================================================

exports.deleteTeacher = async (
  req,
  res
) => {
  try {
    const id =
      toIdString(
        req.params.id
      );

    if (
      !isValidObjectId(
        id
      )
    ) {
      return res
        .status(400)
        .send({
          err:
            "Teacher ID មិនត្រឹមត្រូវ"
        });
    }

    const result =
      await TeacherModel
        .findOneAndDelete({
          _id:
            id,

          ...buildBranchFilter(
            req
          )
        });

    if (!result) {
      return res
        .status(404)
        .send({
          err:
            "Teacher not found"
        });
    }

    if (
      result.profileImage
    ) {
      removeLocalFile(
        result.profileImage
      );
    }

    if (
      result.cv?.fileUrl
    ) {
      removeLocalFile(
        result.cv.fileUrl
      );
    }

    return res
      .status(200)
      .send({
        success:
          true,

        message:
          "Teacher deleted successfully",

        result
      });
  } catch (error) {
    return sendControllerError(
      res,
      error
    );
  }
};