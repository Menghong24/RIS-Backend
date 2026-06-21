const { Router } = require("express");
const { 
  createClass, 
  findAllClass, 
  getOneClass, 
  updateClass, 
  deleteClass, 
  enrollStudent,         // Updated name
  removeStudentFromClass // Added for un-enrollment
} = require("./classes.controller");
const { authorize } = require("../shared/authorize");
const { protect } = require("../shared/protect");

const router = Router();

// --- Standard CRUD ---
router.post('/classes', protect, authorize(["admin"]), createClass);           // Create
router.get('/classes', protect, authorize(["admin","teacher"]), findAllClass);           // Read All
router.get('/classes/:id',  protect, authorize(["admin","teacher"]), getOneClass);        // Read One
router.patch('/classes/:id',  protect, authorize(["admin"]), updateClass);        // Update (changed PATCH to PUT for full updates)
router.delete('/classes/:id',  protect, authorize(["admin"]), deleteClass);     // Delete

// --- Enrollment Actions ---

// 1. Enroll Student
// Matches Frontend: api.post(`/classes/${classId}/enroll`, { studentId })
router.post('/classes/:id/enroll', enrollStudent); 

// 2. Remove Student (Optional but recommended)
// Matches Frontend: api.delete(`/classes/${classId}/students/${studentId}`)
router.delete('/classes/:id/students/:studentId', removeStudentFromClass); 

module.exports = router;