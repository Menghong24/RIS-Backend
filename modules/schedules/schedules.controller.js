const schedulesModel = require("./schedules.model");


// --- CREATE ---
exports.createSchedule = async (req, res) => {
  try {
    const schedule = await schedulesModel.create(req.body);
    const populated = await schedule.populate([
      { path: 'class', select: 'className' },
      { path: 'subject', select: 'subjectName' },
      { path: 'teacher', select: 'englishName khmerName' }
    ]);
    res.status(201).send(populated);
  } catch (err) {
    res.status(400).send({ error: err.message });
  }
};

// --- GET ALL (Filtered) ---
exports.getAllSchedules = async (req, res) => {
  try {
    let query = {};

    // Filter by Class (Important for viewing a specific timetable)
    if (req.query.classId && req.query.classId !== 'All') {
      query.class = req.query.classId;
    }

    // Filter by Day
    if (req.query.day && req.query.day !== 'All') {
      query.day = req.query.day;
    }

    const schedules = await schedulesModel.find(query)
      .populate('class', 'className classGrade')
      .populate('subject', 'subjectName type')
      .populate('teacher', 'englishName khmerName')
      .sort({ startTime: 1 }); // Sort by time (07:00 before 08:00)

    res.send(schedules);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

// --- UPDATE ---
exports.updateSchedule = async (req, res) => {
  try {
    const schedule = await schedulesModel.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('class', 'className')
      .populate('subject', 'subjectName')
      .populate('teacher', 'englishName khmerName');

    if (!schedule) return res.status(404).send({ error: "Schedule not found" });
    res.send(schedule);
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

// --- DELETE ---
exports.deleteSchedule = async (req, res) => {
  try {
    const schedule = await schedulesModel.findByIdAndDelete(req.params.id);
    if (!schedule) return res.status(404).send({ error: "Schedule not found" });
    res.send({ message: "Schedule deleted" });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};