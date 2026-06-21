
// const StudentModel = require('../models/students.model'); // Implicitly used via populate

const ClassesModel = require("../classes/classes.model");
const attendanceModel = require("./attendance.model");

// --- GET ATTENDANCE (Smart Fetch) ---
// Returns existing record OR generates a blank template if none exists
exports.getAttendance = async (req, res) => {
  try {
    const { classId, date } = req.query;

    if (!classId || !date) {
      return res.status(400).send({ error: "Class ID and Date are required." });
    }

    // 1. Try to find existing attendance record
    // We normalize date to start of day to avoid time mismatches if you store times
    const queryDate = new Date(date);
    const startOfDay = new Date(queryDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(queryDate.setHours(23, 59, 59, 999));

    let attendance = await attendanceModel.findOne({
      class: classId,
      date: { $gte: startOfDay, $lte: endOfDay }
    }).populate('records.student', 'khmerName englishName studentId gender photo');

    // 2. If FOUND, return it
    if (attendance) {
      return res.send({ mode: 'edit', data: attendance });
    }

    // 3. If NOT FOUND, generate a blank template from Class Roster
    const classData = await ClassesModel.findById(classId).populate('students', 'khmerName englishName studentId gender photo');
    
    if (!classData) {
      return res.status(404).send({ error: "Class not found." });
    }

    // Create a temporary structure (not saved to DB yet)
    const blankRecords = classData.students.map(student => ({
      student: student, // Full object for frontend display
      status: 'absent', // Default status
      remark: ''
    }));

    return res.send({
      mode: 'create',
      data: {
        class: classId,
        date: date,
        records: blankRecords
      }
    });

  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

// --- SAVE ATTENDANCE (Upsert) ---
exports.saveAttendance = async (req, res) => {
  try {
    const { class: classId, date, records } = req.body;

    // Normalize date to ensure uniqueness per day
    const queryDate = new Date(date);
    const startOfDay = new Date(queryDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(queryDate.setHours(23, 59, 59, 999));

    // Check if record exists to update, or create new
    // We use findOneAndUpdate with upsert: true
    const updatedAttendance = await attendanceModel.findOneAndUpdate(
      {
        class: classId,
        date: { $gte: startOfDay, $lte: endOfDay }
      },
      {
        class: classId,
        date: date, // Keep original time or normalize if preferred
        records: records.map(r => ({
          student: r.student._id || r.student, // Handle if frontend sends full object or just ID
          status: r.status,
          remark: r.remark
        }))
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(200).send(updatedAttendance);

  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};