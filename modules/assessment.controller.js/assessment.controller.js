const Assessment = require("./assessment.model");

// CREATE
exports.createAssessment = async (req, res) => {
  try {
    const data = await Assessment.create(req.body);
    res.status(201).send(data);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

// GET ALL
exports.getAssessments = async (req, res) => {
  try {
    const data = await Assessment.find()
      .populate("classId")
      .populate("subjectId");

    res.send(data);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};