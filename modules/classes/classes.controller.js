const mongoose = require("mongoose");
const StudentModel = require("../students/students.model");
const ClassesModel = require("./classes.model");

const getUserTeacherId = (req) => {
  return String(req.user?.teacher?._id || req.user?.teacher || "").trim();
};

const isTeacher = (req) => {
  return String(req.user?.role || "").toLowerCase() === "teacher";
};

const getId = (value) => {
  return String(value?._id || value || "").trim();
};

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(getId(id));
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

const normalizeStudentIds = ({ studentId, studentIds } = {}) => {
  if (Array.isArray(studentIds) && studentIds.length > 0) {
    return studentIds
      .map((id) => getId(id))
      .filter(Boolean);
  }

  if (studentId) {
    return [getId(studentId)];
  }

  return [];
};

const uniqueObjectIds = (ids = []) => {
  return [...new Set(ids.map(getId).filter(isValidObjectId))];
};

const populateClass = (query) => {
  return query.populate("students").populate("teacher");
};

const getStudentClassIds = (student) => {
  return uniqueObjectIds([
    student?.grade,
    student?.class,
    student?.classId,
    ...(Array.isArray(student?.classes) ? student.classes : []),
    ...(Array.isArray(student?.classIds) ? student.classIds : [])
  ]);
};

const removeStudentsFromClasses = async (studentIds = [], classIds = []) => {
  const cleanStudentIds = uniqueObjectIds(studentIds);
  const cleanClassIds = uniqueObjectIds(classIds);

  if (cleanStudentIds.length === 0 || cleanClassIds.length === 0) {
    return;
  }

  await ClassesModel.updateMany(
    {
      _id: {
        $in: cleanClassIds
      }
    },
    {
      $pull: {
        students: {
          $in: cleanStudentIds
        }
      }
    }
  );
};

const syncStudentsToClass = async (studentIds = [], classId) => {
  const cleanStudentIds = uniqueObjectIds(studentIds);

  if (cleanStudentIds.length === 0 || !isValidObjectId(classId)) {
    return;
  }

  await StudentModel.updateMany(
    {
      _id: {
        $in: cleanStudentIds
      }
    },
    {
      $set: {
        grade: classId,
        class: classId,
        classId: classId
      },
      $addToSet: {
        classes: classId,
        classIds: classId
      }
    }
  );
};

const unsyncStudentsFromClass = async (studentIds = [], classId) => {
  const cleanStudentIds = uniqueObjectIds(studentIds);

  if (cleanStudentIds.length === 0 || !isValidObjectId(classId)) {
    return;
  }

  await StudentModel.updateMany(
    {
      _id: {
        $in: cleanStudentIds
      },
      $or: [
        { grade: classId },
        { class: classId },
        { classId: classId },
        { classes: classId },
        { classIds: classId }
      ]
    },
    {
      $unset: {
        grade: "",
        class: "",
        classId: ""
      },
      $pull: {
        classes: classId,
        classIds: classId
      }
    }
  );
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

    const existingClass = await ClassesModel.findById(id).select("students");

    if (!existingClass) {
      return res.status(404).send({
        err: "Class not found"
      });
    }

    const oldStudentIds = Array.isArray(existingClass.students)
      ? existingClass.students.map(getId)
      : [];

    const result = await ClassesModel.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true
    })
      .populate("students")
      .populate("teacher");

    const newStudentIds = Array.isArray(result.students)
      ? result.students.map(getId)
      : [];

    const removedStudentIds = oldStudentIds.filter((studentId) => {
      return !newStudentIds.includes(studentId);
    });

    const addedStudentIds = newStudentIds.filter((studentId) => {
      return !oldStudentIds.includes(studentId);
    });

    if (removedStudentIds.length > 0) {
      await unsyncStudentsFromClass(removedStudentIds, id);
    }

    if (addedStudentIds.length > 0) {
      const addedStudents = await StudentModel.find({
        _id: {
          $in: addedStudentIds
        }
      }).select("grade class classId classes classIds");

      const oldClassIds = uniqueObjectIds(
        addedStudents.flatMap((student) => getStudentClassIds(student))
      ).filter((oldClassId) => oldClassId !== getId(id));

      await removeStudentsFromClasses(addedStudentIds, oldClassIds);
      await syncStudentsToClass(addedStudentIds, id);
    }

    const populated = await populateClass(ClassesModel.findById(id));

    return res.send(populated);
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

    const studentIds = Array.isArray(result.students)
      ? result.students.map(getId)
      : [];

    await StudentModel.updateMany(
      {
        $or: [
          { grade: id },
          { class: id },
          { classId: id },
          { classes: id },
          { classIds: id },
          {
            _id: {
              $in: studentIds
            }
          }
        ]
      },
      {
        $unset: {
          grade: "",
          class: "",
          classId: ""
        },
        $pull: {
          classes: id,
          classIds: id
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
    }).select("grade class classId classes classIds");

    if (students.length !== idsProcess.length) {
      return res.status(404).send({
        err: "មានសិស្សខ្លះរកមិនឃើញ"
      });
    }

    const oldClassIds = uniqueObjectIds(
      students.flatMap((student) => getStudentClassIds(student))
    ).filter((oldClassId) => oldClassId !== getId(classId));

    if (oldClassIds.length > 0) {
      await removeStudentsFromClasses(idsProcess, oldClassIds);
    }

    await ClassesModel.findByIdAndUpdate(
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
    );

    await syncStudentsToClass(idsProcess, classId);

    const updatedClass = await ClassesModel.findById(classId)
      .populate("students")
      .populate("teacher");

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

    await unsyncStudentsFromClass([studentId], classId);

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