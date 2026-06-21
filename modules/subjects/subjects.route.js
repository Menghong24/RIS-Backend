const { Router } = require("express");
const { createSubject, getAllSubjects, getOneSubject, updateSubject, deleteSubject } = require("./subjects.controller");


const router = Router();

router.post('/subjects', createSubject);
router.get('/subjects', getAllSubjects);
router.get('/subjects/:id', getOneSubject);
router.patch('/subjects/:id', updateSubject);
router.delete('/subjects/:id', deleteSubject);

module.exports = router;