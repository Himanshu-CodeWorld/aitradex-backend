const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDirectory = path.join(
  process.cwd(),
  "uploads",
  "profile",
);

fs.mkdirSync(uploadDirectory, {
  recursive: true,
});

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDirectory);
  },

  filename: (_req, file, cb) => {
    const extension =
      path.extname(file.originalname).toLowerCase() || ".jpg";

    const safeExtension =
      [".jpg", ".jpeg", ".png", ".webp"].includes(extension)
        ? extension
        : ".jpg";

    const filename =
      `profile-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExtension}`;

    cb(null, filename);
  },
});

const profileUpload = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },

  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return cb(
        new Error(
          "Only JPG, JPEG, PNG, and WEBP profile images are allowed.",
        ),
      );
    }

    cb(null, true);
  },
});

module.exports = {
  profileUpload,
  uploadDirectory,
};
