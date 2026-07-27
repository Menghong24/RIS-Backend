const mongoose = require("mongoose");

const AnnouncementModel = require("./announcements.model");
const ClassesModel = require("../classes/classes.model");
const BranchModel = require("../branches/branches.model");

const TARGET_TYPES = [
  "global",
  "branch",
  "class"
];

const ANNOUNCEMENT_STATUSES = [
  "published",
  "draft",
  "archived"
];

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

const getUserBranchId = (req) => {
  return getId(req.user?.branch);
};

const getUserTeacherId = (req) => {
  return getId(req.user?.teacher);
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

const hasOwnProperty = (
  object,
  key
) => {
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

const escapeRegex = (value = "") => {
  return String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
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

const assertAuthenticated = (req) => {
  if (!req.user?._id) {
    throw createHttpError(
      "Unauthorized: No user found",
      401
    );
  }
};

const assertCanManageAnnouncements = (
  req
) => {
  assertAuthenticated(req);

  if (
    !isAdmin(req) &&
    !isTeacher(req)
  ) {
    throw createHttpError(
      "អ្នកមិនមានសិទ្ធិគ្រប់គ្រងសេចក្តីជូនដំណឹងទេ",
      403
    );
  }
};

// ======================================================
// Branch helpers
// ======================================================

const getRequestedWriteBranchId = (
  req
) => {
  return (
    getId(req.body?.branch) ||
    getId(req.body?.branchId) ||
    ""
  );
};

const getRequestedReadBranchId = (
  req
) => {
  return (
    getId(req.query?.branch) ||
    getId(req.query?.branchId) ||
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
    }).select(
      "_id branchCode branchName status"
    );

  if (!branch) {
    throw createHttpError(
      "Active branch was not found",
      404
    );
  }

  return branch;
};

const resolveBranchForTarget = async (
  req,
  {
    targetType,
    currentBranchId = null
  }
) => {
  if (targetType === "global") {
    if (!isGlobalAdmin(req)) {
      throw createHttpError(
        "មានតែ Admin កណ្តាលប៉ុណ្ណោះដែលអាចបង្កើតសេចក្តីជូនដំណឹង Global បាន",
        403
      );
    }

    return null;
  }

  const requestedBranchId =
    getRequestedWriteBranchId(req);

  let branchId = "";

  if (isGlobalAdmin(req)) {
    branchId =
      requestedBranchId ||
      getId(currentBranchId);

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

  const branch =
    await ensureActiveBranch(branchId);

  return branch._id;
};

// ======================================================
// Target normalization and validation
// ======================================================

const normalizeTargetType = (
  value,
  req,
  {
    hasBranchHint = false
  } = {}
) => {
  const rawType = String(
    value || ""
  )
    .trim()
    .toLowerCase();

  /*
    Support the old targetType: "all".

    Global admin:
    - all without branch means global
    - all with branch means branch

    Branch users:
    - all means branch
  */
  if (!rawType || rawType === "all") {
    if (isGlobalAdmin(req)) {
      return hasBranchHint
        ? "branch"
        : "global";
    }

    return "branch";
  }

  if (!TARGET_TYPES.includes(rawType)) {
    throw createHttpError(
      "Invalid announcement target type"
    );
  }

  return rawType;
};

const validateTargetClass = async (
  req,
  classId,
  branchId
) => {
  if (
    !classId ||
    !isValidObjectId(classId)
  ) {
    throw createHttpError(
      "Target class is required"
    );
  }

  const query = {
    _id: classId,
    branch: branchId
  };

  /*
    Teachers can create class announcements only
    for classes assigned to them.
  */
  if (isTeacher(req)) {
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
  }

  const targetClass =
    await ClassesModel.findOne(
      query
    ).select(
      "_id branch teacher className classGrade"
    );

  if (!targetClass) {
    throw createHttpError(
      isTeacher(req)
        ? "Class not found or the class is not assigned to this teacher"
        : "Class was not found in the selected branch",
      404
    );
  }

  return targetClass;
};

const resolveAnnouncementTarget =
  async (
    req,
    {
      targetType,
      targetClassId,
      currentBranchId = null
    }
  ) => {
    const branch =
      await resolveBranchForTarget(
        req,
        {
          targetType,
          currentBranchId
        }
      );

    if (targetType === "global") {
      return {
        branch: null,
        targetClass: null
      };
    }

    if (targetType === "branch") {
      return {
        branch,
        targetClass: null
      };
    }

    const targetClass =
      await validateTargetClass(
        req,
        targetClassId,
        branch
      );

    return {
      branch,
      targetClass: targetClass._id
    };
  };

// ======================================================
// Payload normalization
// ======================================================

const normalizeDate = (
  value,
  fieldName,
  {
    allowNull = false
  } = {}
) => {
  if (
    value === undefined ||
    value === ""
  ) {
    return value;
  }

  if (
    value === null &&
    allowNull
  ) {
    return null;
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    throw createHttpError(
      `${fieldName} is not valid`
    );
  }

  return date;
};

const normalizeBoolean = (
  value,
  fieldName
) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (
    value === 1 ||
    value === "1" ||
    String(value).toLowerCase() ===
      "true"
  ) {
    return true;
  }

  if (
    value === 0 ||
    value === "0" ||
    String(value).toLowerCase() ===
      "false"
  ) {
    return false;
  }

  throw createHttpError(
    `${fieldName} must be true or false`
  );
};

const normalizeAttachments = (
  value
) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return [];
  }

  let attachments = value;

  if (typeof attachments === "string") {
    try {
      attachments =
        JSON.parse(attachments);
    } catch (error) {
      throw createHttpError(
        "Attachments must be a valid array"
      );
    }
  }

  if (!Array.isArray(attachments)) {
    throw createHttpError(
      "Attachments must be an array"
    );
  }

  return attachments.map(
    (attachment, index) => {
      const name = String(
        attachment?.name || ""
      ).trim();

      const path = String(
        attachment?.path || ""
      ).trim();

      if (!name || !path) {
        throw createHttpError(
          `Attachment name and path are required at row ${index + 1}`
        );
      }

      return {
        name,
        path
      };
    }
  );
};

const normalizeAnnouncementPayload = (
  body = {},
  {
    partial = false
  } = {}
) => {
  const payload = {};

  const textFields = [
    "title",
    "content",
    "remark"
  ];

  textFields.forEach((field) => {
    if (
      hasOwnProperty(body, field)
    ) {
      payload[field] = String(
        body[field] || ""
      ).trim();
    }
  });

  if (
    hasOwnProperty(body, "targetType")
  ) {
    payload.targetType =
      body.targetType;
  }

  const hasTargetClassInput =
    hasOwnProperty(
      body,
      "targetClass"
    ) ||
    hasOwnProperty(
      body,
      "classId"
    );

  if (hasTargetClassInput) {
    const classId = getId(
      body.targetClass ||
      body.classId
    );

    if (
      classId &&
      !isValidObjectId(classId)
    ) {
      throw createHttpError(
        "Target class ID is not valid"
      );
    }

    payload.targetClass =
      classId || null;
  }

  if (
    hasOwnProperty(body, "postDate")
  ) {
    payload.postDate =
      normalizeDate(
        body.postDate,
        "Post date"
      );
  }

  if (
    hasOwnProperty(body, "expireDate")
  ) {
    payload.expireDate =
      normalizeDate(
        body.expireDate,
        "Expire date",
        {
          allowNull: true
        }
      );
  }

  if (
    hasOwnProperty(body, "status")
  ) {
    const status = String(
      body.status || ""
    )
      .trim()
      .toLowerCase();

    if (
      !ANNOUNCEMENT_STATUSES.includes(
        status
      )
    ) {
      throw createHttpError(
        "Invalid announcement status"
      );
    }

    payload.status = status;
  }

  if (
    hasOwnProperty(body, "action")
  ) {
    payload.action =
      normalizeBoolean(
        body.action,
        "action"
      );
  }

  if (
    hasOwnProperty(
      body,
      "attachments"
    )
  ) {
    payload.attachments =
      normalizeAttachments(
        body.attachments
      );
  }

  if (!partial) {
    if (
      !hasOwnProperty(
        payload,
        "attachments"
      )
    ) {
      payload.attachments = [];
    }
  }

  return {
    payload,
    hasTargetClassInput
  };
};

// ======================================================
// Read and write access
// ======================================================

const buildPublishedFilter = () => {
  const now = new Date();

  return {
    status: "published",

    postDate: {
      $lte: now
    },

    $or: [
      {
        expireDate: null
      },
      {
        expireDate: {
          $exists: false
        }
      },
      {
        expireDate: {
          $gt: now
        }
      }
    ]
  };
};

const buildAnnouncementVisibility =
  (req) => {
    assertAuthenticated(req);

    if (isGlobalAdmin(req)) {
      return {};
    }

    const branchId =
      getUserBranchId(req);

    if (
      !branchId ||
      !isValidObjectId(branchId)
    ) {
      throw createHttpError(
        "គណនីនេះមិនទាន់ភ្ជាប់ទៅសាខាទេ",
        403
      );
    }

    const publishedFilter =
      buildPublishedFilter();

    const globalPublished =
      mergeQueries(
        {
          targetType: "global",
          branch: null
        },
        publishedFilter
      );

    const branchPublished =
      mergeQueries(
        {
          branch: branchId
        },
        publishedFilter
      );

    /*
      Branch admin:
      - Can see every announcement in their branch.
      - Can see active global announcements.
    */
    if (isAdmin(req)) {
      return {
        $or: [
          {
            branch: branchId
          },
          globalPublished
        ]
      };
    }

    /*
      Teacher:
      - Can see their own branch announcements,
        including drafts and archived posts.
      - Can see other currently published posts.
      - Can see active global announcements.
    */
    if (isTeacher(req)) {
      return {
        $or: [
          {
            branch: branchId,
            postedBy: req.user._id
          },
          branchPublished,
          globalPublished
        ]
      };
    }

    /*
      Standard user:
      - Published announcements only.
    */
    return {
      $or: [
        branchPublished,
        globalPublished
      ]
    };
  };

const buildAnnouncementWriteScope = (
  req
) => {
  assertCanManageAnnouncements(req);

  if (isGlobalAdmin(req)) {
    return {};
  }

  const branchId =
    getUserBranchId(req);

  if (
    !branchId ||
    !isValidObjectId(branchId)
  ) {
    throw createHttpError(
      "គណនីនេះមិនទាន់ភ្ជាប់ទៅសាខាទេ",
      403
    );
  }

  if (isAdmin(req)) {
    return {
      branch: branchId
    };
  }

  /*
    Teachers can update and delete only
    announcements they created.
  */
  return {
    branch: branchId,
    postedBy: req.user._id
  };
};

const buildOptionalReadBranchFilter = (
  req
) => {
  const requestedBranchId =
    getRequestedReadBranchId(req);

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

  if (!isGlobalAdmin(req)) {
    const userBranchId =
      getUserBranchId(req);

    if (
      requestedBranchId !==
      userBranchId
    ) {
      throw createHttpError(
        "អ្នកមិនមានសិទ្ធិប្រើប្រាស់សាខានេះទេ",
        403
      );
    }
  }

  return {
    branch: requestedBranchId
  };
};

// ======================================================
// Populate
// ======================================================

const populateAnnouncementQuery = (
  query
) => {
  return query
    .populate(
      "branch",
      "branchCode branchName status"
    )
    .populate(
      "targetClass",
      "classNumber className classGrade timeStudy yearOnStudy branch teacher"
    )
    .populate({
      path: "postedBy",

      select:
        "username role teacher branch",

      populate: [
        {
          path: "teacher",
          select:
            "khmerName englishName profileImage phone"
        },
        {
          path: "branch",
          select:
            "branchCode branchName"
        }
      ]
    });
};

const populateAnnouncementDocument =
  async (announcement) => {
    await announcement.populate([
      {
        path: "branch",
        select:
          "branchCode branchName status"
      },
      {
        path: "targetClass",
        select:
          "classNumber className classGrade timeStudy yearOnStudy branch teacher"
      },
      {
        path: "postedBy",
        select:
          "username role teacher branch",
        populate: [
          {
            path: "teacher",
            select:
              "khmerName englishName profileImage phone"
          },
          {
            path: "branch",
            select:
              "branchCode branchName"
          }
        ]
      }
    ]);

    return announcement;
  };

// ======================================================
// Error handling
// ======================================================

const sendControllerError = (
  res,
  error,
  fallbackMessage
) => {
  if (
    error?.name ===
    "ValidationError"
  ) {
    const firstError =
      Object.values(
        error.errors || {}
      )[0];

    return res.status(400).send({
      error:
        firstError?.message ||
        error.message
    });
  }

  if (
    error?.name === "CastError"
  ) {
    return res.status(400).send({
      error: "Invalid ID"
    });
  }

  return res
    .status(error?.status || 500)
    .send({
      error:
        error?.message ||
        fallbackMessage ||
        "Internal server error"
    });
};

// ======================================================
// CREATE
// ======================================================

exports.createAnnouncement =
  async (req, res) => {
    try {
      assertCanManageAnnouncements(
        req
      );

      const {
        payload
      } = normalizeAnnouncementPayload(
        req.body,
        {
          partial: false
        }
      );

      const requestedBranchId =
        getRequestedWriteBranchId(
          req
        );

      const targetType =
        normalizeTargetType(
          payload.targetType,
          req,
          {
            hasBranchHint:
              Boolean(
                requestedBranchId
              )
          }
        );

      const resolvedTarget =
        await resolveAnnouncementTarget(
          req,
          {
            targetType,
            targetClassId:
              payload.targetClass
          }
        );

      payload.targetType =
        targetType;

      payload.branch =
        resolvedTarget.branch;

      payload.targetClass =
        resolvedTarget.targetClass;

      payload.postedBy =
        req.user._id;

      const announcement =
        await AnnouncementModel.create(
          payload
        );

      await populateAnnouncementDocument(
        announcement
      );

      return res
        .status(201)
        .send(announcement);
    } catch (error) {
      return sendControllerError(
        res,
        error,
        "Cannot create announcement"
      );
    }
  };

// ======================================================
// GET ALL
// ======================================================

exports.getAllAnnouncements =
  async (req, res) => {
    try {
      assertAuthenticated(req);

      const filters = {};

      const requestedType =
        req.query.type ||
        req.query.targetType;

      if (
        requestedType &&
        String(requestedType)
          .toLowerCase() !== "all"
      ) {
        const targetType =
          String(requestedType)
            .trim()
            .toLowerCase();

        if (
          !TARGET_TYPES.includes(
            targetType
          )
        ) {
          throw createHttpError(
            "Invalid announcement target type"
          );
        }

        filters.targetType =
          targetType;
      }

      const requestedClassId =
        req.query.classId ||
        req.query.targetClass;

      if (
        requestedClassId &&
        requestedClassId !== "All"
      ) {
        if (
          !isValidObjectId(
            requestedClassId
          )
        ) {
          throw createHttpError(
            "Target class ID is not valid"
          );
        }

        const classFilter = {
          _id: requestedClassId
        };

        if (!isGlobalAdmin(req)) {
          classFilter.branch =
            getUserBranchId(req);
        } else {
          const requestedBranchId =
            getRequestedReadBranchId(
              req
            );

          if (requestedBranchId) {
            classFilter.branch =
              requestedBranchId;
          }
        }

        const targetClass =
          await ClassesModel.findOne(
            classFilter
          ).select("_id");

        if (!targetClass) {
          throw createHttpError(
            "Target class was not found in the accessible branch",
            404
          );
        }

        filters.targetClass =
          targetClass._id;
      }

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
          !ANNOUNCEMENT_STATUSES.includes(
            status
          )
        ) {
          throw createHttpError(
            "Invalid announcement status"
          );
        }

        filters.status = status;
      }

      const search = String(
        req.query.search || ""
      ).trim();

      if (search) {
        const searchRegex =
          new RegExp(
            escapeRegex(search),
            "i"
          );

        filters.$or = [
          {
            title: searchRegex
          },
          {
            content: searchRegex
          },
          {
            remark: searchRegex
          }
        ];
      }

      const query = mergeQueries(
        buildAnnouncementVisibility(
          req
        ),
        buildOptionalReadBranchFilter(
          req
        ),
        filters
      );

      const list =
        await populateAnnouncementQuery(
          AnnouncementModel.find(
            query
          ).sort({
            postDate: -1,
            createdAt: -1
          })
        );

      return res.status(200).send(
        list
      );
    } catch (error) {
      return sendControllerError(
        res,
        error,
        "Cannot get announcements"
      );
    }
  };

// ======================================================
// GET ONE
// ======================================================

exports.getOneAnnouncement =
  async (req, res) => {
    try {
      assertAuthenticated(req);

      const announcementId =
        getId(req.params.id);

      if (
        !isValidObjectId(
          announcementId
        )
      ) {
        throw createHttpError(
          "Announcement ID is not valid"
        );
      }

      const item =
        await populateAnnouncementQuery(
          AnnouncementModel.findOne(
            mergeQueries(
              {
                _id:
                  announcementId
              },
              buildAnnouncementVisibility(
                req
              )
            )
          )
        );

      if (!item) {
        throw createHttpError(
          "Announcement not found or access denied",
          404
        );
      }

      return res.status(200).send(
        item
      );
    } catch (error) {
      return sendControllerError(
        res,
        error,
        "Cannot get announcement"
      );
    }
  };

// ======================================================
// UPDATE
// ======================================================

exports.updateAnnouncement =
  async (req, res) => {
    try {
      assertCanManageAnnouncements(
        req
      );

      const announcementId =
        getId(req.params.id);

      if (
        !isValidObjectId(
          announcementId
        )
      ) {
        throw createHttpError(
          "Announcement ID is not valid"
        );
      }

      const existingAnnouncement =
        await AnnouncementModel.findOne(
          mergeQueries(
            {
              _id:
                announcementId
            },
            buildAnnouncementWriteScope(
              req
            )
          )
        );

      if (!existingAnnouncement) {
        throw createHttpError(
          "Announcement not found or you do not have permission",
          404
        );
      }

      const {
        payload,
        hasTargetClassInput
      } = normalizeAnnouncementPayload(
        req.body,
        {
          partial: true
        }
      );

      const finalTargetType =
        hasOwnProperty(
          payload,
          "targetType"
        )
          ? normalizeTargetType(
              payload.targetType,
              req,
              {
                hasBranchHint:
                  Boolean(
                    getRequestedWriteBranchId(
                      req
                    )
                  )
              }
            )
          : existingAnnouncement
              .targetType;

      const finalTargetClassId =
        hasTargetClassInput
          ? payload.targetClass
          : getId(
              existingAnnouncement
                .targetClass
            );

      const resolvedTarget =
        await resolveAnnouncementTarget(
          req,
          {
            targetType:
              finalTargetType,

            targetClassId:
              finalTargetClassId,

            currentBranchId:
              existingAnnouncement
                .branch
          }
        );

      payload.targetType =
        finalTargetType;

      payload.branch =
        resolvedTarget.branch;

      payload.targetClass =
        resolvedTarget.targetClass;

      /*
        Prevent users from changing the creator.
      */
      delete payload.postedBy;

      existingAnnouncement.set(
        payload
      );

      await existingAnnouncement.save();

      await populateAnnouncementDocument(
        existingAnnouncement
      );

      return res.status(200).send(
        existingAnnouncement
      );
    } catch (error) {
      return sendControllerError(
        res,
        error,
        "Cannot update announcement"
      );
    }
  };

// ======================================================
// DELETE
// ======================================================

exports.deleteAnnouncement =
  async (req, res) => {
    try {
      assertCanManageAnnouncements(
        req
      );

      const announcementId =
        getId(req.params.id);

      if (
        !isValidObjectId(
          announcementId
        )
      ) {
        throw createHttpError(
          "Announcement ID is not valid"
        );
      }

      const item =
        await AnnouncementModel.findOneAndDelete(
          mergeQueries(
            {
              _id:
                announcementId
            },
            buildAnnouncementWriteScope(
              req
            )
          )
        );

      if (!item) {
        throw createHttpError(
          "Announcement not found or you do not have permission",
          404
        );
      }

      return res.status(200).send({
        message:
          "Deleted successfully"
      });
    } catch (error) {
      return sendControllerError(
        res,
        error,
        "Cannot delete announcement"
      );
    }
  };