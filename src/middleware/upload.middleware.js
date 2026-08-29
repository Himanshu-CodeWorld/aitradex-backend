const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ============================================================
// UPLOAD DIRECTORY
// ============================================================

const uploadDir = path.join(
  __dirname,
  "../../uploads"
);

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, {
    recursive: true,
  });
}

// ============================================================
// STORAGE
// ============================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const extension = path
      .extname(file.originalname || "")
      .toLowerCase();

    const filename =
      `${file.fieldname || "image"}-` +
      `${Date.now()}-` +
      `${Math.round(Math.random() * 1e9)}` +
      extension;

    cb(null, filename);
  },
});

// ============================================================
// ALLOWED IMAGE TYPES
// ============================================================

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const allowedExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
]);

// ============================================================
// FILE FILTER
// ============================================================

const fileFilter = (req, file, cb) => {
  console.log("");
  console.log("========================================");
  console.log("IMAGE UPLOAD");
  console.log("Original Name :", file.originalname);
  console.log("MIME Type     :", file.mimetype);
  console.log("Field Name    :", file.fieldname);
  console.log("========================================");

  const mimeType =
    (file.mimetype || "").toLowerCase();

  const extension = path
    .extname(file.originalname || "")
    .toLowerCase();

  // Normal image MIME type.
  if (allowedMimeTypes.has(mimeType)) {
    console.log("IMAGE ACCEPTED BY MIME TYPE");
    return cb(null, true);
  }

  // Some mobile devices / Flutter upload clients
  // send application/octet-stream even for images.
  //
  // In that situation, use the file extension as
  // a secondary check.
  if (
    mimeType === "application/octet-stream" &&
    allowedExtensions.has(extension)
  ) {
    console.log(
      "IMAGE ACCEPTED BY FILE EXTENSION"
    );

    return cb(null, true);
  }

  console.log("IMAGE REJECTED");
  console.log("MIME      :", mimeType);
  console.log("Extension :", extension);

  return cb(
    new Error(
      `Only images allowed. Received MIME: ${mimeType}, Extension: ${extension}`
    ),
    false
  );
};

// ============================================================
// MULTER
// ============================================================

const upload = multer({
  storage,
  fileFilter,

  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
    files: 1,
  },
});

module.exports = upload;