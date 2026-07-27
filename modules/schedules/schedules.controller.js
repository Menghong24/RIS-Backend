const mongoose = require("mongoose");

const ScheduleModel = require("./schedules.model");
const ClassesModel = require("../classes/classes.model");
const SubjectModel = require("../subjects/subjects.model");
const TeacherModel = require("../teachers/teachers.model");
const BranchModel = require("../branches/branches.model");

const ALLOWED_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday"
];

const ALLOWED_STATUSES = [
  "active",
  "disabled"
];

const TIME_PATTERN =
  /^([01]\d|2[0-3]):[0-5]\d$/;

// ======================================================
// Helpers
// ======================================================

const toIdString = (value) => {
  return String(
    value?._id || value || ""
  ).trim();
};

const isValidObjectId = (value) => {
  const id = toIdString(value);

  return Boolean(id) &&
    mongoose.Types.ObjectId.isValid(id);
};

const getUserRole = (req) => {
  return String(req.user?.role || "")
    .trim()
    .toLowerCase();
};

const getUserBranchId = (req) => {
  return toIdString(req.user?.branch);
};

const getUserTeacherId = (req) => {
  return toIdString(req.user?.teacher);
};

const isAdmin = (req) => {
  return getUserRole(req) === "admin";
};

const isTeacher = (req) => {
  return getUserRole(req) === "teacher";
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

const hasOwnProperty = (object, key) => {
  return Object.prototype.hasOwnProperty.call(
    object,
    key
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

const getRequestedReadBranchId = (req) => {
  return (
    toIdString(req.query?.branch) ||
    toIdString(req.query?.branchId) ||
    ""
  );
};

const getDefaultAcademicYear = () => {
  const year = new Date().getFullYear();

  return `${year}-${year + 1}`;
};

// ======================================================
// Branch access
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
// Payload normalization
// ======================================================

const normalizeSchedulePayload = (
  body = {},
  { partial = false } = {}
) => {
  const payload = {};

  const relationFields = [
    "class",
    "subject",
    "teacher"
  ];

  relationFields.forEach((field) => {
    if (!hasOwnProperty(body, field)) {
      return;
    }

    const value = toIdString(
      body[field]
    );

    if (!value) {
      payload[field] =
        field === "teacher"
          ? null
          : value;

      return;
    }

    if (!isValidObjectId(value)) {
      throw createHttpError(
        `${field} ID is not valid`
      );
    }

    payload[field] = value;
  });

  const normalFields = [
    "day",
    "startTime",
    "endTime",
    "room",
    "status",
    "academicYear",
    "remark"
  ];

  normalFields.forEach((field) => {
    if (
      hasOwnProperty(body, field)
    ) {
      payload[field] = body[field];
    }
  });

  if (!partial) {
    if (!payload.day) {
      payload.day = "Monday";
    }

    if (!payload.startTime) {
      payload.startTime = "07:00";
    }

    if (!payload.endTime) {
      payload.endTime = "08:00";
    }

    if (!payload.room) {
      payload.room = "A1";
    }

    if (!payload.status) {
      payload.status = "active";
    }

    if (!payload.academicYear) {
      payload.academicYear =
        getDefaultAcademicYear();
    }
  }

  if (payload.day !== undefined) {
    payload.day = String(
      payload.day || ""
    ).trim();

    if (
      !ALLOWED_DAYS.includes(
        payload.day
      )
    ) {
      throw createHttpError(
        "Invalid schedule day"
      );
    }
  }

  if (payload.startTime !== undefined) {
    payload.startTime = String(
      payload.startTime || ""
    ).trim();

    if (
      !TIME_PATTERN.test(
        payload.startTime
      )
    ) {
      throw createHttpError(
        "Start time must use HH:mm format"
      );
    }
  }

  if (payload.endTime !== undefined) {
    payload.endTime = String(
      payload.endTime || ""
    ).trim();

    if (
      !TIME_PATTERN.test(
        payload.endTime
      )
    ) {
      throw createHttpError(
        "End time must use HH:mm format"
      );
    }
  }

  if (payload.room !== undefined) {
    payload.room = String(
      payload.room || ""
    ).trim();
  }

  if (
    payload.academicYear !== undefined
  ) {
    payload.academicYear = String(
      payload.academicYear || ""
    ).trim();
  }

  if (payload.status !== undefined) {
    payload.status = String(
      payload.status || ""
    )
      .trim()
      .toLowerCase();

    if (
      !ALLOWED_STATUSES.includes(
        payload.status
      )
    ) {
      throw createHttpError(
        "Invalid schedule status"
      );
    }
  }

  if (payload.remark !== undefined) {
    payload.remark = String(
      payload.remark || ""
    ).trim();
  }

  return payload;
};

// ======================================================
// Relationship validation
// ======================================================

const validateScheduleRelations = async ({
  branchId,
  classId,
  subjectId,
  teacherId
}) => {
  if (
    !classId ||
    !isValidObjectId(classId)
  ) {
    throw createHttpError(
      "Class is required"
    );
  }

  if (
    !subjectId ||
    !isValidObjectId(subjectId)
  ) {
    throw createHttpError(
      "Subject is required"
    );
  }

  const foundClass =
    await ClassesModel.findOne({
      _id: classId,
      branch: branchId
    }).select(
      "_id branch teacher"
    );

  if (!foundClass) {
    throw createHttpError(
      "Class was not found in this branch",
      404
    );
  }

  const subject =
    await SubjectModel.findOne({
      _id: subjectId,
      branch: branchId
    }).select(
      "_id branch classId classIds teacher"
    );

  if (!subject) {
    throw createHttpError(
      "Subject was not found in this branch",
      404
    );
  }

  const subjectClassIds = [
    toIdString(subject.classId),
    ...(Array.isArray(
      subject.classIds
    )
      ? subject.classIds.map(
          toIdString
        )
      : [])
  ].filter(Boolean);

  /*
    If a subject has class assignments,
    the selected class must be included.
  */
  if (
    subjectClassIds.length > 0 &&
    !subjectClassIds.includes(
      toIdString(classId)
    )
  ) {
    throw createHttpError(
      "Subject does not belong to the selected class"
    );
  }

  if (teacherId) {
    const teacher =
      await TeacherModel.findOne({
        _id: teacherId,
        branch: branchId
      }).select("_id status");

    if (!teacher) {
      throw createHttpError(
        "Teacher was not found in this branch",
        404
      );
    }

    if (
      teacher.status &&
      teacher.status !== "active"
    ) {
      throw createHttpError(
        "The selected teacher is not active"
      );
    }
  }

  return {
    foundClass,
    subject
  };
};

// ======================================================
// Teacher access
// ======================================================

const applyTeacherReadFilter = (
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
// Conflict validation
// ======================================================

const findScheduleConflict = async ({
  branchId,
  scheduleId = null,
  classId,
  teacherId,
  day,
  startTime,
  endTime,
  room,
  academicYear,
  status
}) => {
  /*
    Disabled schedules do not block
    active timetable slots.
  */
  if (status !== "active") {
    return null;
  }

  const overlapQuery = {
    branch: branchId,
    day,
    academicYear,
    status: "active",

    startTime: {
      $lt: endTime
    },

    endTime: {
      $gt: startTime
    }
  };

  if (scheduleId) {
    overlapQuery._id = {
      $ne: scheduleId
    };
  }

  const conflictConditions = [
    {
      class: classId
    }
  ];

  if (teacherId) {
    conflictConditions.push({
      teacher: teacherId
    });
  }

  if (room) {
    conflictConditions.push({
      room
    });
  }

  overlapQuery.$or =
    conflictConditions;

  return ScheduleModel.findOne(
    overlapQuery
  )
    .select(
      "_id class teacher room day startTime endTime academicYear"
    )
    .populate(
      "class",
      "className classGrade"
    )
    .populate(
      "teacher",
      "khmerName englishName"
    );
};

const getConflictMessage = ({
  conflict,
  classId,
  teacherId,
  room
}) => {
  if (
    toIdString(conflict.class) ===
    toIdString(classId)
  ) {
    return "Class already has another schedule during this time";
  }

  if (
    teacherId &&
    toIdString(conflict.teacher) ===
      toIdString(teacherId)
  ) {
    return "Teacher already has another schedule during this time";
  }

  if (
    room &&
    String(conflict.room || "")
      .trim()
      .toLowerCase() ===
      String(room)
        .trim()
        .toLowerCase()
  ) {
    return "Room is already booked during this time";
  }

  return "Schedule time conflicts with another schedule";
};

// ======================================================
// Populate
// ======================================================

const populateScheduleQuery = (
  query
) => {
  return query
    .populate(
      "branch",
      "branchCode branchName status"
    )
    .populate(
      "class",
      "classNumber className classGrade timeStudy yearOnStudy teacher branch"
    )
    .populate(
      "subject",
      "subjectName type branch"
    )
    .populate(
      "teacher",
      "englishName khmerName profileImage skill branch"
    );
};

const populateScheduleDocument =
  async (schedule) => {
    await schedule.populate([
      {
        path: "branch",
        select:
          "branchCode branchName status"
      },
      {
        path: "class",
        select:
          "classNumber className classGrade timeStudy yearOnStudy teacher branch"
      },
      {
        path: "subject",
        select:
          "subjectName type branch"
      },
      {
        path: "teacher",
        select:
          "englishName khmerName profileImage skill branch"
      }
    ]);

    return schedule;
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
      error:
        "This exact schedule already exists"
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

exports.createSchedule = async (
  req,
  res
) => {
  try {
    if (!isAdmin(req)) {
      throw createHttpError(
        "មានតែ Admin ប៉ុណ្ណោះដែលអាចបង្កើតកាលវិភាគបាន",
        403
      );
    }

    const payload =
      normalizeSchedulePayload(
        req.body,
        {
          partial: false
        }
      );

    const branchId =
      await resolveBranchForWrite(req);

    payload.branch = branchId;

    await validateScheduleRelations({
      branchId,
      classId: payload.class,
      subjectId: payload.subject,
      teacherId: payload.teacher
    });

    if (
      payload.startTime >=
      payload.endTime
    ) {
      throw createHttpError(
        "End time must be later than start time"
      );
    }

    const conflict =
      await findScheduleConflict({
        branchId,
        classId: payload.class,
        teacherId: payload.teacher,
        day: payload.day,
        startTime: payload.startTime,
        endTime: payload.endTime,
        room: payload.room,
        academicYear:
          payload.academicYear,
        status: payload.status
      });

    if (conflict) {
      throw createHttpError(
        getConflictMessage({
          conflict,
          classId: payload.class,
          teacherId:
            payload.teacher,
          room: payload.room
        }),
        409
      );
    }

    const schedule =
      await ScheduleModel.create(
        payload
      );

    await populateScheduleDocument(
      schedule
    );

    return res.status(201).send({
      success: true,
      message:
        "Schedule created successfully",
      result: schedule
    });
  } catch (error) {
    return sendControllerError(
      res,
      error,
      "Cannot create schedule"
    );
  }
};

// ======================================================
// GET ALL
// ======================================================

exports.getAllSchedules = async (
  req,
  res
) => {
  try {
    let query = {
      ...buildBranchFilter(req)
    };

    query =
      applyTeacherReadFilter(
        req,
        query
      );

    const classId =
      req.query.classId ||
      req.query.class;

    if (
      classId &&
      classId !== "All"
    ) {
      if (!isValidObjectId(classId)) {
        throw createHttpError(
          "Class ID is not valid"
        );
      }

      query.class = classId;
    }

    if (
      req.query.subject &&
      req.query.subject !== "All"
    ) {
      if (
        !isValidObjectId(
          req.query.subject
        )
      ) {
        throw createHttpError(
          "Subject ID is not valid"
        );
      }

      query.subject =
        req.query.subject;
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
        throw createHttpError(
          "Teacher ID is not valid"
        );
      }

      /*
        Teacher users cannot request
        another teacher's schedule.
      */
      if (
        isTeacher(req) &&
        toIdString(
          req.query.teacher
        ) !==
          getUserTeacherId(req)
      ) {
        throw createHttpError(
          "អ្នកមិនមានសិទ្ធិមើលកាលវិភាគគ្រូនេះទេ",
          403
        );
      }

      query.teacher =
        req.query.teacher;
    }

    if (
      req.query.day &&
      req.query.day !== "All"
    ) {
      if (
        !ALLOWED_DAYS.includes(
          req.query.day
        )
      ) {
        throw createHttpError(
          "Invalid schedule day"
        );
      }

      query.day = req.query.day;
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
        !ALLOWED_STATUSES.includes(
          status
        )
      ) {
        throw createHttpError(
          "Invalid schedule status"
        );
      }

      query.status = status;
    }

    if (
      req.query.academicYear &&
      req.query.academicYear !== "All"
    ) {
      query.academicYear = String(
        req.query.academicYear
      ).trim();
    }

    if (
      req.query.room &&
      req.query.room !== "All"
    ) {
      query.room = String(
        req.query.room
      ).trim();
    }

    const schedules =
      await populateScheduleQuery(
        ScheduleModel.find(query).sort({
          day: 1,
          startTime: 1
        })
      );

    return res.status(200).send({
      success: true,
      total: schedules.length,
      result: schedules
    });
  } catch (error) {
    return sendControllerError(
      res,
      error,
      "Cannot get schedules"
    );
  }
};

// ======================================================
// UPDATE
// ======================================================

exports.updateSchedule = async (
  req,
  res
) => {
  try {
    if (!isAdmin(req)) {
      throw createHttpError(
        "មានតែ Admin ប៉ុណ្ណោះដែលអាចកែប្រែកាលវិភាគបាន",
        403
      );
    }

    const scheduleId =
      toIdString(req.params.id);

    if (
      !isValidObjectId(
        scheduleId
      )
    ) {
      throw createHttpError(
        "Schedule ID is not valid"
      );
    }

    const existingSchedule =
      await ScheduleModel.findOne({
        _id: scheduleId,
        ...buildBranchFilter(req)
      });

    if (!existingSchedule) {
      throw createHttpError(
        "Schedule not found",
        404
      );
    }

    const payload =
      normalizeSchedulePayload(
        req.body,
        {
          partial: true
        }
      );

    const branchId =
      await resolveBranchForWrite(
        req,
        existingSchedule.branch
      );

    const finalClassId =
      payload.class !== undefined
        ? payload.class
        : toIdString(
            existingSchedule.class
          );

    const finalSubjectId =
      payload.subject !== undefined
        ? payload.subject
        : toIdString(
            existingSchedule.subject
          );

    const finalTeacherId =
      payload.teacher !== undefined
        ? payload.teacher
        : toIdString(
            existingSchedule.teacher
          ) || null;

    const finalDay =
      payload.day !== undefined
        ? payload.day
        : existingSchedule.day;

    const finalStartTime =
      payload.startTime !== undefined
        ? payload.startTime
        : existingSchedule.startTime;

    const finalEndTime =
      payload.endTime !== undefined
        ? payload.endTime
        : existingSchedule.endTime;

    const finalRoom =
      payload.room !== undefined
        ? payload.room
        : existingSchedule.room;

    const finalAcademicYear =
      payload.academicYear !==
      undefined
        ? payload.academicYear
        : existingSchedule.academicYear;

    const finalStatus =
      payload.status !== undefined
        ? payload.status
        : existingSchedule.status;

    await validateScheduleRelations({
      branchId,
      classId: finalClassId,
      subjectId: finalSubjectId,
      teacherId: finalTeacherId
    });

    if (
      finalStartTime >= finalEndTime
    ) {
      throw createHttpError(
        "End time must be later than start time"
      );
    }

    const conflict =
      await findScheduleConflict({
        branchId,
        scheduleId:
          existingSchedule._id,
        classId: finalClassId,
        teacherId: finalTeacherId,
        day: finalDay,
        startTime: finalStartTime,
        endTime: finalEndTime,
        room: finalRoom,
        academicYear:
          finalAcademicYear,
        status: finalStatus
      });

    if (conflict) {
      throw createHttpError(
        getConflictMessage({
          conflict,
          classId: finalClassId,
          teacherId:
            finalTeacherId,
          room: finalRoom
        }),
        409
      );
    }

    payload.branch = branchId;

    existingSchedule.set(payload);

    await existingSchedule.save();

    await populateScheduleDocument(
      existingSchedule
    );

    return res.status(200).send({
      success: true,
      message:
        "Schedule updated successfully",
      result: existingSchedule
    });
  } catch (error) {
    return sendControllerError(
      res,
      error,
      "Cannot update schedule"
    );
  }
};

// ======================================================
// DELETE
// ======================================================

exports.deleteSchedule = async (
  req,
  res
) => {
  try {
    if (!isAdmin(req)) {
      throw createHttpError(
        "មានតែ Admin ប៉ុណ្ណោះដែលអាចលុបកាលវិភាគបាន",
        403
      );
    }

    const scheduleId =
      toIdString(req.params.id);

    if (
      !isValidObjectId(
        scheduleId
      )
    ) {
      throw createHttpError(
        "Schedule ID is not valid"
      );
    }

    const schedule =
      await ScheduleModel.findOneAndDelete({
        _id: scheduleId,
        ...buildBranchFilter(req)
      });

    if (!schedule) {
      throw createHttpError(
        "Schedule not found",
        404
      );
    }

    return res.status(200).send({
      success: true,
      message: "Schedule deleted",
      result: schedule
    });
  } catch (error) {
    return sendControllerError(
      res,
      error,
      "Cannot delete schedule"
    );
  }
};