const multer = require("multer");
const path = require("path");

// ============================================================
// PROFILE IMAGE UPLOAD MIDDLEWARE
// ============================================================
//
// Profile images are kept in memory and sent directly to
// Cloudinary by the controller.
//
// IMPORTANT:
// Do NOT use diskStorage here. Render's local filesystem is
// ephemeral and should not be used for permanent user images.
// ============================================================

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const allowedExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
]);

const fileFilter = (_req, file, cb) => {
  console.log("");
  console.log("========================================");
  console.log("PROFILE IMAGE FILE FILTER");
  console.log("========================================");
  console.log("Field Name    :", file.fieldname);
  console.log("Original Name :", file.originalname);
  console.log("MIME Type     :", file.mimetype);
  console.log("========================================");

  const mimeType =
    String(file.mimetype || "").toLowerCase();

  const extension = path
    .extname(file.originalname || "")
    .toLowerCase();

  if (allowedMimeTypes.has(mimeType)) {
    return cb(null, true);
  }

  // Some mobile clients can report application/octet-stream.
  if (
    mimeType === "application/octet-stream" &&
    allowedExtensions.has(extension)
  ) {
    return cb(null, true);
  }

  return cb(
    new Error(
      "Only JPG, JPEG, PNG, and WEBP profile images are allowed.",
    ),
    false,
  );
};

const profileUpload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },

  fileFilter,
});

module.exports = {
  profileUpload,
};
