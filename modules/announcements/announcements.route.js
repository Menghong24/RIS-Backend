const { Router } = require("express");

const {
  createAnnouncement,
  getAllAnnouncements,
  getOneAnnouncement,
  updateAnnouncement,
  deleteAnnouncement
} = require("./announcements.controller");

const { protect } = require("../shared/protect");
const { authorize } = require("../shared/authorize");

const router = Router();

// ==============================
// Announcements View
// Admin, Teacher, User can view
// ==============================

router.get(
  "/announcements",
  protect,
  authorize(["admin", "teacher", "user"]),
  getAllAnnouncements
);

router.get(
  "/announcements/:id",
  protect,
  authorize(["admin", "teacher", "user"]),
  getOneAnnouncement
);

// ==============================
// Announcements Manage
// Admin only
// Teacher/User = View only
// ==============================

router.post(
  "/announcements",
  protect,
  authorize("admin"),
  createAnnouncement
);

router.patch(
  "/announcements/:id",
  protect,
  authorize("admin"),
  updateAnnouncement
);

router.delete(
  "/announcements/:id",
  protect,
  authorize("admin"),
  deleteAnnouncement
);

module.exports = router;