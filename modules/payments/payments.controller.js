const mongoose = require("mongoose");

const PaymentModel = require("./payments.model");
const StudentModel = require("../students/students.model");
const ClassesModel = require("../classes/classes.model");
const TeacherModel = require("../teachers/teachers.model");
const BranchModel = require("../branches/branches.model");

const PAYMENT_STATUSES = [
  "unpaid",
  "paid",
  "late",
  "partial"
];

const PAYMENT_MONTH_PATTERN =
  /^\d{4}-(0[1-9]|1[0-2])$/;

// ======================================================
// Basic helpers
// ======================================================

const toIdString = (value) => {
  return String(value?._id || value || "").trim();
};

const isValidObjectId = (value) => {
  const id = toIdString(value);

  return (
    Boolean(id) &&
    mongoose.Types.ObjectId.isValid(id)
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

const assertAllowedRole = (req) => {
  if (!isAdmin(req) && !isTeacher(req)) {
    throw createHttpError(
      "អ្នកមិនមានសិទ្ធិប្រើប្រាស់ទិន្នន័យការបង់ប្រាក់ទេ",
      403
    );
  }
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

const resolveBranchForWrite = async (
  req,
  currentBranchId = null
) => {
  assertAllowedRole(req);

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
      "សូមជ្រើសរើសសាខា"
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

  return toIdString(branch._id);
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
// Payload normalization
// ======================================================

const normalizeMoneyInput = (
  value,
  fieldName
) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return value;
  }

  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number < 0
  ) {
    throw createHttpError(
      `${fieldName} must be a non-negative number`
    );
  }

  return number;
};

const normalizeDateInput = (
  value,
  fieldName,
  { allowNull = false } = {}
) => {
  if (
    value === undefined ||
    value === ""
  ) {
    return value;
  }

  if (value === null && allowNull) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw createHttpError(
      `${fieldName} is not a valid date`
    );
  }

  return date;
};

const normalizePaymentPayload = (
  body = {},
  { partial = false } = {}
) => {
  const payload = {};

  const studentValue =
    body.student || body.studentId;

  const classValue =
    body.class || body.classId;

  if (
    !partial ||
    hasOwnProperty(body, "student") ||
    hasOwnProperty(body, "studentId")
  ) {
    payload.student =
      toIdString(studentValue);
  }

  if (
    !partial ||
    hasOwnProperty(body, "class") ||
    hasOwnProperty(body, "classId")
  ) {
    payload.class =
      toIdString(classValue);
  }

  if (
    !partial ||
    hasOwnProperty(body, "teacher")
  ) {
    payload.teacher =
      toIdString(body.teacher) || null;
  }

  if (
    !partial ||
    hasOwnProperty(body, "paymentMonth")
  ) {
    payload.paymentMonth = String(
      body.paymentMonth || ""
    ).trim();
  }

  if (
    !partial ||
    hasOwnProperty(body, "dueDate")
  ) {
    payload.dueDate =
      normalizeDateInput(
        body.dueDate,
        "Due date"
      );
  }

  if (hasOwnProperty(body, "payDate")) {
    payload.payDate =
      normalizeDateInput(
        body.payDate,
        "Pay date",
        {
          allowNull: true
        }
      );
  }

  [
    "tuitionFee",
    "extraFee",
    "paidAmount",
    "amount"
  ].forEach((field) => {
    if (hasOwnProperty(body, field)) {
      payload[field] =
        normalizeMoneyInput(
          body[field],
          field
        );
    }
  });

  if (hasOwnProperty(body, "remark")) {
    payload.remark = String(
      body.remark || ""
    ).trim();
  }

  /*
    These fields are calculated by the model.
    Do not trust values sent by the client.
  */
  delete payload.expectedAmount;
  delete payload.balance;
  delete payload.status;

  return payload;
};

// ======================================================
// Relationship validation
// ======================================================

const getStudentClassIds = (student) => {
  if (!student) {
    return [];
  }

  return [
    toIdString(student.grade),
    toIdString(student.class),
    toIdString(student.classId),
    ...(Array.isArray(student.classes)
      ? student.classes.map(toIdString)
      : []),
    ...(Array.isArray(student.classIds)
      ? student.classIds.map(toIdString)
      : [])
  ].filter(Boolean);
};

const studentBelongsToClass = (
  student,
  classDocument,
  classId
) => {
  const normalizedClassId =
    toIdString(classId);

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
      ? classDocument.students.map(
          toIdString
        )
      : [];

  return classStudentIds.includes(
    toIdString(student?._id)
  );
};

const validatePaymentRelations = async ({
  branchId,
  studentId,
  classId,
  teacherId = null
}) => {
  if (
    !studentId ||
    !isValidObjectId(studentId)
  ) {
    throw createHttpError(
      "Student ID is required"
    );
  }

  const student =
    await StudentModel.findOne({
      _id: studentId,
      branch: branchId
    }).select(
      "_id branch grade class classId classes classIds"
    );

  if (!student) {
    throw createHttpError(
      "Student was not found in this branch",
      404
    );
  }

  const studentClassIds =
    getStudentClassIds(student);

  const finalClassId =
    classId || studentClassIds[0] || "";

  if (
    !finalClassId ||
    !isValidObjectId(finalClassId)
  ) {
    throw createHttpError(
      "Student does not have a valid class"
    );
  }

  const classDocument =
    await ClassesModel.findOne({
      _id: finalClassId,
      branch: branchId
    }).select(
      "_id branch teacher students"
    );

  if (!classDocument) {
    throw createHttpError(
      "Class was not found in this branch",
      404
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
      "Student does not belong to this class"
    );
  }

  let finalTeacherId =
    teacherId ||
    toIdString(classDocument.teacher) ||
    null;

  if (finalTeacherId) {
    if (
      !isValidObjectId(finalTeacherId)
    ) {
      throw createHttpError(
        "Teacher ID is not valid"
      );
    }

    const teacher =
      await TeacherModel.findOne({
        _id: finalTeacherId,
        branch: branchId
      }).select("_id status");

    if (!teacher) {
      throw createHttpError(
        "Teacher was not found in this branch",
        404
      );
    }
  }

  return {
    student,
    classDocument,
    classId: finalClassId,
    teacherId: finalTeacherId
  };
};

// ======================================================
// Teacher access
// ======================================================

const getTeacherClassIds = async (
  req
) => {
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

  if (
    !branchId ||
    !isValidObjectId(branchId)
  ) {
    throw createHttpError(
      "គណនីគ្រូនេះមិនទាន់ភ្ជាប់ទៅសាខាទេ",
      403
    );
  }

  const teacherClasses =
    await ClassesModel.find({
      teacher: teacherId,
      branch: branchId
    }).select("_id");

  return teacherClasses.map(
    (classDocument) =>
      classDocument._id
  );
};

const ensureTeacherClassAccess = async (
  req,
  classId,
  branchId
) => {
  if (isAdmin(req)) {
    return true;
  }

  if (!isTeacher(req)) {
    throw createHttpError(
      "អ្នកមិនមានសិទ្ធិប្រើប្រាស់ការបង់ប្រាក់ទេ",
      403
    );
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

  const foundClass =
    await ClassesModel.findOne({
      _id: classId,
      branch: branchId,
      teacher: teacherId
    }).select("_id");

  if (!foundClass) {
    throw createHttpError(
      "អ្នកមិនមានសិទ្ធិប្រើប្រាស់ការបង់ប្រាក់សម្រាប់ថ្នាក់នេះទេ",
      403
    );
  }

  return true;
};

// ======================================================
// Filters and population
// ======================================================

const validateFilterId = (
  value,
  fieldName
) => {
  if (
    !value ||
    value === "All"
  ) {
    return "";
  }

  if (!isValidObjectId(value)) {
    throw createHttpError(
      `${fieldName} is not valid`
    );
  }

  return toIdString(value);
};

const buildPaymentFilter = async (
  req
) => {
  const filter = {
    ...buildBranchFilter(req)
  };

  const finalClassId =
    req.query.classId ||
    req.query.class;

  const finalStudentId =
    req.query.studentId ||
    req.query.student;

  const finalPaymentMonth =
    req.query.paymentMonth ||
    req.query.month;

  const finalTeacherId =
    req.query.teacherId ||
    req.query.teacher;

  if (
    finalClassId &&
    finalClassId !== "All"
  ) {
    filter.class = validateFilterId(
      finalClassId,
      "Class ID"
    );
  }

  if (
    finalStudentId &&
    finalStudentId !== "All"
  ) {
    filter.student = validateFilterId(
      finalStudentId,
      "Student ID"
    );
  }

  if (
    finalTeacherId &&
    finalTeacherId !== "All"
  ) {
    filter.teacher = validateFilterId(
      finalTeacherId,
      "Teacher ID"
    );
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
      !PAYMENT_STATUSES.includes(status)
    ) {
      throw createHttpError(
        "Invalid payment status"
      );
    }

    filter.status = status;
  }

  if (
    finalPaymentMonth &&
    finalPaymentMonth !== "All"
  ) {
    const paymentMonth = String(
      finalPaymentMonth
    ).trim();

    if (
      !PAYMENT_MONTH_PATTERN.test(
        paymentMonth
      )
    ) {
      throw createHttpError(
        "Payment month must be YYYY-MM"
      );
    }

    filter.paymentMonth =
      paymentMonth;
  }

  if (isTeacher(req)) {
    const classIds =
      await getTeacherClassIds(req);

    if (filter.class) {
      const allowed =
        classIds.some(
          (classId) =>
            toIdString(classId) ===
            toIdString(filter.class)
        );

      if (!allowed) {
        throw createHttpError(
          "អ្នកមិនមានសិទ្ធិមើលការបង់ប្រាក់ថ្នាក់នេះទេ",
          403
        );
      }
    } else {
      filter.class = {
        $in: classIds
      };
    }

    /*
      Teachers should not use a teacher filter
      to view another teacher's payment reports.
    */
    if (
      filter.teacher &&
      toIdString(filter.teacher) !==
        getUserTeacherId(req)
    ) {
      throw createHttpError(
        "អ្នកមិនមានសិទ្ធិមើលរបាយការណ៍គ្រូនេះទេ",
        403
      );
    }
  }

  return filter;
};

const populatePaymentQuery = (query) => {
  return query
    .populate(
      "branch",
      "branchCode branchName status"
    )
    .populate(
      "student",
      "khmerName englishName studentId gender family joinDate profileImage branch grade status"
    )
    .populate(
      "class",
      "classNumber className classGrade timeStudy yearOnStudy teacher branch status"
    )
    .populate(
      "teacher",
      "khmerName englishName phone profileImage branch status"
    );
};

const populatePaymentDocument =
  async (payment) => {
    await payment.populate([
      {
        path: "branch",
        select:
          "branchCode branchName status"
      },
      {
        path: "student",
        select:
          "khmerName englishName studentId gender family joinDate profileImage branch grade status"
      },
      {
        path: "class",
        select:
          "classNumber className classGrade timeStudy yearOnStudy teacher branch status"
      },
      {
        path: "teacher",
        select:
          "khmerName englishName phone profileImage branch status"
      }
    ]);

    return payment;
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
      err: "Payment for this student, class and month already exists in this branch"
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
// CREATE
// ======================================================

exports.createPayment = async (
  req,
  res
) => {
  try {
    assertAllowedRole(req);

    const payload =
      normalizePaymentPayload(
        req.body,
        {
          partial: false
        }
      );

    const branchId =
      await resolveBranchForWrite(req);

    if (
      !payload.paymentMonth ||
      !PAYMENT_MONTH_PATTERN.test(
        payload.paymentMonth
      )
    ) {
      throw createHttpError(
        "Payment month must be YYYY-MM"
      );
    }

    if (!payload.dueDate) {
      throw createHttpError(
        "Due date is required"
      );
    }

    const relationship =
      await validatePaymentRelations({
        branchId,
        studentId: payload.student,
        classId: payload.class,
        teacherId:
          payload.teacher
      });

    await ensureTeacherClassAccess(
      req,
      relationship.classId,
      branchId
    );

    payload.branch = branchId;
    payload.student =
      relationship.student._id;
    payload.class =
      relationship.classId;
    payload.teacher =
      relationship.teacherId;

    const payment =
      await PaymentModel.create(
        payload
      );

    await populatePaymentDocument(
      payment
    );

    return res.status(201).send({
      success: true,
      message:
        "Payment created successfully",
      result: payment
    });
  } catch (error) {
    return sendControllerError(
      res,
      error,
      "Cannot create payment"
    );
  }
};

// ======================================================
// READ ALL
// ======================================================

exports.getAllPayments = async (
  req,
  res
) => {
  try {
    const filter =
      await buildPaymentFilter(req);

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

    const [payments, totalPayments] =
      await Promise.all([
        populatePaymentQuery(
          PaymentModel.find(filter)
            .sort({
              createdAt: -1
            })
            .skip(skip)
            .limit(limit)
        ),

        PaymentModel.countDocuments(
          filter
        )
      ]);

    return res.status(200).send({
      success: true,
      page,
      limit,
      totalPayments,
      totalPages:
        Math.ceil(
          totalPayments / limit
        ) || 1,
      result: payments
    });
  } catch (error) {
    return sendControllerError(
      res,
      error,
      "Cannot get payments"
    );
  }
};

// ======================================================
// READ ONE
// ======================================================

exports.getOnePayment = async (
  req,
  res
) => {
  try {
    assertAllowedRole(req);

    const id = toIdString(
      req.params.id
    );

    if (!isValidObjectId(id)) {
      throw createHttpError(
        "Payment ID មិនត្រឹមត្រូវ"
      );
    }

    const payment =
      await PaymentModel.findOne({
        _id: id,
        ...buildBranchFilter(req)
      });

    if (!payment) {
      throw createHttpError(
        "Payment not found",
        404
      );
    }

    await ensureTeacherClassAccess(
      req,
      payment.class,
      payment.branch
    );

    await populatePaymentDocument(
      payment
    );

    return res.status(200).send({
      success: true,
      result: payment
    });
  } catch (error) {
    return sendControllerError(
      res,
      error,
      "Cannot get payment"
    );
  }
};

// ======================================================
// UPDATE
// ======================================================

exports.updatePayment = async (
  req,
  res
) => {
  try {
    assertAllowedRole(req);

    const id = toIdString(
      req.params.id
    );

    if (!isValidObjectId(id)) {
      throw createHttpError(
        "Payment ID មិនត្រឹមត្រូវ"
      );
    }

    const existingPayment =
      await PaymentModel.findOne({
        _id: id,
        ...buildBranchFilter(req)
      });

    if (!existingPayment) {
      throw createHttpError(
        "Payment not found",
        404
      );
    }

    await ensureTeacherClassAccess(
      req,
      existingPayment.class,
      existingPayment.branch
    );

    const payload =
      normalizePaymentPayload(
        req.body,
        {
          partial: true
        }
      );

    /*
      Keep payment history stable.

      These fields cannot be moved after
      a payment record has been created.
    */
    delete payload.student;
    delete payload.class;
    delete payload.paymentMonth;
    delete payload.teacher;
    delete payload.branch;

    existingPayment.set(payload);

    await existingPayment.save();
    await populatePaymentDocument(
      existingPayment
    );

    return res.status(200).send({
      success: true,
      message:
        "Payment updated successfully",
      result: existingPayment
    });
  } catch (error) {
    return sendControllerError(
      res,
      error,
      "Cannot update payment"
    );
  }
};

// ======================================================
// DELETE
// ======================================================

exports.deletePayment = async (
  req,
  res
) => {
  try {
    assertAllowedRole(req);

    const id = toIdString(
      req.params.id
    );

    if (!isValidObjectId(id)) {
      throw createHttpError(
        "Payment ID មិនត្រឹមត្រូវ"
      );
    }

    const existingPayment =
      await PaymentModel.findOne({
        _id: id,
        ...buildBranchFilter(req)
      }).select(
        "_id branch class"
      );

    if (!existingPayment) {
      throw createHttpError(
        "Payment not found",
        404
      );
    }

    await ensureTeacherClassAccess(
      req,
      existingPayment.class,
      existingPayment.branch
    );

    const payment =
      await PaymentModel.findOneAndDelete({
        _id: existingPayment._id,
        branch:
          existingPayment.branch
      });

    return res.status(200).send({
      success: true,
      message:
        "Payment deleted successfully",
      result: payment
    });
  } catch (error) {
    return sendControllerError(
      res,
      error,
      "Cannot delete payment"
    );
  }
};