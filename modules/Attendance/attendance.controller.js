const ClassesModel = require("../classes/classes.model");
const AttendanceModel = require("./attendance.model");

// ==============================
// GET ATTENDANCE
// ==============================
exports.getAttendance = async (req, res) => {
  try {
    const { classId, date, session } = req.query;

    if (!classId || !date) {
      return res.status(400).json({
        success: false,
        message: "Class ID and Date are required.",
      });
    }

    // Normalize date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // ស្វែងរកតាមលក្ខខណ្ឌ Class, Date និង Session
    const attendance = await AttendanceModel.findOne({
      class: classId,
      date: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
      session: session || "morning", 
    }).populate(
      "records.student",
      "khmerName englishName studentId gender photo"
    );

    if (attendance) {
      return res.status(200).json({
        success: true,
        mode: "edit",
        data: attendance,
      });
    }

    // បើមិនទាន់មានទិន្នន័យ ទៅទាញយកបញ្ជីឈ្មោះសិស្សមកបង្កើតទម្រង់ទទេ
    const classData = await ClassesModel.findById(classId).populate(
      "students",
      "khmerName englishName studentId gender photo"
    );

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: "Class not found.",
      });
    }

    const studentsList = classData.students || [];

    const blankRecords = studentsList.map((student) => ({
      student,
      status: "present",
      remark: "",
    }));

    return res.status(200).json({
      success: true,
      mode: "create",
      data: {
        class: classId,
        date,
        session: session || "morning",
        records: blankRecords,
      },
    });
  } catch (err) {
    console.error("Attendance GET Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ==============================
// SAVE ATTENDANCE (Updated)
// ==============================
exports.saveAttendance = async (req, res) => {
  try {
    // ១. ចាប់យក session និង schoolYear បន្ថែមពី req.body
    const { class: classId, date, session, schoolYear, records } = req.body;

    if (!classId || !date) {
      return res.status(400).json({
        success: false,
        message: "Class and Date are required.",
      });
    }

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Attendance records are required.",
      });
    }

    // Prevent duplicate students
    const ids = records.map((r) =>
      (r.student._id || r.student).toString()
    );

    if (new Set(ids).size !== ids.length) {
      return res.status(400).json({
        success: false,
        message: "Duplicate student found.",
      });
    }

    // Normalize date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // ២. បង្កើតប្រព័ន្ធការពារ៖ បើគ្មាន schoolYear ផ្ញើមក វានឹងបង្កើតតាមឆ្នាំនៃកាលបរិច្ឆេទ (ការពារការគាំង Schema)
    const currentYear = startOfDay.getFullYear();
    const finalSchoolYear = schoolYear || `${currentYear}-${currentYear + 1}`;
    const finalSession = session || "morning";

    // ៣. រក្សាទុក ឬធ្វើបច្ចុប្បន្នភាព ដោយផ្អែកលើ Class, Date, និង Session
    const attendance = await AttendanceModel.findOneAndUpdate(
      {
        class: classId,
        date: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
        session: finalSession, // ត្រូវតែដាក់ក្នុងលក្ខខណ្ឌស្វែងរក ដាច់ខាត!
      },
      {
        class: classId,
        date: startOfDay,
        session: finalSession,
        schoolYear: finalSchoolYear, // បញ្ចូលទៅតាមលក្ខខណ្ឌតម្រូវរបស់ Schema
        records: records.map((record) => ({
          student: record.student._id || record.student,
          status: record.status || "present",
          remark: record.remark || "",
        })),
      },
      {
        new: true,
        upsert: true, // បើគ្មានទិន្នន័យចាស់ វានឹងបង្កើតទិន្នន័យថ្មី
        setDefaultsOnInsert: true,
      }
    );

    // Populate ទិន្នន័យសិស្សឡើងវិញ មុននឹងបោះទៅ Frontend
    const result = await AttendanceModel.findById(attendance._id).populate(
      "records.student",
      "khmerName englishName studentId gender photo"
    );

    return res.status(200).json({
      success: true,
      message: "Attendance saved successfully.",
      data: result,
    });
  } catch (err) {
    console.error("Attendance SAVE Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ==============================
// GET ATTENDANCE REPORT (ថ្នាក់, ខែ, ឆ្នាំ, សិស្ស)
// ==============================
exports.getAttendanceReport = async (req, res) => {
  try {
    const { classId, month, year, studentId } = req.query;

    if (!classId) {
      return res.status(400).json({ success: false, message: "Class ID is required." });
    }

    // ១. រៀបចំលក្ខខណ្ឌ Filter តាមកាលបរិច្ឆេទ (ខែ និង ឆ្នាំ)
    let dateQuery = {};
    if (year) {
      let start, end;
      if (month) {
        // Filter តាមខែ និងឆ្នាំជាក់លាក់
        start = new Date(year, month - 1, 1);
        end = new Date(year, month, 0, 23, 59, 59, 999);
      } else {
        // Filter ពេញមួយឆ្នាំ
        start = new Date(year, 0, 1);
        end = new Date(year, 11, 31, 23, 59, 59, 999);
      }
      dateQuery = { date: { $gte: start, $lte: end } };
    }

    // ២. ទាញយកទិន្នន័យវត្តមានពី Database
    const attendances = await AttendanceModel.find({
      class: classId,
      ...dateQuery
    }).populate("records.student");

    // ៣. ទាញយកបញ្ជីឈ្មោះសិស្សទាំងអស់ក្នុងថ្នាក់ ដើម្បីធានាថាសិស្សគ្រប់រូបមានឈ្មោះក្នុងរបាយការណ៍
    const classData = await ClassesModel.findById(classId).populate("students");
    if (!classData) {
      return res.status(404).json({ success: false, message: "Class not found." });
    }

    // ៤. បង្កើតរចនាសម្ព័ន្ធផ្ទុកទិន្នន័យគណនា (Aggregation Object)
    let reportMap = {};
    classData.students.forEach((student) => {
      reportMap[student._id] = {
        student: {
          _id: student._id,
          studentId: student.studentId,
          khmerName: student.khmerName,
          englishName: student.englishName,
          gender: student.gender,
          photo: student.photo
        },
        present: 0,
        absent: 0,
        permission: 0,
        late: 0,
        totalDays: 0
      };
    });

    // ៥. ចាប់ផ្តើមគណនារាប់ចំនួនសរុប
    attendances.forEach((sheet) => {
      sheet.records.forEach((record) => {
        const sId = record.student?._id || record.student;
        if (reportMap[sId]) {
          reportMap[sId].totalDays += 1;
          reportMap[sId][record.status] += 1;
        }
      });
    });

    // បំបែក Object មកជា Array វិញ
    let reportResult = Object.values(reportMap);

    // ៦. ប្រសិនបើមានការតម្រងតាម "សិស្សម្នាក់ៗ" (studentId)
    if (studentId) {
      reportResult = reportResult.filter(r => r.student._id.toString() === studentId.toString());
    }

    return res.status(200).json({
      success: true,
      data: reportResult,
      totalAttendanceSheets: attendances.length
    });

  } catch (err) {
    console.error("Report Error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};