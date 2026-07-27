const { Router } = require("express");

const {
  createTeacher,
  getAllTeacher,
  getOneTeacher,
  updateTeacher,
  deleteTeacher
} = require("./teachers.controller");

const {
  protect
} = require("../shared/protect");

const {
  authorize
} = require("../shared/authorize");

const {
  uploadTeacherFiles,
  uploadTeacherFilesErrorHandler
} = require("../shared/teacherCvUpload");

const router = Router();

/*
  Accepted multipart fields:

  profileImage:
    - JPG
    - JPEG
    - PNG
    - WEBP

  cvFile:
    - PDF
    - DOC
    - DOCX
*/

const teacherUploadFields =
  uploadTeacherFiles.fields([
    {
      name: "profileImage",
      maxCount: 1
    },
    {
      name: "cvFile",
      maxCount: 1
    }
  ]);

// ==========================================
// Create Teacher
// POST /teachers
// ==========================================

router.post(
  "/teachers",
  protect,
  authorize("admin"),
  teacherUploadFields,
  uploadTeacherFilesErrorHandler,
  createTeacher
);

// ==========================================
// Get All Teachers
// GET /teachers
// ==========================================

router.get(
  "/teachers",
  protect,
  authorize([
    "admin",
    "teacher"
  ]),
  getAllTeacher
);

// ==========================================
// Get One Teacher
// GET /teachers/:id
// ==========================================

router.get(
  "/teachers/:id",
  protect,
  authorize([
    "admin",
    "teacher"
  ]),
  getOneTeacher
);

// ==========================================
// Update Teacher
// PATCH /teachers/:id
// ==========================================

router.patch(
  "/teachers/:id",
  protect,
  authorize("admin"),
  teacherUploadFields,
  uploadTeacherFilesErrorHandler,
  updateTeacher
);

// ==========================================
// Delete Teacher
// DELETE /teachers/:id
// ==========================================

router.delete(
  "/teachers/:id",
  protect,
  authorize("admin"),
  deleteTeacher
);

module.exports = router;