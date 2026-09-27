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

router.post(
  "/profile",
  authMiddleware,
  profileUpload.single("image"),
  uploadProfileImage,
);

router.use(handleProfileUploadError);

module.exports = router;
