const bcryptjs = require("bcryptjs");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const { UserModel } = require("./users.model");
const jwt = require("jsonwebtoken");

const ALLOWED_ROLES = ["admin", "teacher", "user"];

const normalizeRole = (role) => {
  const normalizedRole = String(role || "user").trim().toLowerCase();
  return ALLOWED_ROLES.includes(normalizedRole) ? normalizedRole : null;
};

const normalizeObjectId = (value) => {
  if (!value) return null;

  const id = String(value).trim();

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  return id;
};

const buildUserPayload = ({ username, password, role, teacher }) => {
  const payload = {
    username,
    password,
    role
  };

  if (role === "teacher") {
    payload.teacher = teacher;
  } else {
    payload.teacher = null;
  }

  return payload;
};

const sanitizeUser = (userDoc) => {
  if (!userDoc) return null;

  const user = userDoc.toObject ? userDoc.toObject() : { ...userDoc };
  delete user.password;

  return user;
};

const removeLocalFile = (filePath = "") => {
  try {
    if (!filePath) return;

    if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
      return;
    }

    const safePath = String(filePath).replace(/^\/+/, "");
    const absolutePath = path.join(process.cwd(), safePath);

    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  } catch (error) {
    // Do not break API request if file deleting fails
  }
};

exports.createUser = async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const role = normalizeRole(req.body?.role || "user");

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

    let teacher = null;

    if (role === "teacher") {
      teacher = normalizeObjectId(req.body?.teacher);

      if (!teacher) {
        return res.status(400).send({
          err: "Teacher account must be linked to a teacher profile"
        });
      }
    }

    const existingUser = await UserModel.findOne({
      username
    });

    if (existingUser) {
      return res.status(409).send({
        err: "Username already exists"
      });
    }

    const hashedPassword = await bcryptjs.hash(password, 10);

    const newUser = await UserModel.create(
      buildUserPayload({
        username,
        password: hashedPassword,
        role,
        teacher
      })
    );

    const populatedUser = await UserModel.findById(newUser._id)
      .select("-password")
      .populate("teacher");

    return res.status(201).send({
      msg: "created",
      result: populatedUser
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).send({
        err: "Username already exists"
      });
    }

    return res.status(500).send({
      err: error.message || "Internal server error"
    });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!username || !password) {
      return res.status(400).send({
        err: "Username and password are required"
      });
    }

    const user = await UserModel.findOne({
      username
    })
      .select("+password")
      .populate("teacher");

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

    const isMatch = await bcryptjs.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).send({
        err: "Invalid credentials"
      });
    }

    const teacherId = user.teacher?._id || user.teacher || null;

    const token = jwt.sign(
      {
        _id: user._id,
        role: user.role,
        teacher: teacherId
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRE || "7d"
      }
    );

    const userResponse = sanitizeUser(user);

    return res.status(200).send({
      msg: "login successfully!",
      token,
      result: userResponse
    });
  } catch (error) {
    return res.status(500).send({
      err: error.message || "Internal server error"
    });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await UserModel.findById(req.user._id)
      .select("-password")
      .populate("teacher");

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
    return res.status(500).send({
      err: error.message || "Internal server error"
    });
  }
};

exports.updateProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send({
        err: "សូមជ្រើសរូបភាព"
      });
    }

    const currentUser = await UserModel.findById(req.user._id)
      .select("-password")
      .populate("teacher");

    if (!currentUser) {
      removeLocalFile(`/uploads/profiles/${req.file.filename}`);

      return res.status(404).send({
        err: "User not found"
      });
    }

    if (currentUser.profileImage) {
      removeLocalFile(currentUser.profileImage);
    }

    const imagePath = `/uploads/profiles/${req.file.filename}`;

    const user = await UserModel.findByIdAndUpdate(
      req.user._id,
      {
        profileImage: imagePath
      },
      {
        new: true,
        runValidators: true
      }
    )
      .select("-password")
      .populate("teacher");

    return res.status(200).send({
      msg: "Profile image updated successfully",
      result: user
    });
  } catch (error) {
    if (req.file?.filename) {
      removeLocalFile(`/uploads/profiles/${req.file.filename}`);
    }

    return res.status(500).send({
      err: error.message || "Internal server error"
    });
  }
};

exports.removeProfileImage = async (req, res) => {
  try {
    const currentUser = await UserModel.findById(req.user._id)
      .select("-password")
      .populate("teacher");

    if (!currentUser) {
      return res.status(404).send({
        err: "User not found"
      });
    }

    if (currentUser.profileImage) {
      removeLocalFile(currentUser.profileImage);
    }

    const user = await UserModel.findByIdAndUpdate(
      req.user._id,
      {
        profileImage: ""
      },
      {
        new: true,
        runValidators: true
      }
    )
      .select("-password")
      .populate("teacher");

    return res.status(200).send({
      msg: "Profile image removed successfully",
      result: user
    });
  } catch (error) {
    return res.status(500).send({
      err: error.message || "Internal server error"
    });
  }
};

exports.logOut = async (req, res) => {
  return res.status(200).send({
    msg: "Logout successfully!"
  });
};

exports.findAllUser = async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    const rawRole = String(req.query.role || "").trim().toLowerCase();
    const role = ALLOWED_ROLES.includes(rawRole) ? rawRole : "";

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 10, 1);
    const skip = (page - 1) * limit;

    const queryObj = {};

    if (search) {
      queryObj.username = {
        $regex: search,
        $options: "i"
      };
    }

    if (role) {
      queryObj.role = role;
    }

    const docCount = await UserModel.countDocuments(queryObj);

    const doc = await UserModel.find(queryObj)
      .select("-password")
      .populate("teacher")
      .sort({
        _id: -1
      })
      .skip(skip)
      .limit(limit);

    const totalPage = Math.ceil(docCount / limit) || 1;

    return res.status(200).send({
      msg: "Get",
      total: totalPage,
      totalUsers: docCount,
      result: doc
    });
  } catch (error) {
    return res.status(500).send({
      err: error.message || "Internal server error"
    });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const id = req.params.id;

    if (req.body.password) {
      return res.status(400).send({
        err: "Passwords cannot be updated through this route."
      });
    }

    const payload = {};

    if (req.body.username !== undefined) {
      const username = String(req.body.username || "").trim().toLowerCase();

      if (!username) {
        return res.status(400).send({
          err: "Username is required"
        });
      }

      payload.username = username;
    }

    if (req.body.role !== undefined) {
      const role = normalizeRole(req.body.role);

      if (!role) {
        return res.status(400).send({
          err: "Invalid role"
        });
      }

      payload.role = role;
    }

    const currentUser = await UserModel.findById(id);

    if (!currentUser) {
      return res.status(404).send({
        err: "Document not found!"
      });
    }

    const nextRole = payload.role || currentUser.role;

    if (nextRole === "teacher") {
      const teacherId = normalizeObjectId(
        req.body.teacher !== undefined ? req.body.teacher : currentUser.teacher
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

    if (req.body.isActive !== undefined) {
      payload.isActive = Boolean(req.body.isActive);
    }

    const doc = await UserModel.findByIdAndUpdate(
      id,
      payload,
      {
        new: true,
        runValidators: true
      }
    )
      .select("-password")
      .populate("teacher");

    return res.status(200).send({
      msg: "Update successfully",
      result: doc
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).send({
        err: "Username already exists"
      });
    }

    return res.status(500).send({
      err: error.message || "Internal server error"
    });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const id = req.params.id;

    if (String(req.user?._id) === String(id)) {
      return res.status(400).json({
        err: "You cannot delete your own account"
      });
    }

    const doc = await UserModel.findByIdAndDelete(id);

    if (!doc) {
      return res.status(404).json({
        err: "Document not found!"
      });
    }

    if (doc.profileImage) {
      removeLocalFile(doc.profileImage);
    }

    return res.status(200).json({
      msg: "Deleted successfully"
    });
  } catch (error) {
    return res.status(500).json({
      err: error.message || "Internal server error"
    });
  }
};