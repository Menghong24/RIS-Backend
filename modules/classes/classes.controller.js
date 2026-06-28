const mongoose = require("mongoose");
const StudentModel = require("../students/students.model");
const ClassesModel = require("./classes.model");

const getUserTeacherId = (req) => {
  return String(req.user?.teacher?._id || req.user?.teacher || "").trim();
};

const isTeacher = (req) => {
  return req.user?.role === "teacher";
};

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(String(id || ""));
};

const buildClassSearchQuery = (search) => {
  const keyword = String(search || "").trim();

  if (!keyword) return {};

  const searchRegex = {
    $regex: keyword,
    $options: "i"
  };

  return {
    $or: [
      { className: searchRegex },
      { classGrade: searchRegex },
      { typeOfClass: searchRegex },
      { yearOnStudy: searchRegex },
      { timeStudy: searchRegex }
    ]
  };
};

const normalizeStudentIds = ({ studentId, studentIds }) => {
  if (Array.isArray(studentIds) && studentIds.length > 0) {
    return studentIds.map((id) => String(id).trim()).filter(Boolean);
  }

  if (studentId) {
    return [String(studentId).trim()];
  }

  return [];
};

const populateClass = (query) => {
  return query
    .populate("students")
    .populate("teacher");
};

// --- CREATE ---
// Permission: route should use protect + authorize("admin")
exports.createClass = async (req, res) => {
  try {
    const result = await ClassesModel.create(req.body);

    const populated = await populateClass(
      ClassesModel.findById(result._id)
    );

    return res.status(201).send(populated);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).send({
        err: "ថ្នាក់នេះមានរួចហើយ សូមពិនិត្យ classNumber / yearOnStudy / timeStudy"
      });
    }

    return res.status(400).send({
      err: err.message
    });
  }
};

// --- READ ALL ---
// Permission: route should use protect + authorize(["admin", "teacher"])
exports.findAllClass = async (req, res) => {
  try {
    const query = {
      ...buildClassSearchQuery(req.query.search)
    };

    // Teacher មើលបានតែថ្នាក់របស់ខ្លួន
    if (isTeacher(req)) {
      const teacherId = getUserTeacherId(req);

      if (!teacherId) {
        return res.status(403).send({
          err: "គណនីគ្រូនេះមិនទាន់ភ្ជាប់ទៅ Teacher profile ទេ"
        });
      }

      query.teacher = teacherId;
    }

    if (req.query.status) {
      query.status = req.query.status;
    }

    if (req.query.yearOnStudy) {
      query.yearOnStudy = req.query.yearOnStudy;
    }

    if (req.query.timeStudy) {
      query.timeStudy = req.query.timeStudy;
    }

    const result = await ClassesModel.find(query)
      .populate("students")
      .populate("teacher")
      .sort({
        createdAt: -1
      });

    return res.send(result);
  } catch (err) {
    return res.status(500).send({
      err: err.message
    });
  }
};

// --- READ ONE ---
// Permission: route should use protect + authorize(["admin", "teacher"]) + canAccessClass
exports.getOneClass = async (req, res) => {
  try {
    const id = req.params.id;

    if (!isValidObjectId(id)) {
      return res.status(400).send({
        err: "Class ID មិនត្រឹមត្រូវ"
      });
    }

    const result = await ClassesModel.findById(id)
      .populate("students")
      .populate("teacher");

    if (!result) {
      return res.status(404).send({
        err: "Class not found"
      });
    }

    return res.send(result);
  } catch (err) {
    return res.status(500).send({
      err: err.message
    });
  }
};

// --- UPDATE CLASS DETAILS ---
// Permission: route should use protect + authorize("admin")
exports.updateClass = async (req, res) => {
  try {
    const id = req.params.id;

    if (!isValidObjectId(id)) {
      return res.status(400).send({
        err: "Class ID មិនត្រឹមត្រូវ"
      });
    }

    const result = await ClassesModel.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true
    })
      .populate("students")
      .populate("teacher");

    if (!result) {
      return res.status(404).send({
        err: "Class not found"
      });
    }

    return res.send(result);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).send({
        err: "ថ្នាក់នេះមានរួចហើយ សូមពិនិត្យ classNumber / yearOnStudy / timeStudy"
      });
    }

    return res.status(500).send({
      err: err.message
    });
  }
};

// --- DELETE CLASS ---
// Permission: route should use protect + authorize("admin")
exports.deleteClass = async (req, res) => {
  try {
    const id = req.params.id;

    if (!isValidObjectId(id)) {
      return res.status(400).send({
        err: "Class ID មិនត្រឹមត្រូវ"
      });
    }

    const result = await ClassesModel.findByIdAndDelete(id);

    if (!result) {
      return res.status(404).send({
        err: "Class not found"
      });
    }

    await StudentModel.updateMany(
      {
        grade: id
      },
      {
        $unset: {
          grade: ""
        }
      }
    );

    return res.send({
      msg: "Class deleted and students updated.",
      result
    });
  } catch (err) {
    return res.status(500).send({
      err: err.message
    });
  }
};

// --- ENROLL STUDENT ---
// Route: POST /classes/:id/enroll
// Body: { studentId: "..." } or { studentIds: [...] }
// Permission: route should use protect + authorize("admin")
exports.enrollStudent = async (req, res) => {
  try {
    const classId = req.params.id;
    const idsProcess = normalizeStudentIds(req.body);

    if (!isValidObjectId(classId)) {
      return res.status(400).send({
        err: "Class ID មិនត្រឹមត្រូវ"
      });
    }

    if (idsProcess.length === 0) {
      return res.status(400).send({
        err: "សូមផ្ញើ studentId ឬ studentIds"
      });
    }

    const invalidStudentId = idsProcess.find((id) => !isValidObjectId(id));

    if (invalidStudentId) {
      return res.status(400).send({
        err: "Student ID មិនត្រឹមត្រូវ"
      });
    }

    const targetClass = await ClassesModel.findById(classId);

    if (!targetClass) {
      return res.status(404).send({
        err: "Class not found"
      });
    }

    const students = await StudentModel.find({
      _id: {
        $in: idsProcess
      }
    }).select("_id grade");

    if (students.length !== idsProcess.length) {
      return res.status(404).send({
        err: "មានសិស្សខ្លះរកមិនឃើញ"
      });
    }

    // Remove students from old classes
    const oldClassIds = students
      .map((student) => student.grade)
      .filter((oldClassId) => oldClassId && String(oldClassId) !== String(classId));

    if (oldClassIds.length > 0) {
      await ClassesModel.updateMany(
        {
          _id: {
            $in: oldClassIds
          }
        },
        {
          $pull: {
            students: {
              $in: idsProcess
            }
          }
        }
      );
    }

    const updatedClass = await ClassesModel.findByIdAndUpdate(
      classId,
      {
        $addToSet: {
          students: {
            $each: idsProcess
          }
        }
      },
      {
        new: true,
        runValidators: true
      }
    )
      .populate("students")
      .populate("teacher");

    await StudentModel.updateMany(
      {
        _id: {
          $in: idsProcess
        }
      },
      {
        $set: {
          grade: classId
        }
      }
    );

    return res.status(200).send({
      msg: "Students enrolled successfully.",
      result: updatedClass
    });
  } catch (err) {
    return res.status(500).send({
      err: err.message
    });
  }
};

// --- REMOVE STUDENT ---
// Route: DELETE /classes/:id/students/:studentId
// Permission: route should use protect + authorize("admin")
exports.removeStudentFromClass = async (req, res) => {
  try {
    const classId = req.params.id;
    const studentId = req.params.studentId || req.body.studentId;

    if (!isValidObjectId(classId)) {
      return res.status(400).send({
        err: "Class ID មិនត្រឹមត្រូវ"
      });
    }

    if (!isValidObjectId(studentId)) {
      return res.status(400).send({
        err: "Student ID មិនត្រឹមត្រូវ"
      });
    }

    const updatedClass = await ClassesModel.findByIdAndUpdate(
      classId,
      {
        $pull: {
          students: studentId
        }
      },
      {
        new: true,
        runValidators: true
      }
    )
      .populate("students")
      .populate("teacher");

    if (!updatedClass) {
      return res.status(404).send({
        err: "Class not found"
      });
    }

    await StudentModel.findByIdAndUpdate(studentId, {
      $unset: {
        grade: ""
      }
    });

    return res.status(200).send({
      msg: "Student removed from class.",
      result: updatedClass
    });
  } catch (err) {
    return res.status(500).send({
      err: err.message
    });
  }
};