const { Router } = require("express");

const {
  createTeacher,
  getAllTeacher,
  getOneTeacher,
  updateTeacher,
  deleteTeacher
} = require("./teachers.controller");

const { protect } = require("../shared/protect");
const { authorize } = require("../shared/authorize");

const {
  createImageUploader,
  uploadImageErrorHandler
} = require("../shared/uploadImage");

const router = Router();

const uploadTeacherImage = createImageUploader("teachers");

router.post(
  "/teachers",
  protect,
  authorize("admin"),
  uploadTeacherImage.single("profileImage"),
  uploadImageErrorHandler,
  createTeacher
);

router.get(
  "/teachers",
  protect,
  authorize(["admin", "teacher"]),
  getAllTeacher
);

router.get(
  "/teachers/:id",
  protect,
  authorize(["admin", "teacher"]),
  getOneTeacher
);

router.patch(
  "/teachers/:id",
  protect,
  authorize("admin"),
  uploadTeacherImage.single("profileImage"),
  uploadImageErrorHandler,
  updateTeacher
);

router.delete(
  "/teachers/:id",
  protect,
  authorize("admin"),
  deleteTeacher
);

module.exports = router;