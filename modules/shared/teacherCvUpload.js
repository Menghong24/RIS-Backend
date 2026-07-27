const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const teacherImageDirectory = path.join(
  process.cwd(),
  "uploads",
  "teachers"
);

const teacherCvDirectory = path.join(
  process.cwd(),
  "uploads",
  "teacher-cvs"
);

fs.mkdirSync(
  teacherImageDirectory,
  {
    recursive: true
  }
);

fs.mkdirSync(
  teacherCvDirectory,
  {
    recursive: true
  }
);

const allowedImageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);

const allowedImageExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp"
]);

const allowedCvMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

const allowedCvExtensions = new Set([
  ".pdf",
  ".doc",
  ".docx"
]);

const createUniqueFileName = (
  prefix,
  extension
) => {
  const randomId =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : crypto
          .randomBytes(16)
          .toString("hex");

  return (
    `${prefix}-${Date.now()}-` +
    `${randomId}${extension}`
  );
};

const storage = multer.diskStorage({
  destination: (
    req,
    file,
    callback
  ) => {
    if (
      file.fieldname ===
      "profileImage"
    ) {
      return callback(
        null,
        teacherImageDirectory
      );
    }

    if (
      file.fieldname ===
      "cvFile"
    ) {
      return callback(
        null,
        teacherCvDirectory
      );
    }

    const error = new Error(
      `Unexpected upload field: ${file.fieldname}`
    );

    error.code =
      "INVALID_TEACHER_UPLOAD_FIELD";

    return callback(error);
  },

  filename: (
    req,
    file,
    callback
  ) => {
    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    if (
      file.fieldname ===
      "profileImage"
    ) {
      return callback(
        null,
        createUniqueFileName(
          "teacher-profile",
          extension
        )
      );
    }

    if (
      file.fieldname ===
      "cvFile"
    ) {
      return callback(
        null,
        createUniqueFileName(
          "teacher-cv",
          extension
        )
      );
    }

    const error = new Error(
      `Unexpected upload field: ${file.fieldname}`
    );

    error.code =
      "INVALID_TEACHER_UPLOAD_FIELD";

    return callback(error);
  }
});

const fileFilter = (
  req,
  file,
  callback
) => {
  const extension = path
    .extname(file.originalname)
    .toLowerCase();

  if (
    file.fieldname ===
    "profileImage"
  ) {
    const validMime =
      allowedImageMimeTypes.has(
        file.mimetype
      );

    const validExtension =
      allowedImageExtensions.has(
        extension
      );

    if (
      !validMime ||
      !validExtension
    ) {
      const error = new Error(
        "Profile image must be JPG, JPEG, PNG, or WEBP"
      );

      error.code =
        "INVALID_TEACHER_IMAGE_TYPE";

      return callback(
        error,
        false
      );
    }

    return callback(
      null,
      true
    );
  }

  if (
    file.fieldname ===
    "cvFile"
  ) {
    const validMime =
      allowedCvMimeTypes.has(
        file.mimetype
      );

    const validExtension =
      allowedCvExtensions.has(
        extension
      );

    if (
      !validMime ||
      !validExtension
    ) {
      const error = new Error(
        "CV must be PDF, DOC, or DOCX"
      );

      error.code =
        "INVALID_TEACHER_CV_TYPE";

      return callback(
        error,
        false
      );
    }

    return callback(
      null,
      true
    );
  }

  const error = new Error(
    `Unexpected upload field: ${file.fieldname}`
  );

  error.code =
    "INVALID_TEACHER_UPLOAD_FIELD";

  return callback(
    error,
    false
  );
};

const uploadTeacherFiles = multer({
  storage,
  fileFilter,

  limits: {
    files: 2,
    fileSize: 5 * 1024 * 1024
  }
});

const uploadTeacherFilesErrorHandler = (
  error,
  req,
  res,
  next
) => {
  if (!error) {
    return next();
  }

  if (
    error instanceof
    multer.MulterError
  ) {
    if (
      error.code ===
      "LIMIT_FILE_SIZE"
    ) {
      return res.status(400).send({
        err:
          "Each file must not exceed 5MB"
      });
    }

    if (
      error.code ===
      "LIMIT_FILE_COUNT"
    ) {
      return res.status(400).send({
        err:
          "Only one profile image and one CV are allowed"
      });
    }

    if (
      error.code ===
      "LIMIT_UNEXPECTED_FILE"
    ) {
      return res.status(400).send({
        err:
          "Use profileImage or cvFile as upload field"
      });
    }

    return res.status(400).send({
      err:
        error.message ||
        "Teacher upload failed"
    });
  }

  if (
    error.code ===
    "INVALID_TEACHER_IMAGE_TYPE"
  ) {
    return res.status(400).send({
      err:
        "Profile image must be JPG, JPEG, PNG, or WEBP"
    });
  }

  if (
    error.code ===
    "INVALID_TEACHER_CV_TYPE"
  ) {
    return res.status(400).send({
      err:
        "CV must be PDF, DOC, or DOCX"
    });
  }

  return res.status(400).send({
    err:
      error.message ||
      "Teacher upload failed"
  });
};

module.exports = {
  uploadTeacherFiles,
  uploadTeacherFilesErrorHandler
};