const Score = require('../scores/scores.model'); // Adjust path to your models folder

// @desc    Get scores by class and other filters
// @route   GET /api/scores?classId=...&month=...
const getScoresByClass = async (req, res) => {
  try {
    const { classId, subjectId, academicYear, month, type } = req.query;
    
    // Build filter dynamically
    const filter = {};
    if (classId) filter.classId = classId;
    if (subjectId) filter.subjectId = subjectId;
    if (academicYear) filter.academicYear = academicYear;
    if (month) filter.month = month;
    if (type) filter.type = type;

    // .populate() can be added here if you want student names pulled directly from backend
    const scores = await Score.find(filter);
    
    res.status(200).json(scores);
  } catch (error) {
    console.error("Error fetching scores:", error);
    res.status(500).json({ message: "Failed to retrieve scores", error: error.message });
  }
};

// @desc    Create or Update (Upsert) one or multiple scores
// @route   POST /api/scores | PUT /api/scores
const saveScore = async (req, res) => {
  try {
    // Standardize input: whether the frontend sends 1 object or an array of objects, make it an array
    const payload = Array.isArray(req.body.scores) ? req.body.scores : 
                   (Array.isArray(req.body) ? req.body : [req.body]);

    if (!payload || payload.length === 0) {
      return res.status(400).json({ message: "No score data provided" });
    }

    // Map into bulk operations for high performance
    const bulkOps = payload.map(data => ({
      updateOne: {
        filter: {
          studentId: data.studentId,
          subjectId: data.subjectId,
          month: data.month,
          academicYear: data.academicYear
        },
        update: { $set: data },
        upsert: true // Creates if it doesn't exist, updates if it does
      }
    }));

    await Score.bulkWrite(bulkOps);

    res.status(200).json({ message: "Scores saved successfully!" });
  } catch (error) {
    console.error("Error saving score:", error);
    res.status(500).json({ message: "Failed to save scores", error: error.message });
  }
};

// @desc    Delete a score by ID
// @route   DELETE /api/scores/:id
const deleteScore = async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedScore = await Score.findByIdAndDelete(id);
    
    if (!deletedScore) {
      return res.status(404).json({ message: "Score not found" });
    }

    res.status(200).json({ message: "Score deleted successfully!" });
  } catch (error) {
    console.error("Error deleting score:", error);
    res.status(500).json({ message: "Failed to delete score", error: error.message });
  }
};

module.exports = {
  getScoresByClass,
  saveScore,
  deleteScore
};