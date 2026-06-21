const announcementsModel = require("./announcements.model");

// --- CREATE ---
exports.createAnnouncement = async (req, res) => {
  try {
    const announcement = await announcementsModel.create(req.body);
    res.status(201).send(announcement);
  } catch (err) {
    res.status(400).send({ error: err.message });
  }
};

// --- GET ALL (With Filters) ---
exports.getAllAnnouncements = async (req, res) => {
  try {
    let query = {};

    // Filter by Type (all vs class)
    if (req.query.type) {
      query.targetType = req.query.type;
    }

    // Filter by Class ID
    if (req.query.classId) {
      query.targetClass = req.query.classId;
    }

    // Filter by Status
    if (req.query.status) {
      query.status = req.query.status;
    }

    const list = await announcementsModel.find(query)
      .populate('targetClass', 'className classGrade')
      .populate('postedBy', 'englishName khmerName')
      .sort({ createdAt: -1 }); // Newest first

    res.send(list);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

// --- GET ONE ---
exports.getOneAnnouncement = async (req, res) => {
  try {
    const item = await announcementsModel.findById(req.params.id)
      .populate('targetClass')
      .populate('postedBy');
    if (!item) return res.status(404).send({ error: "Not found" });
    res.send(item);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

// --- UPDATE ---
exports.updateAnnouncement = async (req, res) => {
  try {
    const item = await announcementsModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) return res.status(404).send({ error: "Not found" });
    res.send(item);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

// --- DELETE ---
exports.deleteAnnouncement = async (req, res) => {
  try {
    const item = await announcementsModel.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).send({ error: "Not found" });
    res.send({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};