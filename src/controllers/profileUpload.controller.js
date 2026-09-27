const fs = require("fs");
const path = require("path");

exports.uploadProfileImage = async (req, res) => {
  try {
    console.log("");
    console.log("========================================");
    console.log("PROFILE IMAGE UPLOAD");
    console.log("========================================");
    console.log("Firebase UID:", req.user?.uid || "N/A");
    console.log("File received:", Boolean(req.file));

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Profile image file is required.",
        code: "PROFILE_IMAGE_MISSING",
      });
    }

    const publicUrl = `${req.protocol}://${req.get("host")}/uploads/profile/${encodeURIComponent(req.file.filename)}`;

    console.log("Filename:", req.file.filename);
    console.log("Size:", req.file.size);
    console.log("URL:", publicUrl);
    console.log("========================================");

    return res.status(201).json({
      success: true,
      message: "Profile image uploaded successfully.",
      url: publicUrl,
      filename: req.file.filename,
      size: req.file.size,
      mimeType: req.file.mimetype,
    });
  } catch (error) {
    console.error("PROFILE IMAGE UPLOAD ERROR:", error);

    if (req.file?.path) {
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (cleanupError) {
        console.error("Upload cleanup error:", cleanupError);
      }
    }

    return res.status(500).json({
      success: false,
      message: "Profile image upload failed.",
      code: "PROFILE_IMAGE_UPLOAD_FAILED",
    });
  }
};

exports.handleProfileUploadError = (error, _req, res, _next) => {
  console.error("PROFILE UPLOAD MIDDLEWARE ERROR:", error);

  if (error?.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      message: "Profile image must be 5 MB or smaller.",
      code: "PROFILE_IMAGE_TOO_LARGE",
    });
  }

  return res.status(400).json({
    success: false,
    message:
      error?.message ||
      "Only JPG, JPEG, PNG, and WEBP profile images are allowed.",
    code: "PROFILE_IMAGE_INVALID",
  });
};
