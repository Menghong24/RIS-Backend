const StudentModel = require('./students.model');

exports.createStudent = async (req, res) => {
  try {
    // Ensure the frontend sends 'dob' matching the model, or map it here if needed
    const result = await StudentModel.create(req.body);
    res.status(201).send(result);
  } catch (err) {
    res.status(400).send({ error: err.message });
  }
};

exports.findAllStudent = async (req, res) => {
  try {
    let query = {};
    
    // FIX: Search across Khmer Name, English Name, AND Student ID
    if (req.query.search) {
      const searchRegex = { $regex: req.query.search, $options: "i" };
      query = {
        $or: [
          { khmerName: searchRegex },
          { englishName: searchRegex },
          { studentId: searchRegex }
        ]
      };
    }

    // UPDATED: Added .populate('grade') to get Class info
    // UPDATED: Added .sort() to show newest first
    const result = await StudentModel.find(query)
      .populate('grade', 'className classGrade timeStudy') // Only fetch needed fields
      .sort({ createdAt: -1 });

    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

exports.getOneStudent = async (req, res) => {
  try {
    const id = req.params.id;
    const result = await StudentModel.findById(id).populate('grade');
    if (!result) {
      return res.status(404).send({ error: "Student not found" });
    }
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

exports.updateStudent = async (req, res) => {
  try {
    const id = req.params.id;
    const result = await StudentModel.findByIdAndUpdate(id, req.body, { new: true });
    if (!result) {
      return res.status(404).send({ error: "Student not found" });
    }
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

exports.deleteStudent = async (req, res) => {
  try {
    const id = req.params.id;
    const result = await StudentModel.findByIdAndDelete(id);
    if (!result) {
      return res.status(404).send({ error: "Student not found" });
    }
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};