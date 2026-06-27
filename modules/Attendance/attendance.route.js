const { Router } = require("express");
const {
  getAttendance,
  saveAttendance,
  getAttendanceReport,
  // getAttendanceReport,
  // deleteAttendance,
} = require("./attendance.controller");

const router = Router();

// ==============================
// Attendance
// ==============================

// Get attendance by class & date
// GET /attendance?classId=...&date=...
router.get("/attendance", getAttendance);

// Create or Update attendance
// POST /attendance
router.post("/attendance", saveAttendance);
router.get("/attendance/report", getAttendanceReport);

// ==============================
// Future APIs
// ==============================

// Attendance report
// GET /attendance/report
// router.get("/attendance/report", getAttendanceReport);

// Delete attendance
// DELETE /attendance/:id
// router.delete("/attendance/:id", deleteAttendance);

module.exports = router;