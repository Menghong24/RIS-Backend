const { Router } = require("express");
const { getAttendance, saveAttendance } = require("./attendance.controller");


const router = Router();

// GET /attendance?classId=...&date=...
router.get('/attendance', getAttendance);

// POST /attendance (Handles both Create and Update)
router.post('/attendance', saveAttendance);

module.exports = router;