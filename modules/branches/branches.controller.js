const mongoose = require("mongoose");

const BranchModel = require("./branches.model");
const { UserModel } = require("../users/users.model");

const toIdString = (value) => {
  return String(value?._id || value || "").trim();
};

const isValidObjectId = (value) => {
  return mongoose.Types.ObjectId.isValid(toIdString(value));
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
  return getUserRole(req) === "admin" && !getUserBranchId(req);
};

const escapeRegex = (value = "") => {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const sendControllerError = (res, error) => {
  if (error?.code === 11000) {
    const duplicatedField = Object.keys(error.keyPattern || {})[0];

    return res.status(409).send({
      err:
        duplicatedField === "branchCode"
          ? "Branch code already exists"
          : "Duplicate branch data"
    });
  }

  if (error?.name === "ValidationError") {
    const firstError = Object.values(error.errors || {})[0];

    return res.status(400).send({
      err: firstError?.message || error.message
    });
  }

  if (error?.name === "CastError") {
    return res.status(400).send({
      err: "Invalid ID"
    });
  }

  return res.status(error?.status || 500).send({
    err: error?.message || "Internal server error"
  });
};

const validateManager = async (managerId) => {
  if (
    managerId === undefined ||
    managerId === null ||
    String(managerId).trim() === ""
  ) {
    return null;
  }

  if (!isValidObjectId(managerId)) {
    const error = new Error("Manager ID is not valid");
    error.status = 400;
    throw error;
  }

  const manager = await UserModel.findById(managerId).select(
    "_id role isActive"
  );

  if (!manager) {
    const error = new Error("Manager user was not found");
    error.status = 400;
    throw error;
  }

  if (String(manager.role || "").toLowerCase() !== "admin") {
    const error = new Error("Branch manager must have the admin role");
    error.status = 400;
    throw error;
  }

  if (manager.isActive === false) {
    const error = new Error("Branch manager account is disabled");
    error.status = 400;
    throw error;
  }

  return manager._id;
};

const populateBranch = async (branch) => {
  if (!branch) {
    return branch;
  }

  await branch.populate({
    path: "manager",
    select: "username role profileImage isActive branch"
  });

  return branch;
};

/**
 * POST /branches
 *
 * Only a global admin can create a branch.
 * A global admin is an admin account without a branch.
 */
exports.createBranch = async (req, res) => {
  try {
    if (getUserRole(req) !== "admin") {
      return res.status(403).send({
        err: "អ្នកមិនមានសិទ្ធិបង្កើតសាខាទេ"
      });
    }

    if (!isGlobalAdmin(req)) {
      return res.status(403).send({
        err: "មានតែ Admin កណ្តាលប៉ុណ្ណោះដែលអាចបង្កើតសាខាបាន"
      });
    }

    const manager = await validateManager(req.body?.manager);

    const branch = await BranchModel.create({
      branchCode: req.body?.branchCode,
      branchName: req.body?.branchName,
      phone: req.body?.phone,
      email: req.body?.email,
      address: {
        village: req.body?.address?.village,
        commune: req.body?.address?.commune,
        district: req.body?.address?.district,
        province: req.body?.address?.province
      },
      manager,
      status: req.body?.status,
      remark: req.body?.remark
    });

    await populateBranch(branch);

    return res.status(201).send({
      success: true,
      message: "Branch created successfully",
      data: branch
    });
  } catch (error) {
    return sendControllerError(res, error);
  }
};

/**
 * GET /branches
 *
 * Global admin:
 * - Can see every branch
 * - Can search and filter
 *
 * Branch admin:
 * - Can only see their assigned branch
 */
exports.getBranches = async (req, res) => {
  try {
    if (getUserRole(req) !== "admin") {
      return res.status(403).send({
        err: "អ្នកមិនមានសិទ្ធិមើលសាខាទេ"
      });
    }

    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(Number.parseInt(req.query.limit, 10) || 20, 1),
      100
    );

    const skip = (page - 1) * limit;
    const filter = {};

    if (!isGlobalAdmin(req)) {
      const userBranchId = getUserBranchId(req);

      if (!userBranchId || !isValidObjectId(userBranchId)) {
        return res.status(403).send({
          err: "គណនីនេះមិនទាន់ភ្ជាប់ទៅសាខាទេ"
        });
      }

      filter._id = userBranchId;
    } else {
      if (req.query.status) {
        filter.status = String(req.query.status)
          .trim()
          .toLowerCase();
      }

      const search = String(req.query.search || "").trim();

      if (search) {
        const searchRegex = new RegExp(escapeRegex(search), "i");

        filter.$or = [
          {
            branchCode: searchRegex
          },
          {
            branchName: searchRegex
          },
          {
            phone: searchRegex
          },
          {
            email: searchRegex
          },
          {
            "address.village": searchRegex
          },
          {
            "address.commune": searchRegex
          },
          {
            "address.district": searchRegex
          },
          {
            "address.province": searchRegex
          }
        ];
      }
    }

    const [branches, total] = await Promise.all([
      BranchModel.find(filter)
        .populate(
          "manager",
          "username role profileImage isActive branch"
        )
        .sort({
          createdAt: -1
        })
        .skip(skip)
        .limit(limit),

      BranchModel.countDocuments(filter)
    ]);

    return res.status(200).send({
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: branches
    });
  } catch (error) {
    return sendControllerError(res, error);
  }
};

/**
 * GET /branches/:id
 */
exports.getBranch = async (req, res) => {
  try {
    if (getUserRole(req) !== "admin") {
      return res.status(403).send({
        err: "អ្នកមិនមានសិទ្ធិមើលសាខាទេ"
      });
    }

    const branchId = toIdString(req.params?.id);

    if (!isValidObjectId(branchId)) {
      return res.status(400).send({
        err: "Branch ID is not valid"
      });
    }

    const filter = {
      _id: branchId
    };

    if (!isGlobalAdmin(req)) {
      const userBranchId = getUserBranchId(req);

      if (!userBranchId || branchId !== userBranchId) {
        return res.status(403).send({
          err: "អ្នកមិនមានសិទ្ធិមើលសាខានេះទេ"
        });
      }

      filter._id = userBranchId;
    }

    const branch = await BranchModel.findOne(filter).populate(
      "manager",
      "username role profileImage isActive branch"
    );

    if (!branch) {
      return res.status(404).send({
        err: "Branch not found"
      });
    }

    return res.status(200).send({
      success: true,
      data: branch
    });
  } catch (error) {
    return sendControllerError(res, error);
  }
};

/**
 * PATCH /branches/:id
 *
 * Global admin can change:
 * - branchCode
 * - manager
 * - status
 * - general branch information
 *
 * Branch admin can only change:
 * - branchName
 * - phone
 * - email
 * - address
 * - remark
 */
exports.updateBranch = async (req, res) => {
  try {
    if (getUserRole(req) !== "admin") {
      return res.status(403).send({
        err: "អ្នកមិនមានសិទ្ធិកែប្រែសាខាទេ"
      });
    }

    const branchId = toIdString(req.params?.id);

    if (!isValidObjectId(branchId)) {
      return res.status(400).send({
        err: "Branch ID is not valid"
      });
    }

    const globalAdmin = isGlobalAdmin(req);

    if (!globalAdmin) {
      const userBranchId = getUserBranchId(req);

      if (!userBranchId || userBranchId !== branchId) {
        return res.status(403).send({
          err: "អ្នកមិនមានសិទ្ធិកែប្រែសាខានេះទេ"
        });
      }
    }

    const branch = await BranchModel.findById(branchId);

    if (!branch) {
      return res.status(404).send({
        err: "Branch not found"
      });
    }

    const editableFields = [
      "branchName",
      "phone",
      "email",
      "remark"
    ];

    editableFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        branch.set(field, req.body[field]);
      }
    });

    const addressFields = [
      "village",
      "commune",
      "district",
      "province"
    ];

    if (
      req.body?.address &&
      typeof req.body.address === "object" &&
      !Array.isArray(req.body.address)
    ) {
      addressFields.forEach((field) => {
        if (
          Object.prototype.hasOwnProperty.call(
            req.body.address,
            field
          )
        ) {
          branch.set(`address.${field}`, req.body.address[field]);
        }
      });
    }

    // Sensitive fields can only be changed by the global admin
    if (globalAdmin) {
      if (
        Object.prototype.hasOwnProperty.call(
          req.body,
          "branchCode"
        )
      ) {
        branch.branchCode = req.body.branchCode;
      }

      if (
        Object.prototype.hasOwnProperty.call(req.body, "status")
      ) {
        branch.status = req.body.status;
      }

      if (
        Object.prototype.hasOwnProperty.call(req.body, "manager")
      ) {
        branch.manager = await validateManager(req.body.manager);
      }
    }

    await branch.save();
    await populateBranch(branch);

    return res.status(200).send({
      success: true,
      message: "Branch updated successfully",
      data: branch
    });
  } catch (error) {
    return sendControllerError(res, error);
  }
};

/**
 * DELETE /branches/:id
 *
 * This performs a soft delete by changing the branch status to archived.
 * Existing students, teachers, classes, payments and other records remain safe.
 */
exports.deleteBranch = async (req, res) => {
  try {
    if (getUserRole(req) !== "admin" || !isGlobalAdmin(req)) {
      return res.status(403).send({
        err: "មានតែ Admin កណ្តាលប៉ុណ្ណោះដែលអាចលុបសាខាបាន"
      });
    }

    const branchId = toIdString(req.params?.id);

    if (!isValidObjectId(branchId)) {
      return res.status(400).send({
        err: "Branch ID is not valid"
      });
    }

    const branch = await BranchModel.findById(branchId);

    if (!branch) {
      return res.status(404).send({
        err: "Branch not found"
      });
    }

    branch.status = "archived";
    branch.manager = null;

    await branch.save();

    return res.status(200).send({
      success: true,
      message: "Branch archived successfully",
      data: branch
    });
  } catch (error) {
    return sendControllerError(res, error);
  }
};