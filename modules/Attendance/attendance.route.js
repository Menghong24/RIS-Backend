const { Router } = require("express");

const {
  getAttendance,
  saveAttendance,
  getAttendanceReport
  // deleteAttendance
} = require("./attendance.controller");

const { protect } = require("../shared/protect");
const { authorize } = require("../shared/authorize");
const { canAccessClass } = require("../shared/teacherAccess");

const router = Router();

// ==============================
// Attendance Report - Admin Only
// ==============================

// GET /attendance/report
router.get(
  "/attendance/report",
  protect,
  authorize("admin"),
  getAttendanceReport
);

// ==============================
// Attendance - Admin & Teacher
// ==============================

// GET /attendance?classId=...&date=...
router.get(
  "/attendance",
  protect,
  authorize(["admin", "teacher"]),
  canAccessClass,
  getAttendance
);

// POST /attendance
router.post(
  "/attendance",
  protect,
  authorize(["admin", "teacher"]),
  canAccessClass,
  saveAttendance
);

// ==============================
// Future API
// ==============================

// DELETE /attendance/:id
// router.delete(
//   "/attendance/:id",
//   protect,
//   authorize("admin"),
//   deleteAttendance
// );

module.exports = router;