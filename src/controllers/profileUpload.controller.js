const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");

// ============================================================
// UPLOAD BUFFER TO CLOUDINARY
// ============================================================

const uploadBufferToCloudinary = (
  buffer,
  options = {},
) => {
  return new Promise((resolve, reject) => {
    const uploadStream =
      cloudinary.uploader.upload_stream(
        options,
        (error, result) => {
          if (error) {
            return reject(error);
          }

          return resolve(result);
        },
      );

    streamifier
      .createReadStream(buffer)
      .pipe(uploadStream);
  });
};

// ============================================================
// POST /api/upload/profile
// ============================================================
//
// Header:
// Authorization: Bearer <Firebase ID Token>
//
// Multipart field:
// image=<profile image>
//
// Response:
// {
//   success: true,
//   url: "https://res.cloudinary.com/...",
//   public_id: "aitradex/profile/..."
// }
//
// ============================================================

exports.uploadProfileImage = async (
  req,
  res,
) => {
  try {
    console.log("");
    console.log("========================================");
    console.log("☁️ PROFILE IMAGE -> CLOUDINARY");
    console.log("========================================");

    const firebaseUid =
      req.user?.uid ||
      req.user?.firebaseUid ||
      "unknown";

    console.log(
      "Firebase UID :",
      firebaseUid,
    );

    console.log(
      "File received:",
      Boolean(req.file),
    );

    // --------------------------------------------------------
    // FILE CHECK
    // --------------------------------------------------------

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Profile image file is required.",
        code: "PROFILE_IMAGE_MISSING",
      });
    }

    // --------------------------------------------------------
    // BUFFER CHECK
    // --------------------------------------------------------

    if (
      !req.file.buffer ||
      !Buffer.isBuffer(req.file.buffer)
    ) {
      return res.status(400).json({
        success: false,
        message: "Image buffer was not received.",
        code: "PROFILE_IMAGE_BUFFER_MISSING",
      });
    }

    if (req.file.buffer.length <= 0) {
      return res.status(400).json({
        success: false,
        message: "Uploaded image is empty.",
        code: "PROFILE_IMAGE_EMPTY",
      });
    }

    // --------------------------------------------------------
    // SANITIZE USER FOLDER
    // --------------------------------------------------------

    const safeUid = String(firebaseUid)
      .replace(/[^a-zA-Z0-9_-]/g, "_");

    const folder = `aitradex/users/${safeUid}/profile`;

    console.log(
      "Cloudinary Folder:",
      folder,
    );

    console.log(
      "Original Name   :",
      req.file.originalname,
    );

    console.log(
      "MIME Type       :",
      req.file.mimetype,
    );

    console.log(
      "Size            :",
      req.file.size,
    );

    // --------------------------------------------------------
    // CLOUDINARY UPLOAD
    // --------------------------------------------------------

    const result =
      await uploadBufferToCloudinary(
        req.file.buffer,
        {
          folder,
          resource_type: "image",

          // Let Cloudinary optimize the delivered image.
          quality: "auto",
          fetch_format: "auto",

          // Generate a deterministic public ID per upload.
          use_filename: false,
          unique_filename: true,
          overwrite: false,
        },
      );

    console.log("");
    console.log("========================================");
    console.log("✅ CLOUDINARY PROFILE UPLOAD SUCCESS");
    console.log("========================================");
    console.log(
      "Public ID :",
      result.public_id,
    );
    console.log(
      "Secure URL:",
      result.secure_url,
    );
    console.log(
      "Format    :",
      result.format,
    );
    console.log(
      "Bytes     :",
      result.bytes,
    );
    console.log("========================================");
    console.log("");

    return res.status(201).json({
      success: true,
      message: "Profile image uploaded successfully.",

      // Flutter should save this URL as profileImage.
      url: result.secure_url,

      // Alias for clients that use profileImageUrl.
      profileImageUrl: result.secure_url,

      public_id: result.public_id,
      resource_type: result.resource_type,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
    });
  } catch (error) {
    console.error("");
    console.error("========================================");
    console.error("❌ CLOUDINARY PROFILE UPLOAD ERROR");
    console.error("========================================");
    console.error(
      "Message:",
      error?.message,
    );
    console.error(
      "Code:",
      error?.http_code || error?.code || "UNKNOWN",
    );

    if (error?.stack) {
      console.error(error.stack);
    }

    console.error("========================================");
    console.error("");

    return res.status(500).json({
      success: false,
      message: "Profile image upload failed.",
      code: "PROFILE_IMAGE_UPLOAD_FAILED",
    });
  }
};

// ============================================================
// MULTER ERROR HANDLER
// ============================================================

exports.handleProfileUploadError = (
  error,
  _req,
  res,
  _next,
) => {
  console.error("");
  console.error("========================================");
  console.error("❌ PROFILE UPLOAD MIDDLEWARE ERROR");
  console.error("========================================");
  console.error(
    "Message:",
    error?.message,
  );
  console.error(
    "Code:",
    error?.code,
  );
  console.error("========================================");

  if (
    error?.code ===
    "LIMIT_FILE_SIZE"
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Profile image must be 5 MB or smaller.",
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
