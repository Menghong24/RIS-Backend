const { Router } = require("express");

const {
  createStudent,
  findAllStudent,
  getOneStudent,
  updateStudent,
  deleteStudent
} = require("./students.controller");

const { protect } = require("../shared/protect");
const { authorize } = require("../shared/authorize");

const {
  createImageUploader,
  uploadImageErrorHandler
} = require("../shared/uploadImage");

const router = Router();

const uploadStudentImage = createImageUploader("students");

router.post(
  "/students",
  protect,
  authorize("admin"),
  uploadStudentImage.single("profileImage"),
  uploadImageErrorHandler,
  createStudent
);

router.get(
  "/students",
  protect,
  authorize(["admin", "teacher"]),
  findAllStudent
);

router.get(
  "/students/:id",
  protect,
  authorize(["admin", "teacher"]),
  getOneStudent
);

router.patch(
  "/students/:id",
  protect,
  authorize("admin"),
  uploadStudentImage.single("profileImage"),
  uploadImageErrorHandler,
  updateStudent
);

router.delete(
  "/students/:id",
  protect,
  authorize("admin"),
  deleteStudent
);

module.exports = router;