const express = require('express');
const dotenv = require('dotenv');
const connectDatabase = require('./Database/database');
dotenv.config();
const app = express();
const cors = require("cors");

app.use(express.json());

const allowedOrigins = [
  "http://localhost:5173",
  // "https://gorgeous-pastelito-4b421c.netlify.app",
  // "https://mvwdar.netlify.app",
  "https://m-school-t27v.vercel.app",
  "http://217.217.252.140",
  "https://217.217.252.140",
  
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    const cleanOrigin = origin.replace(/\/$/, "");

    if (allowedOrigins.includes(cleanOrigin)) {
      callback(null, true);
    } else {
      console.log("Blocked CORS:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));

app.use(require('./modules/students/students.route'));
app.use(require('./modules/classes/classes.route'));
app.use(require('./modules/teachers/teachers.route'));
app.use(require('./modules/scores/scores.route'));
app.use(require('./modules/payments/payments.route'));
app.use(require('./modules/Attendance/attendance.route'));
app.use(require('./modules/subjects/subjects.route'));
app.use(require('./modules/schedules/schedules.route'));
app.use(require('./modules/announcements/announcements.route'));
app.use(require('./modules/users/users.route'));


app.use((err, req, res, next) => {
    res.status(500).send({ error: err.message });
});

connectDatabase();
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "School API is running"
  });
});
// 3. FIX: Changed '3000 || PORT' to 'process.env.PORT || 3000'
// Deployed platforms (like Render/Railway) assign dynamic ports via process.env.PORT.
// Hardcoding 3000 first will make the deployment fail online.
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});