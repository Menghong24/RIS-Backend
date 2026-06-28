const mongoose = require("mongoose");
const TeacherModel = require("./teachers.model");
const { removeLocalFile } = require("../shared/removeLocalFile");

const getUploadedTeacherImagePath = (req) => {
  if (!req.file?.filename) return "";

  return `/uploads/teachers/${req.file.filename}`;
};

const removeUploadedFileIfExists = (req) => {
  const uploadedImagePath = getUploadedTeacherImagePath(req);

  if (uploadedImagePath) {
    removeLocalFile(uploadedImagePath);
  }
};

const normalizeTeacherPayload = (body = {}) => {
  const payload = { ...body };

  return payload;
};

// --- CREATE ---
exports.createTeacher = async (req, res) => {
  try {
    const payload = normalizeTeacherPayload(req.body);
    const uploadedImagePath = getUploadedTeacherImagePath(req);

    if (uploadedImagePath) {
      payload.profileImage = uploadedImagePath;
    }

    const result = await TeacherModel.create(payload);

    return res.status(201).send(result);
  } catch (err) {
    removeUploadedFileIfExists(req);

    return res.status(400).send({
      err: err.message
    });
  }
};

// --- READ ALL (With Search) ---
exports.getAllTeacher = async (req, res) => {
  try {
    let query = {};
    const search = String(req.query.search || "").trim();

    if (search) {
      const searchRegex = {
        $regex: search,
        $options: "i"
      };

      query = {
        $or: [
          { khmerName: searchRegex },
          { englishName: searchRegex },
          { skill: searchRegex },
          { phone: searchRegex },
          { email: searchRegex }
        ]
      };
    }

    const result = await TeacherModel.find(query).sort({
      createdAt: -1
    });

    return res.send(result);
  } catch (err) {
    return res.status(500).send({
      err: err.message || "Internal server error"
    });
  }
};

// --- READ ONE ---
exports.getOneTeacher = async (req, res) => {
  try {
    const id = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(String(id || ""))) {
      return res.status(400).send({
        err: "Teacher ID មិនត្រឹមត្រូវ"
      });
    }

    const result = await TeacherModel.findById(id);

    if (!result) {
      return res.status(404).send({
        err: "Teacher not found"
      });
    }

    return res.send(result);
  } catch (err) {
    return res.status(500).send({
      err: err.message || "Internal server error"
    });
  }
};

// --- UPDATE ---
exports.updateTeacher = async (req, res) => {
  try {
    const id = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(String(id || ""))) {
      removeUploadedFileIfExists(req);

      return res.status(400).send({
        err: "Teacher ID មិនត្រឹមត្រូវ"
      });
    }

    const existingTeacher = await TeacherModel.findById(id);

    if (!existingTeacher) {
      removeUploadedFileIfExists(req);

      return res.status(404).send({
        err: "Teacher not found"
      });
    }

    const payload = normalizeTeacherPayload(req.body);
    const uploadedImagePath = getUploadedTeacherImagePath(req);

    if (uploadedImagePath) {
      if (existingTeacher.profileImage) {
        removeLocalFile(existingTeacher.profileImage);
      }

      payload.profileImage = uploadedImagePath;
    }

    const result = await TeacherModel.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true
    });

    return res.send(result);
  } catch (err) {
    removeUploadedFileIfExists(req);

    return res.status(500).send({
      err: err.message || "Internal server error"
    });
  }
};

// --- DELETE ---
exports.deleteTeacher = async (req, res) => {
  try {
    const id = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(String(id || ""))) {
      return res.status(400).send({
        err: "Teacher ID មិនត្រឹមត្រូវ"
      });
    }

    const result = await TeacherModel.findByIdAndDelete(id);

    if (!result) {
      return res.status(404).send({
        err: "Teacher not found"
      });
    }

    if (result.profileImage) {
      removeLocalFile(result.profileImage);
    }

    return res.send({
      msg: "Teacher deleted successfully",
      result
    });
  } catch (err) {
    return res.status(500).send({
      err: err.message || "Internal server error"
    });
  }
};