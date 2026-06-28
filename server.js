const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const connectDatabase = require("./Database/database");

dotenv.config();

const app = express();

const uploadRoot = path.join(process.cwd(), "uploads");
const uploadFolders = ["profiles", "students", "teachers"];

if (!fs.existsSync(uploadRoot)) {
  fs.mkdirSync(uploadRoot, {
    recursive: true
  });
}

uploadFolders.forEach((folder) => {
  const folderPath = path.join(uploadRoot, folder);

  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, {
      recursive: true
    });
  }
});

// ==============================
// Middlewares
// ==============================

app.use(express.json());
app.use(
  express.urlencoded({
    extended: true
  })
);

// Serve uploaded files
// Examples:
// /uploads/profiles/profile-userid-date.png
// /uploads/students/students-id-date.png
// /uploads/teachers/teachers-id-date.png
app.use("/uploads", express.static(uploadRoot));

// ==============================
// CORS
// ==============================

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://m-school-t27v.vercel.app",
  "http://217.217.252.140",
  "https://217.217.252.140",
  "http://217.217.252.140:3000",
  "http://217.217.252.140:5173"
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL.replace(/\/$/, ""));
}

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      const cleanOrigin = origin.replace(/\/$/, "");

      if (allowedOrigins.includes(cleanOrigin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true
  })
);

// ==============================
// Routes
// ==============================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "School API is running"
  });
});

app.use(require("./modules/students/students.route"));
app.use(require("./modules/classes/classes.route"));
app.use(require("./modules/teachers/teachers.route"));
app.use(require("./modules/scores/scores.route"));
app.use(require("./modules/payments/payments.route"));
app.use(require("./modules/Attendance/attendance.route"));
app.use(require("./modules/subjects/subjects.route"));
app.use(require("./modules/schedules/schedules.route"));
app.use(require("./modules/announcements/announcements.route"));
app.use(require("./modules/users/users.route"));

// ==============================
// 404 Handler
// ==============================

app.use((req, res) => {
  res.status(404).send({
    err: "API route not found"
  });
});

// ==============================
// Error Handler
// ==============================

app.use((err, req, res, next) => {
  if (err.message === "Not allowed by CORS") {
    return res.status(403).send({
      err: "Not allowed by CORS"
    });
  }

  return res.status(err.status || 500).send({
    err: err.message || "Internal server error"
  });
});

// ==============================
// Start Server
// ==============================

connectDatabase();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});