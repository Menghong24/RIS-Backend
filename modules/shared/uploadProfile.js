const path = require("path");
const fs = require("fs");
const multer = require("multer");

const uploadDir = path.join(process.cwd(), "uploads", "profiles");

const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, {
    recursive: true
  });
}

const sanitizeFileName = (value = "") => {
  return String(value)
    .replace(/[^a-zA-Z0-9-_]/g, "")
    .slice(0, 60);
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const userId = sanitizeFileName(req.user?._id || "user");
    const filename = `profile-${userId}-${Date.now()}${ext}`;

    cb(null, filename);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(
      new Error("សូមជ្រើសរូបភាពប្រភេទ JPG, PNG ឬ WEBP ប៉ុណ្ណោះ"),
      false
    );
  }

  if (!allowedExtensions.includes(ext)) {
    return cb(
      new Error("File extension មិនត្រឹមត្រូវទេ"),
      false
    );
  }

  cb(null, true);
};

const uploadProfile = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024
  }
});

const uploadProfileErrorHandler = (err, req, res, next) => {
  if (!err) {
    return next();
  }

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).send({
        err: "រូបភាពមិនអាចលើស 2MB បានទេ"
      });
    }

    return res.status(400).send({
      err: err.message
    });
  }

  return res.status(400).send({
    err: err.message || "Upload failed"
  });
};

module.exports = {
  uploadProfile,
  uploadProfileErrorHandler
};