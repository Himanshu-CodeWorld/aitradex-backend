const multer = require("multer");

// ============================================================
// ALLOWED IMAGE MIME TYPES
// ============================================================

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

// ============================================================
// ALLOWED EXTENSIONS
// ============================================================

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
  console.log("MULTER FILE FILTER");
  console.log("========================================");
  console.log("Field Name     :", file.fieldname);
  console.log("Original Name  :", file.originalname);
  console.log("MIME Type      :", file.mimetype);
  console.log("========================================");

  const mimeType =
    (file.mimetype || "").toLowerCase();

  const originalName =
    file.originalname || "";

  const extension =
    originalName
      ? require("path")
          .extname(originalName)
          .toLowerCase()
      : "";

  // ----------------------------------------------------------
  // Normal image MIME
  // ----------------------------------------------------------

  if (allowedMimeTypes.has(mimeType)) {
    console.log("IMAGE ACCEPTED BY MIME TYPE");

    return cb(null, true);
  }

  // ----------------------------------------------------------
  // Mobile fallback
  // ----------------------------------------------------------

  if (
    mimeType === "application/octet-stream" &&
    allowedExtensions.has(extension)
  ) {
    console.log(
      "IMAGE ACCEPTED BY EXTENSION"
    );

    return cb(null, true);
  }

  // ----------------------------------------------------------
  // Reject
  // ----------------------------------------------------------

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
// MULTER MEMORY STORAGE
// ============================================================
//
// IMPORTANT:
// We do NOT save the image to Render's filesystem.
//
// The image stays in memory and is directly sent to Cloudinary.
//

const storage = multer.memoryStorage();

// ============================================================
// MULTER CONFIGURATION
// ============================================================

const upload = multer({
  storage,
  fileFilter,

  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
});

module.exports = upload;