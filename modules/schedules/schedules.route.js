const { Router } = require("express");
const { createSchedule, getAllSchedules, updateSchedule, deleteSchedule } = require("./schedules.controller");
const { protect } = require("../shared/protect");
const { authorize } = require("../shared/authorize");


const router = Router();

router.post('/schedules', protect, authorize(["admin"]), createSchedule);
router.get('/schedules',  protect, authorize(["admin","teacher"]), getAllSchedules); // ?classId=...&day=...
router.patch('/schedules/:id',  protect, authorize(["admin"]), updateSchedule);
router.delete('/schedules/:id',  protect, authorize(["admin",]), deleteSchedule);

module.exports = router;