const { Router } = require("express");
const { 
  saveScore, 
  getScoresByClass, 
  deleteScore 
} = require("./scores.controller"); 
const { protect } = require("../shared/protect");
const { authorize } = require("../shared/authorize");

const router = Router();

// --- Read ---
// Both admins and teachers can view scores
router.get("/scores", protect, authorize(["admin", "teacher"]), getScoresByClass); 

// --- Create & Update (Upsert) ---
// Both admins and teachers can enter or modify scores
router.post("/scores", protect, authorize(["admin", "teacher"]), saveScore); 
router.put("/scores", protect, authorize(["admin", "teacher"]), saveScore); 

// --- Delete ---
// Optional: Maybe only admins are allowed to permanently delete a score record
router.delete("/scores/:id", protect, authorize(["admin"]), deleteScore);

module.exports = router;