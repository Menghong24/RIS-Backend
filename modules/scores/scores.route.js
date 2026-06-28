const { Router } = require("express");

const {
  saveScore,
  getScoresByClass,
  deleteScore
} = require("./scores.controller");

const { protect } = require("../shared/protect");
const { authorize } = require("../shared/authorize");
const { canAccessClass } = require("../shared/teacherAccess");

const router = Router();

// ==============================
// Scores - Admin & Teacher
// ==============================

// GET /scores?classId=...&subjectId=...&month=...&academicYear=...
router.get(
  "/scores",
  protect,
  authorize(["admin", "teacher"]),
  canAccessClass,
  getScoresByClass
);

// POST /scores
router.post(
  "/scores",
  protect,
  authorize(["admin", "teacher"]),
  canAccessClass,
  saveScore
);

// PUT /scores
router.put(
  "/scores",
  protect,
  authorize(["admin", "teacher"]),
  canAccessClass,
  saveScore
);

// ==============================
// Scores Delete - Admin Only
// ==============================

// DELETE /scores/:id
router.delete(
  "/scores/:id",
  protect,
  authorize("admin"),
  deleteScore
);

module.exports = router;