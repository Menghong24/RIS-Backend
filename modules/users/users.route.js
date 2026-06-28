const { Router } = require("express");

const {
  createUser,
  loginUser,
  getProfile,
  logOut,
  findAllUser,
  deleteUser,
  updateUser,
  updateProfileImage,
  removeProfileImage
} = require("./users.controller");

const { protect } = require("../shared/protect");
const { authorize } = require("../shared/authorize");

const {
  uploadProfile,
  uploadProfileErrorHandler
} = require("../shared/uploadProfile");

const router = Router();

// ==============================
// Auth
// ==============================

router.post("/user/signup", createUser);

router.post("/user/login", loginUser);

router.post("/user/logout", protect, logOut);

router.get("/user/profile", protect, getProfile);

// ==============================
// Profile Image
// ==============================

// PATCH /user/profile-image
// field name: profileImage
router.patch(
  "/user/profile-image",
  protect,
  uploadProfile.single("profileImage"),
  uploadProfileErrorHandler,
  updateProfileImage
);

// DELETE /user/profile-image
router.delete(
  "/user/profile-image",
  protect,
  removeProfileImage
);

// ==============================
// User Management - Admin Only
// ==============================

router.get(
  "/user",
  protect,
  authorize("admin"),
  findAllUser
);

router.patch(
  "/user/:id",
  protect,
  authorize("admin"),
  updateUser
);

router.delete(
  "/user/:id",
  protect,
  authorize("admin"),
  deleteUser
);

module.exports = router;