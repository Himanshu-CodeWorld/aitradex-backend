const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/auth.middleware");

const {
  profileUpload,
} = require("../middleware/profileUpload.middleware");

const {
  uploadProfileImage,
  handleProfileUploadError,
} = require("../controllers/profileUpload.controller");

// ============================================================
// POST /api/upload/profile
//
// Firebase ID token required.
//
// Multipart field:
// image=<profile image>
// ============================================================

router.post(
  "/profile",
  authMiddleware,
  profileUpload.single("image"),
  uploadProfileImage,
);

// ============================================================
// MULTER / UPLOAD ERRORS
// ============================================================

router.use(
  handleProfileUploadError,
);

module.exports = router;
