const { Router } = require("express");

const {
  createPayment,
  getAllPayments,
  getOnePayment,
  updatePayment,
  deletePayment
} = require("./payments.controller");

const { protect } = require("../shared/protect");
const { authorize } = require("../shared/authorize");

const router = Router();

// ==============================
// Payments - Admin Only
// ==============================

// POST /payments
router.post(
  "/payments",
  protect,
  authorize("admin"),
  createPayment
);

// GET /payments
// ប្រើសម្រាប់ payment list និង payment report data
router.get(
  "/payments",
  protect,
  authorize("admin"),
  getAllPayments
);

// GET /payments/:id
router.get(
  "/payments/:id",
  protect,
  authorize("admin"),
  getOnePayment
);

// PATCH /payments/:id
router.patch(
  "/payments/:id",
  protect,
  authorize("admin"),
  updatePayment
);

// DELETE /payments/:id
router.delete(
  "/payments/:id",
  protect,
  authorize("admin"),
  deletePayment
);

module.exports = router;