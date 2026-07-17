const subjectsModel = require("./subjects.model");

const normalizeClassIds = (body = {}) => {
  const payload = { ...body };

  let classIds = [];

  if (Array.isArray(payload.classIds)) {
    classIds = payload.classIds;
  } else if (Array.isArray(payload.classes)) {
    classIds = payload.classes;
  } else if (payload.classId) {
    classIds = [payload.classId];
  } else if (payload.class) {
    classIds = [payload.class];
  }

  classIds = classIds
    .map((id) => String(id || "").trim())
    .filter(Boolean);

  payload.classIds = classIds;
  payload.classId = classIds[0] || null;

  delete payload.classes;
  delete payload.class;

  return payload;
};

const populateSubject = (query) => {
  return query
    .populate("teacher", "khmerName englishName")
    .populate("classIds", "className classGrade")
    .populate("classId", "className classGrade");
};

exports.createSubject = async (req, res) => {
  try {
    const payload = normalizeClassIds(req.body);

    const subject = await subjectsModel.create(payload);

    await subject.populate([
      {
        path: "teacher",
        select: "khmerName englishName"
      },
      {
        path: "classIds",
        select: "className classGrade"
      },
      {
        path: "classId",
        select: "className classGrade"
      }
    ]);

    return res.status(201).send(subject);
  } catch (err) {
    return res.status(400).send({
      err: err.message || "Cannot create subject"
    });
  }
};

exports.getAllSubjects = async (req, res) => {
  try {
    const query = {};

    if (req.query.type && req.query.type !== "All") {
      query.type = req.query.type;
    }

    if (req.query.classId && req.query.classId !== "All") {
      query.$or = [
        { classIds: req.query.classId },
        { classId: req.query.classId }
      ];
    }

    if (req.query.class && req.query.class !== "All") {
      query.$or = [
        { classIds: req.query.class },
        { classId: req.query.class }
      ];
    }

    const subjects = await populateSubject(
      subjectsModel.find(query).sort({ createdAt: -1 })
    );

    return res.send(subjects);
  } catch (err) {
    return res.status(500).send({
      err: err.message || "Cannot get subjects"
    });
  }
};

exports.getOneSubject = async (req, res) => {
  try {
    const subject = await populateSubject(
      subjectsModel.findById(req.params.id)
    );

    if (!subject) {
      return res.status(404).send({
        err: "Subject not found"
      });
    }

    return res.send(subject);
  } catch (err) {
    return res.status(500).send({
      err: err.message || "Cannot get subject"
    });
  }
};

exports.updateSubject = async (req, res) => {
  try {
    const payload = normalizeClassIds(req.body);

    const subject = await populateSubject(
      subjectsModel.findByIdAndUpdate(req.params.id, payload, {
        new: true,
        runValidators: true
      })
    );

    if (!subject) {
      return res.status(404).send({
        err: "Subject not found"
      });
    }

    return res.send(subject);
  } catch (err) {
    return res.status(400).send({
      err: err.message || "Cannot update subject"
    });
  }
};

exports.deleteSubject = async (req, res) => {
  try {
    const subject = await subjectsModel.findByIdAndDelete(req.params.id);

    if (!subject) {
      return res.status(404).send({
        err: "Subject not found"
      });
    }

    return res.send(subject);
  } catch (err) {
    return res.status(500).send({
      err: err.message || "Cannot delete subject"
    });
  }
};