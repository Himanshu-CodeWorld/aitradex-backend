const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");

// ============================================================
// UPLOAD BUFFER TO CLOUDINARY
// ============================================================

const uploadBufferToCloudinary = (
  buffer,
  options = {}
) => {
  return new Promise((resolve, reject) => {
    const uploadStream =
      cloudinary.uploader.upload_stream(
        options,
        (error, result) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(result);
        }
      );

    streamifier
      .createReadStream(buffer)
      .pipe(uploadStream);
  });
};

// ============================================================
// UPLOAD IMAGE
// ============================================================

exports.uploadImage = async (req, res, next) => {
  try {
    console.log("");
    console.log("========================================");
    console.log("UPLOAD CONTROLLER");
    console.log("========================================");

    console.log("Body:", req.body);

    // ==========================================================
    // CHECK FILE
    // ==========================================================

    if (!req.file) {
      console.error(
        "NO FILE RECEIVED"
      );

      return res.status(400).json({
        success: false,
        message:
          "No image file received.",
      });
    }

    // ==========================================================
    // FILE INFORMATION
    // ==========================================================

    console.log(
      "Field Name    :",
      req.file.fieldname
    );

    console.log(
      "Original Name :",
      req.file.originalname
    );

    console.log(
      "MIME Type     :",
      req.file.mimetype
    );

    console.log(
      "Size          :",
      req.file.size
    );

    console.log(
      "Buffer Exists :",
      Buffer.isBuffer(req.file.buffer)
    );

    // ==========================================================
    // CHECK BUFFER
    // ==========================================================

    if (
      !req.file.buffer ||
      !Buffer.isBuffer(req.file.buffer)
    ) {
      console.error(
        "FILE BUFFER NOT FOUND"
      );

      return res.status(400).json({
        success: false,
        message:
          "Image buffer was not received.",
      });
    }

    // ==========================================================
    // CHECK SIZE
    // ==========================================================

    if (req.file.buffer.length <= 0) {
      console.error(
        "IMAGE BUFFER IS EMPTY"
      );

      return res.status(400).json({
        success: false,
        message:
          "Uploaded image is empty.",
      });
    }

    console.log(
      "Buffer Size:",
      req.file.buffer.length
    );

    // ==========================================================
    // FOLDER
    // ==========================================================

    const folder =
      String(
        req.body.folder || "general"
      )
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, "-");

    const cloudinaryFolder =
      `aitradex/${folder}`;

    console.log(
      "Cloudinary Folder:",
      cloudinaryFolder
    );

    // ==========================================================
    // CLOUDINARY
    // ==========================================================

    console.log(
      "Uploading directly to Cloudinary..."
    );

    const result =
      await uploadBufferToCloudinary(
        req.file.buffer,
        {
          folder: cloudinaryFolder,
          resource_type: "image",

          // Automatically choose suitable
          // image format where possible.
          quality: "auto",
          fetch_format: "auto",
        }
      );

    // ==========================================================
    // CLOUDINARY RESULT
    // ==========================================================

    console.log("");
    console.log(
      "========================================"
    );
    console.log(
      "CLOUDINARY UPLOAD SUCCESS"
    );
    console.log(
      "========================================"
    );

    console.log(
      "Public ID :",
      result.public_id
    );

    console.log(
      "URL       :",
      result.secure_url
    );

    console.log(
      "Format    :",
      result.format
    );

    console.log(
      "Bytes     :",
      result.bytes
    );

    console.log(
      "========================================"
    );

    // ==========================================================
    // RESPONSE
    // ==========================================================

    return res.status(200).json({
      success: true,
      message:
        "Image uploaded successfully.",

      url: result.secure_url,

      public_id:
        result.public_id,

      format:
        result.format,

      bytes:
        result.bytes,
    });
  } catch (error) {
    console.error("");
    console.error(
      "========================================"
    );
    console.error(
      "CLOUDINARY UPLOAD ERROR"
    );
    console.error(
      "========================================"
    );
    console.error(error);
    console.error(
      "========================================"
    );

    next(error);
  }
};