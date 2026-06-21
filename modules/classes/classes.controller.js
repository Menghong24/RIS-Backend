const StudentModel = require("../students/students.model");
const ClassesModel = require("./classes.model");

// --- CREATE ---
exports.createClass = async (req, res) => {
  try {
    const result = await ClassesModel.create(req.body);
    res.status(201).send(result);
  } catch (err) {
    res.status(400).send({ error: err.message });
  }
};

// --- READ ALL ---
exports.findAllClass = async (req, res) => {
  try {
    let query = {};
    
    // Search by Class Name
    if (req.query.search) {
      query.className = { $regex: req.query.search, $options: "i" };
    }

    const result = await ClassesModel.find(query)
      .populate("students") // Populates the 'students' array
      .populate("teacher")  // Populates the 'teacher' field
      .sort({ createdAt: -1 }); // Newest first

    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

// --- READ ONE ---
exports.getOneClass = async (req, res) => {
  try {
    const id = req.params.id;
    const result = await ClassesModel.findById(id)
      .populate("students")
      .populate("teacher");

    if (!result) {
      return res.status(404).send({ error: "Class not found" });
    }
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

// --- UPDATE CLASS DETAILS ---
exports.updateClass = async (req, res) => {
  try {
    const id = req.params.id;
    
    const result = await ClassesModel.findByIdAndUpdate(id, req.body, {
      new: true, // Return the updated document
      runValidators: true // Ensure enum/required rules are followed
    })
      .populate("students")
      .populate("teacher");

    if (!result) {
      return res.status(404).send({ error: "Class not found" });
    }
    
    res.send(result);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

// --- DELETE CLASS ---
exports.deleteClass = async (req, res) => {
  try {
    const id = req.params.id;
    const result = await ClassesModel.findByIdAndDelete(id);

    if (!result) {
      return res.status(404).send({ error: "Class not found" });
    }

    // CLEANUP: If a class is deleted, find all students in that class 
    // and remove the class reference (set grade to null or empty string)
    await StudentModel.updateMany(
      { grade: id }, 
      { $unset: { grade: "" } }
    );

    res.send({ message: "Class deleted and students updated.", result });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

// --- ENROLL STUDENT (Specific Route) ---
// Route expectation: POST /classes/:id/enroll
// Body expectation: { studentId: "..." }
// classes.controller.js

exports.enrollStudent = async (req, res) => {
  try {
    const classId = req.params.id;
    // Accept either a single ID or an Array of IDs
    const { studentId, studentIds } = req.body;

    if (!classId) return res.status(400).send({ error: "Class ID required" });

    // Normalize to an array
    let idsProcess = [];
    if (studentIds && Array.isArray(studentIds)) {
      idsProcess = studentIds;
    } else if (studentId) {
      idsProcess = [studentId];
    } else {
      return res.status(400).send({ error: "No student IDs provided." });
    }

    // 1. Remove students from their OLD classes (Bulk operation)
    // Find all students in the list who already have a grade
    const studentsWithOldClass = await StudentModel.find({ 
      _id: { $in: idsProcess },
      grade: { $exists: true, $ne: null }
    });

    // Group them by old class ID to minimize DB calls
    // (Simple approach: just pull them all from any old class)
    for (const student of studentsWithOldClass) {
        if (student.grade.toString() !== classId) {
            await ClassesModel.findByIdAndUpdate(student.grade, {
                $pull: { students: student._id }
            });
        }
    }

    // 2. Add ALL IDs to the NEW Class (using $each)
    const updatedClass = await ClassesModel.findByIdAndUpdate(
      classId,
      { $addToSet: { students: { $each: idsProcess } } },
      { new: true }
    );

    // 3. Update ALL Student Documents to point to new Class
    await StudentModel.updateMany(
      { _id: { $in: idsProcess } },
      { $set: { grade: classId } }
    );

    res.status(200).send({
      message: "Students processed successfully.",
      data: updatedClass,
    });

  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

// --- REMOVE STUDENT (Unenroll) ---
// Route expectation: DELETE /classes/:id/students/:studentId
exports.removeStudentFromClass = async (req, res) => {
    try {
        const classId = req.params.id; // Class ID from URL
        const studentId = req.params.studentId || req.body.studentId; 

        // 1. Remove Student ID from Class array
        const updatedClass = await ClassesModel.findByIdAndUpdate(
            classId, 
            { $pull: { students: studentId } },
            { new: true }
        ).populate("students");

        // 2. Remove Class ID from Student 'grade' field
        await StudentModel.findByIdAndUpdate(studentId, {
            $unset: { grade: "" }
        });

        res.status(200).send({ 
            message: "Student removed from class.", 
            data: updatedClass 
        });
    } catch (err) {
        res.status(500).send({ error: err.message });
    }
}