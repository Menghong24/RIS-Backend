
// const TeacherModel = require('../models/teacher.model'); // If validation needed

const subjectsModel = require("./subjects.model");

exports.createSubject = async (req, res) => {
  try {
    const subject = await subjectsModel.create(req.body);
    // Populate teacher immediately for the frontend
    await subject.populate('teacher', 'khmerName englishName');
    res.status(201).send(subject);
  } catch (err) {
    res.status(400).send({ error: err.message });
  }
};

exports.getAllSubjects = async (req, res) => {
  try {
    let query = {};
    
    // Filter by Grade Level
    if (req.query.grade && req.query.grade !== 'All') {
      query.gradeLevel = req.query.grade;
    }

    // Filter by Type
    if (req.query.type && req.query.type !== 'All') {
      query.type = req.query.type;
    }

    const subjects = await subjectsModel.find(query)
      .populate('teacher', 'khmerName englishName') // Populates teacher name
      .sort({ createdAt: -1 });

    res.send(subjects);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

exports.getOneSubject = async (req, res) => {
  try {
    const subject = await subjectsModel.findById(req.params.id).populate('teacher');
    if (!subject) return res.status(404).send({ error: "Subject not found" });
    res.send(subject);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

exports.updateSubject = async (req, res) => {
  try {
    const subject = await subjectsModel.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('teacher', 'khmerName englishName');
      
    if (!subject) return res.status(404).send({ error: "Subject not found" });
    res.send(subject);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

exports.deleteSubject = async (req, res) => {
  try {
    const subject = await subjectsModel.findByIdAndDelete(req.params.id);
    if (!subject) return res.status(404).send({ error: "Subject not found" });
    res.send(subject);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};