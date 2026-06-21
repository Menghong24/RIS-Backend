const { Router } = require('express');
const { createStudent,findAllStudent,getOneStudent,updateStudent,deleteStudent } = require('./students.controller');
const { protect } = require('../shared/protect');
const { authorize } = require('../shared/authorize');
const router = Router()


router.post('/students', protect, authorize(["admin"]), createStudent)
router.get("/students", protect, authorize(["admin","teacher"]), findAllStudent )
router.get("/students/:id", protect, authorize(["admin","teacher"]), getOneStudent)
router.patch("/students/:id", protect, authorize(["admin"]), updateStudent)
router.delete("/students/:id", protect, authorize(["admin"]), deleteStudent)


module.exports = router;