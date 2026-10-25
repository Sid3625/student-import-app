
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.resolve(
  process.env.UPLOAD_DIR || "./uploads"
);

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadDir);
  },
  filename: (_req, file, callback) => {
    const safeName = path
      .basename(file.originalname)
      .replace(/[^a-zA-Z0-9._-]/g, "_");

    callback(
      null,
      `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}`
    );
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1 GB
  },
  fileFilter: (_req, file, callback) => {
    if (path.extname(file.originalname).toLowerCase() !== ".sql") {
      return callback(new Error("Only .sql files are allowed."));
    }

    callback(null, true);
  },
});

module.exports = { upload };
