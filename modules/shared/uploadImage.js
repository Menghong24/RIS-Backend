const path = require("path");
const fs = require("fs");
const multer = require("multer");

const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, {
      recursive: true
    });
  }
};

const sanitizeFileName = (value = "") => {
  return String(value)
    .replace(/[^a-zA-Z0-9-_]/g, "")
    .slice(0, 60);
};

const createImageUploader = (folderName = "general") => {
  const safeFolderName = sanitizeFileName(folderName) || "general";
  const uploadDir = path.join(process.cwd(), "uploads", safeFolderName);

  ensureDir(uploadDir);

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },

    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();

      const ownerId = sanitizeFileName(
        req.params.id ||
          req.user?._id ||
          req.body?.username ||
          req.body?.name ||
          req.body?.englishName ||
          req.body?.khmerName ||
          "image"
      );

      const filename = `${safeFolderName}-${ownerId}-${Date.now()}${ext}`;

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

  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize: 2 * 1024 * 1024
    }
  });
};

const uploadImageErrorHandler = (err, req, res, next) => {
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
  createImageUploader,
  uploadImageErrorHandler
};