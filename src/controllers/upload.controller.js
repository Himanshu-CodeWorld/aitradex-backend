const cloudinary = require("../config/cloudinary");

exports.uploadImage = async (req, res, next) => {
  try {
    console.log("");
    console.log("========================================");
    console.log("UPLOAD CONTROLLER");
    console.log("========================================");

    console.log("Body:", req.body);
    console.log("File:", req.file);

    // ---------------------------------------------------------
    // Check file
    // ---------------------------------------------------------

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file received.",
      });
    }

    console.log("Original name:", req.file.originalname);
    console.log("Mimetype:", req.file.mimetype);
    console.log("Size:", req.file.size);
    console.log("Path:", req.file.path);

    // ---------------------------------------------------------
    // Check file size
    // ---------------------------------------------------------

    if (!req.file.size || req.file.size <= 0) {
      return res.status(400).json({
        success: false,
        message: "Uploaded image is empty.",
      });
    }

    // ---------------------------------------------------------
    // Cloudinary upload
    // ---------------------------------------------------------

    const folder =
      req.body.folder || "aitradex";

    const result =
      await cloudinary.uploader.upload(
        req.file.path,
        {
          folder: `aitradex/${folder}`,
          resource_type: "image",
        }
      );

    console.log("Cloudinary upload successful:");
    console.log(result.secure_url);

    // ---------------------------------------------------------
    // Response
    // ---------------------------------------------------------

    return res.status(200).json({
      success: true,
      message: "Image uploaded successfully.",
      url: result.secure_url,
      public_id: result.public_id,
    });
  } catch (error) {
    console.error("");
    console.error("========================================");
    console.error("CLOUDINARY UPLOAD ERROR");
    console.error("========================================");
    console.error(error);
    console.error("========================================");

    next(error);
  }
};