const router = require("express").Router();
const controller = require("./assessment.controller");

router.post("/assessment", controller.createAssessment);
router.get("/assessment", controller.getAssessments);

module.exports = router;