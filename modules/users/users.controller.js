const bcryptjs = require("bcryptjs");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

const { UserModel } = require("./users.model");
const BranchModel = require("../branches/branches.model");

const ALLOWED_ROLES = ["admin", "teacher", "user"];
const ALLOWED_BRANCH_STATUSES = ["active", "disabled", "archived"];

// ======================================================
// Helper functions
// ======================================================

const normalizeRole = (role) => {
  const normalizedRole = String(role || "user")
    .trim()
    .toLowerCase();

  return ALLOWED_ROLES.includes(normalizedRole)
    ? normalizedRole
    : null;
};

const normalizeObjectId = (value) => {
  if (!value) {
    return null;
  }

  const id = String(value?._id || value).trim();

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  return id;
};

const normalizeBoolean = (value) => {
  if (typeof value === "boolean") {
    return value;
  }

  const normalizedValue = String(value || "")
    .trim()
    .toLowerCase();

  if (["true", "1", "yes"].includes(normalizedValue)) {
    return true;
  }

  if (["false", "0", "no"].includes(normalizedValue)) {
    return false;
  }

  return null;
};

const getUserRole = (req) => {
  return String(req.user?.role || "")
    .trim()
    .toLowerCase();
};

const getUserBranchId = (req) => {
  return normalizeObjectId(req.user?.branch);
};

const isGlobalAdmin = (req) => {
  return (
    getUserRole(req) === "admin" &&
    !getUserBranchId(req)
  );
};

const escapeRegex = (value = "") => {
  return String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
};

const buildUserPayload = ({
  username,
  password,
  role,
  teacher,
  branch,
  isActive
}) => {
  const payload = {
    username,
    password,
    role,
    teacher: role === "teacher" ? teacher : null,
    branch: branch || null
  };

  if (isActive !== undefined) {
    payload.isActive = isActive;
  }

  return payload;
};

const sanitizeUser = (userDoc) => {
  if (!userDoc) {
    return null;
  }

  const user = userDoc.toObject
    ? userDoc.toObject()
    : { ...userDoc };

  delete user.password;

  return user;
};

const removeLocalFile = (filePath = "") => {
  try {
    if (!filePath) {
      return;
    }

    const normalizedFilePath = String(filePath).trim();

    if (
      normalizedFilePath.startsWith("http://") ||
      normalizedFilePath.startsWith("https://")
    ) {
      return;
    }

    const uploadsRoot = path.resolve(
      process.cwd(),
      "uploads"
    );

    const safePath = normalizedFilePath.replace(/^\/+/, "");

    const absolutePath = path.resolve(
      process.cwd(),
      safePath
    );

    const relativePath = path.relative(
      uploadsRoot,
      absolutePath
    );

    // Only delete files inside uploads directory
    if (
      relativePath.startsWith("..") ||
      path.isAbsolute(relativePath)
    ) {
      return;
    }

    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  } catch (error) {
    // Do not break the API request if deleting fails
  }
};

const validateBranch = async (
  branchId,
  {
    required = true,
    requireActive = false
  } = {}
) => {
  if (!branchId) {
    if (required) {
      const error = new Error(
        "User account must be linked to a branch"
      );

      error.status = 400;
      throw error;
    }

    return null;
  }

  const normalizedBranchId =
    normalizeObjectId(branchId);

  if (!normalizedBranchId) {
    const error = new Error(
      "Branch ID is not valid"
    );

    error.status = 400;
    throw error;
  }

  const filter = {
    _id: normalizedBranchId
  };

  if (requireActive) {
    filter.status = "active";
  }

  const branch = await BranchModel.findOne(filter)
    .select("_id branchCode branchName status");

  if (!branch) {
    const error = new Error(
      requireActive
        ? "Active branch was not found"
        : "Branch was not found"
    );

    error.status = 400;
    throw error;
  }

  return branch;
};

const populateUser = async (userId) => {
  return UserModel.findById(userId)
    .select("-password")
    .populate("teacher")
    .populate(
      "branch",
      "branchCode branchName status phone email address"
    );
};

const sendControllerError = (res, error) => {
  if (error?.code === 11000) {
    return res.status(409).send({
      err: "Username already exists"
    });
  }

  if (error?.name === "ValidationError") {
    const firstError = Object.values(
      error.errors || {}
    )[0];

    return res.status(400).send({
      err: firstError?.message || error.message
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
// Create user
// ======================================================

exports.createUser = async (req, res) => {
  try {
    const requesterRole = getUserRole(req);

    if (requesterRole !== "admin") {
      return res.status(403).send({
        err: "អ្នកមិនមានសិទ្ធិបង្កើតអ្នកប្រើប្រាស់ទេ"
      });
    }

    const username = String(
      req.body?.username || ""
    )
      .trim()
      .toLowerCase();

    const password = String(
      req.body?.password || ""
    );

    const role = normalizeRole(
      req.body?.role || "user"
    );

    if (!username || !password) {
      return res.status(400).send({
        err: "Username and password are required"
      });
    }

    if (!role) {
      return res.status(400).send({
        err: "Invalid role"
      });
    }

    const globalAdmin = isGlobalAdmin(req);
    const requesterBranchId =
      getUserBranchId(req);

    /*
      Branch admins cannot create other admin accounts.

      Global admin:
      - Can create global admin
      - Can create branch admin
      - Can create teacher/user for any branch

      Branch admin:
      - Can create teacher/user only in own branch
    */
    if (!globalAdmin && role === "admin") {
      return res.status(403).send({
        err: "មានតែ Admin កណ្តាលប៉ុណ្ណោះដែលអាចបង្កើត Admin បាន"
      });
    }

    let branch = null;

    if (globalAdmin) {
      const requestedBranch =
        normalizeObjectId(req.body?.branch);

      if (role === "admin") {
        // Empty branch means global admin
        if (req.body?.branch) {
          const branchDocument =
            await validateBranch(
              requestedBranch,
              {
                required: true,
                requireActive: true
              }
            );

          branch = branchDocument._id;
        }
      } else {
        const branchDocument =
          await validateBranch(
            requestedBranch,
            {
              required: true,
              requireActive: true
            }
          );

        branch = branchDocument._id;
      }
    } else {
      if (!requesterBranchId) {
        return res.status(403).send({
          err: "គណនី Admin នេះមិនទាន់ភ្ជាប់ទៅសាខាទេ"
        });
      }

      const branchDocument =
        await validateBranch(
          requesterBranchId,
          {
            required: true,
            requireActive: true
          }
        );

      branch = branchDocument._id;
    }

    let teacher = null;

    if (role === "teacher") {
      teacher = normalizeObjectId(
        req.body?.teacher
      );

      if (!teacher) {
        return res.status(400).send({
          err: "Teacher account must be linked to a teacher profile"
        });
      }
    }

    const existingUser =
      await UserModel.findOne({
        username
      }).select("_id");

    if (existingUser) {
      return res.status(409).send({
        err: "Username already exists"
      });
    }

    const hashedPassword =
      await bcryptjs.hash(password, 10);

    const newUser = await UserModel.create(
      buildUserPayload({
        username,
        password: hashedPassword,
        role,
        teacher,
        branch
      })
    );

    const populatedUser =
      await populateUser(newUser._id);

    return res.status(201).send({
      msg: "created",
      result: populatedUser
    });
  } catch (error) {
    return sendControllerError(res, error);
  }
};

// ======================================================
// Login
// ======================================================

exports.loginUser = async (req, res) => {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).send({
        err: "JWT secret is not configured"
      });
    }

    const username = String(
      req.body?.username || ""
    )
      .trim()
      .toLowerCase();

    const password = String(
      req.body?.password || ""
    );

    if (!username || !password) {
      return res.status(400).send({
        err: "Username and password are required"
      });
    }

    const user = await UserModel.findOne({
      username
    })
      .select("+password")
      .populate("teacher")
      .populate(
        "branch",
        "branchCode branchName status phone email address"
      );

    if (!user) {
      return res.status(401).send({
        err: "Invalid credentials"
      });
    }

    if (user.isActive === false) {
      return res.status(403).send({
        err: "This account has been disabled"
      });
    }

    if (
      user.branch &&
      user.branch.status !== "active"
    ) {
      return res.status(403).send({
        err: "This branch is not active"
      });
    }

    const isMatch = await bcryptjs.compare(
      password,
      user.password
    );

    if (!isMatch) {
      return res.status(401).send({
        err: "Invalid credentials"
      });
    }

    const teacherId =
      user.teacher?._id ||
      user.teacher ||
      null;

    const branchId =
      user.branch?._id ||
      user.branch ||
      null;

    const token = jwt.sign(
      {
        _id: user._id,
        role: user.role,
        teacher: teacherId,
        branch: branchId
      },
      process.env.JWT_SECRET,
      {
        expiresIn:
          process.env.JWT_EXPIRE || "7d"
      }
    );

    const userResponse = sanitizeUser(user);

    return res.status(200).send({
      msg: "login successfully!",
      token,
      result: userResponse
    });
  } catch (error) {
    return sendControllerError(res, error);
  }
};

// ======================================================
// Get current profile
// ======================================================

exports.getProfile = async (req, res) => {
  try {
    const user = await populateUser(
      req.user._id
    );

    if (!user) {
      return res.status(404).send({
        err: "User not found!"
      });
    }

    return res.status(200).send({
      msg: "Get profile",
      result: user
    });
  } catch (error) {
    return sendControllerError(res, error);
  }
};

// ======================================================
// Update profile image
// ======================================================

exports.updateProfileImage = async (
  req,
  res
) => {
  try {
    if (!req.file) {
      return res.status(400).send({
        err: "សូមជ្រើសរូបភាព"
      });
    }

    const currentUser =
      await UserModel.findById(
        req.user._id
      ).select(
        "_id profileImage"
      );

    if (!currentUser) {
      removeLocalFile(
        `/uploads/profiles/${req.file.filename}`
      );

      return res.status(404).send({
        err: "User not found"
      });
    }

    const oldProfileImage =
      currentUser.profileImage;

    const imagePath =
      `/uploads/profiles/${req.file.filename}`;

    currentUser.profileImage = imagePath;

    await currentUser.save();

    if (oldProfileImage) {
      removeLocalFile(oldProfileImage);
    }

    const user = await populateUser(
      currentUser._id
    );

    return res.status(200).send({
      msg: "Profile image updated successfully",
      result: user
    });
  } catch (error) {
    if (req.file?.filename) {
      removeLocalFile(
        `/uploads/profiles/${req.file.filename}`
      );
    }

    return sendControllerError(res, error);
  }
};

// ======================================================
// Remove profile image
// ======================================================

exports.removeProfileImage = async (
  req,
  res
) => {
  try {
    const currentUser =
      await UserModel.findById(
        req.user._id
      ).select(
        "_id profileImage"
      );

    if (!currentUser) {
      return res.status(404).send({
        err: "User not found"
      });
    }

    const oldProfileImage =
      currentUser.profileImage;

    currentUser.profileImage = "";

    await currentUser.save();

    if (oldProfileImage) {
      removeLocalFile(oldProfileImage);
    }

    const user = await populateUser(
      currentUser._id
    );

    return res.status(200).send({
      msg: "Profile image removed successfully",
      result: user
    });
  } catch (error) {
    return sendControllerError(res, error);
  }
};

// ======================================================
// Logout
// ======================================================

exports.logOut = async (req, res) => {
  return res.status(200).send({
    msg: "Logout successfully!"
  });
};

// ======================================================
// Find all users
// ======================================================

exports.findAllUser = async (req, res) => {
  try {
    const requesterRole = getUserRole(req);

    if (requesterRole !== "admin") {
      return res.status(403).send({
        err: "អ្នកមិនមានសិទ្ធិមើលអ្នកប្រើប្រាស់ទេ"
      });
    }

    const search = String(
      req.query.search || ""
    ).trim();

    const rawRole = String(
      req.query.role || ""
    )
      .trim()
      .toLowerCase();

    const role = ALLOWED_ROLES.includes(
      rawRole
    )
      ? rawRole
      : "";

    const rawStatus = String(
      req.query.branchStatus || ""
    )
      .trim()
      .toLowerCase();

    const page = Math.max(
      Number.parseInt(req.query.page, 10) || 1,
      1
    );

    const limit = Math.min(
      Math.max(
        Number.parseInt(
          req.query.limit,
          10
        ) || 10,
        1
      ),
      100
    );

    const skip = (page - 1) * limit;
    const queryObj = {};

    if (search) {
      queryObj.username = {
        $regex: escapeRegex(search),
        $options: "i"
      };
    }

    if (role) {
      queryObj.role = role;
    }

    if (
      req.query.isActive !== undefined
    ) {
      const isActive = normalizeBoolean(
        req.query.isActive
      );

      if (isActive === null) {
        return res.status(400).send({
          err: "isActive must be true or false"
        });
      }

      queryObj.isActive = isActive;
    }

    if (isGlobalAdmin(req)) {
      const requestedBranchId =
        normalizeObjectId(
          req.query.branch ||
          req.query.branchId
        );

      if (
        (req.query.branch ||
          req.query.branchId) &&
        !requestedBranchId
      ) {
        return res.status(400).send({
          err: "Branch ID is not valid"
        });
      }

      if (requestedBranchId) {
        queryObj.branch =
          requestedBranchId;
      }

      if (
        rawStatus &&
        !ALLOWED_BRANCH_STATUSES.includes(
          rawStatus
        )
      ) {
        return res.status(400).send({
          err: "Invalid branch status"
        });
      }
    } else {
      const branchId =
        getUserBranchId(req);

      if (!branchId) {
        return res.status(403).send({
          err: "គណនី Admin នេះមិនទាន់ភ្ជាប់ទៅសាខាទេ"
        });
      }

      queryObj.branch = branchId;
    }

    const [docCount, users] =
      await Promise.all([
        UserModel.countDocuments(queryObj),

        UserModel.find(queryObj)
          .select("-password")
          .populate("teacher")
          .populate(
            "branch",
            "branchCode branchName status phone email address"
          )
          .sort({
            _id: -1
          })
          .skip(skip)
          .limit(limit)
      ]);

    const totalPage =
      Math.ceil(docCount / limit) || 1;

    return res.status(200).send({
      msg: "Get",
      page,
      limit,
      total: totalPage,
      totalUsers: docCount,
      result: users
    });
  } catch (error) {
    return sendControllerError(res, error);
  }
};

// ======================================================
// Update user
// ======================================================

exports.updateUser = async (req, res) => {
  try {
    const requesterRole = getUserRole(req);

    if (requesterRole !== "admin") {
      return res.status(403).send({
        err: "អ្នកមិនមានសិទ្ធិកែប្រែអ្នកប្រើប្រាស់ទេ"
      });
    }

    const id = normalizeObjectId(
      req.params.id
    );

    if (!id) {
      return res.status(400).send({
        err: "User ID is not valid"
      });
    }

    if (req.body.password) {
      return res.status(400).send({
        err: "Passwords cannot be updated through this route."
      });
    }

    const currentUser =
      await UserModel.findById(id);

    if (!currentUser) {
      return res.status(404).send({
        err: "Document not found!"
      });
    }

    const globalAdmin = isGlobalAdmin(req);
    const requesterBranchId =
      getUserBranchId(req);

    if (!globalAdmin) {
      if (!requesterBranchId) {
        return res.status(403).send({
          err: "គណនី Admin នេះមិនទាន់ភ្ជាប់ទៅសាខាទេ"
        });
      }

      if (
        String(currentUser.branch || "") !==
        requesterBranchId
      ) {
        return res.status(403).send({
          err: "អ្នកមិនមានសិទ្ធិកែប្រែអ្នកប្រើប្រាស់សាខានេះទេ"
        });
      }

      if (currentUser.role === "admin") {
        return res.status(403).send({
          err: "Branch Admin cannot modify another admin account"
        });
      }
    }

    if (
      String(req.user?._id) ===
        String(currentUser._id) &&
      req.body.isActive !== undefined
    ) {
      const activeValue =
        normalizeBoolean(
          req.body.isActive
        );

      if (activeValue === false) {
        return res.status(400).send({
          err: "You cannot disable your own account"
        });
      }
    }

    const payload = {};

    if (
      req.body.username !== undefined
    ) {
      const username = String(
        req.body.username || ""
      )
        .trim()
        .toLowerCase();

      if (!username) {
        return res.status(400).send({
          err: "Username is required"
        });
      }

      payload.username = username;
    }

    let nextRole = currentUser.role;

    if (req.body.role !== undefined) {
      const role = normalizeRole(
        req.body.role
      );

      if (!role) {
        return res.status(400).send({
          err: "Invalid role"
        });
      }

      if (!globalAdmin && role === "admin") {
        return res.status(403).send({
          err: "មានតែ Admin កណ្តាលប៉ុណ្ណោះដែលអាចកំណត់តួនាទី Admin បាន"
        });
      }

      nextRole = role;
      payload.role = role;
    }

    let nextBranchId = normalizeObjectId(
      currentUser.branch
    );

    if (globalAdmin) {
      if (
        req.body.branch !== undefined
      ) {
        if (
          req.body.branch === null ||
          String(req.body.branch).trim() === ""
        ) {
          nextBranchId = null;
        } else {
          const branch =
            await validateBranch(
              req.body.branch,
              {
                required: true,
                requireActive: true
              }
            );

          nextBranchId = String(
            branch._id
          );
        }
      }
    } else {
      nextBranchId = requesterBranchId;
    }

    if (
      nextRole !== "admin" &&
      !nextBranchId
    ) {
      return res.status(400).send({
        err: "Teacher and user accounts must be linked to a branch"
      });
    }

    payload.branch =
      nextBranchId || null;

    if (nextRole === "teacher") {
      const teacherId =
        normalizeObjectId(
          req.body.teacher !== undefined
            ? req.body.teacher
            : currentUser.teacher
        );

      if (!teacherId) {
        return res.status(400).send({
          err: "Teacher account must be linked to a teacher profile"
        });
      }

      payload.teacher = teacherId;
    } else {
      payload.teacher = null;
    }

    if (
      req.body.isActive !== undefined
    ) {
      const isActive = normalizeBoolean(
        req.body.isActive
      );

      if (isActive === null) {
        return res.status(400).send({
          err: "isActive must be true or false"
        });
      }

      payload.isActive = isActive;
    }

    currentUser.set(payload);

    await currentUser.validate();
    await currentUser.save();

    const updatedUser =
      await populateUser(
        currentUser._id
      );

    return res.status(200).send({
      msg: "Update successfully",
      result: updatedUser
    });
  } catch (error) {
    return sendControllerError(res, error);
  }
};

// ======================================================
// Delete user
// ======================================================

exports.deleteUser = async (req, res) => {
  try {
    const requesterRole = getUserRole(req);

    if (requesterRole !== "admin") {
      return res.status(403).json({
        err: "អ្នកមិនមានសិទ្ធិលុបអ្នកប្រើប្រាស់ទេ"
      });
    }

    const id = normalizeObjectId(
      req.params.id
    );

    if (!id) {
      return res.status(400).json({
        err: "User ID is not valid"
      });
    }

    if (
      String(req.user?._id) === String(id)
    ) {
      return res.status(400).json({
        err: "You cannot delete your own account"
      });
    }

    const user =
      await UserModel.findById(id);

    if (!user) {
      return res.status(404).json({
        err: "Document not found!"
      });
    }

    if (!isGlobalAdmin(req)) {
      const requesterBranchId =
        getUserBranchId(req);

      if (!requesterBranchId) {
        return res.status(403).json({
          err: "គណនី Admin នេះមិនទាន់ភ្ជាប់ទៅសាខាទេ"
        });
      }

      if (
        String(user.branch || "") !==
        requesterBranchId
      ) {
        return res.status(403).json({
          err: "អ្នកមិនមានសិទ្ធិលុបអ្នកប្រើប្រាស់សាខានេះទេ"
        });
      }

      if (user.role === "admin") {
        return res.status(403).json({
          err: "Branch Admin cannot delete another admin account"
        });
      }
    }

    await UserModel.findByIdAndDelete(id);

    // Remove the deleted user as branch manager
    await BranchModel.updateMany(
      {
        manager: id
      },
      {
        $set: {
          manager: null
        }
      }
    );

    if (user.profileImage) {
      removeLocalFile(
        user.profileImage
      );
    }

    return res.status(200).json({
      msg: "Deleted successfully"
    });
  } catch (error) {
    return sendControllerError(res, error);
  }
};