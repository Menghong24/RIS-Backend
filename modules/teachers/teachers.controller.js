const TeacherModel = require("./teachers.model");


// --- CREATE ---
exports.createTeacher = async (req, res) => {
  try {
    const result = await TeacherModel.create(req.body);
    res.status(201).send(result);
  } catch (err) {
    res.status(400).send({ error: err.message });
  }
};

// --- READ ALL (With Search) ---
exports.getAllTeacher = async (req, res) => {
  try {
    let query = {};
    
    // FIX: Search across Khmer Name, English Name, and Skill
    if (req.query.search) {
      const searchRegex = { $regex: req.query.search, $options: "i" };
      query = {
        $or: [
          { khmerName: searchRegex },
          { englishName: searchRegex },
          { skill: searchRegex }
        ]
      };
    }

    const result = await TeacherModel.find(query).sort({ createdAt: -1 }); // Newest first
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

// --- READ ONE ---
exports.getOneTeacher = async (req, res) => {
  try {
    const id = req.params.id;
    const result = await TeacherModel.findById(id);
    if (!result) {
      return res.status(404).send({ error: "Teacher not found" });
    }
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

// --- UPDATE ---
exports.updateTeacher = async (req, res) => {
  try {
    const id = req.params.id;
    const result = await TeacherModel.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    if (!result) {
      return res.status(404).send({ error: "Teacher not found" });
    }
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

// --- DELETE ---
exports.deleteTeacher = async (req, res) => {
  try {
    const id = req.params.id;
    const result = await TeacherModel.findByIdAndDelete(id);
    if (!result) {
      return res.status(404).send({ error: "Teacher not found" });
    }
    res.send({ message: "Teacher deleted successfully", deletedTeacher: result });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};