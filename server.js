const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const connectDatabase = require(
  "./Database/database"
);

// ======================================================
// Route imports
// Each route file must end with:
// module.exports = router;
// ======================================================

const studentsRoutes = require(
  "./modules/students/students.route"
);

const classesRoutes = require(
  "./modules/classes/classes.route"
);

const teachersRoutes = require(
  "./modules/teachers/teachers.route"
);

const scoresRoutes = require(
  "./modules/scores/scores.route"
);

const paymentsRoutes = require(
  "./modules/payments/payments.route"
);

const attendanceRoutes = require(
  "./modules/Attendance/attendance.route"
);

const subjectsRoutes = require(
  "./modules/subjects/subjects.route"
);

const schedulesRoutes = require(
  "./modules/schedules/schedules.route"
);

const announcementsRoutes = require(
  "./modules/announcements/announcements.route"
);

const usersRoutes = require(
  "./modules/users/users.route"
);

const branchesRoutes = require(
  "./modules/branches/branches.route"
);

dotenv.config();

const app = express();

// ======================================================
// Upload directories
// ======================================================

const uploadRoot = path.join(
  process.cwd(),
  "uploads"
);

const uploadFolders = [
  "profiles",
  "students",
  "teachers",
  "teacher-cvs"
];

fs.mkdirSync(uploadRoot, {
  recursive: true
});

uploadFolders.forEach((folder) => {
  const folderPath = path.join(
    uploadRoot,
    folder
  );

  fs.mkdirSync(folderPath, {
    recursive: true
  });
});

// ======================================================
// Middlewares
// ======================================================

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true
  })
);

/*
  Serve all uploaded files.

  Examples:
  /uploads/profiles/profile-file.png
  /uploads/students/student-file.png
  /uploads/teachers/teacher-profile.png
  /uploads/teacher-cvs/teacher-cv.pdf
*/
app.use(
  "/uploads",
  express.static(uploadRoot)
);

// ======================================================
// CORS
// ======================================================

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
  const frontendUrl =
    process.env.FRONTEND_URL.replace(
      /\/$/,
      ""
    );

  if (
    !allowedOrigins.includes(
      frontendUrl
    )
  ) {
    allowedOrigins.push(
      frontendUrl
    );
  }
}

app.use(
  cors({
    origin: (
      origin,
      callback
    ) => {
      /*
        Requests from Postman, server-to-server,
        mobile apps, or curl may not contain Origin.
      */
      if (!origin) {
        return callback(
          null,
          true
        );
      }

      const cleanOrigin =
        origin.replace(
          /\/$/,
          ""
        );

      if (
        allowedOrigins.includes(
          cleanOrigin
        )
      ) {
        return callback(
          null,
          true
        );
      }

      const error = new Error(
        "Not allowed by CORS"
      );

      error.status = 403;

      return callback(
        error
      );
    },

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS"
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization"
    ]
  })
);

// ======================================================
// Router validation
// Gives a clear error when a route exports an object
// or undefined instead of an Express Router.
// ======================================================

const registerRouter = (
  routerName,
  router
) => {
  if (
    typeof router !==
    "function"
  ) {
    throw new TypeError(
      `${routerName} must export an Express Router. ` +
      `Received: ${typeof router}. ` +
      `The route file must end with module.exports = router;`
    );
  }

  app.use(router);
};

// ======================================================
// Routes
// ======================================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message:
      "School API is running"
  });
});

registerRouter(
  "studentsRoutes",
  studentsRoutes
);

registerRouter(
  "classesRoutes",
  classesRoutes
);

registerRouter(
  "teachersRoutes",
  teachersRoutes
);

registerRouter(
  "scoresRoutes",
  scoresRoutes
);

registerRouter(
  "paymentsRoutes",
  paymentsRoutes
);

registerRouter(
  "attendanceRoutes",
  attendanceRoutes
);

registerRouter(
  "subjectsRoutes",
  subjectsRoutes
);

registerRouter(
  "schedulesRoutes",
  schedulesRoutes
);

registerRouter(
  "announcementsRoutes",
  announcementsRoutes
);

registerRouter(
  "usersRoutes",
  usersRoutes
);

registerRouter(
  "branchesRoutes",
  branchesRoutes
);

// ======================================================
// 404 Handler
// Must stay after every route
// ======================================================

app.use((req, res) => {
  return res.status(404).send({
    err:
      `API route not found: ` +
      `${req.method} ${req.originalUrl}`
  });
});

// ======================================================
// Global Error Handler
// Must have four parameters
// ======================================================

app.use(
  (
    err,
    req,
    res,
    next
  ) => {
    console.error(
      "Unhandled server error:",
      err
    );

    if (
      err.message ===
      "Not allowed by CORS"
    ) {
      return res
        .status(403)
        .send({
          err:
            "Not allowed by CORS"
        });
    }

    return res
      .status(
        err.status || 500
      )
      .send({
        err:
          err.message ||
          "Internal server error"
      });
  }
);

// ======================================================
// Start server
// ======================================================

const PORT =
  process.env.PORT ||
  3000;

const startServer = async () => {
  try {
    await connectDatabase();

    app.listen(
      PORT,
      () => {
        console.log(
          `Server is running on port ${PORT}`
        );

        console.log(
          `Uploads: http://localhost:${PORT}/uploads`
        );
      }
    );
  } catch (error) {
    console.error(
      "Failed to start server:",
      error
    );

    process.exit(1);
  }
};

startServer();