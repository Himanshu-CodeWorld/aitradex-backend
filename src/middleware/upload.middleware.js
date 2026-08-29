const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(__dirname, "../uploads");

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({

    destination(req, file, cb) {
        cb(null, uploadDir);
    },

    filename(req, file, cb) {

        const ext = path.extname(file.originalname);

        cb(
            null,
            Date.now() + ext
        );

    }

});

const fileFilter = (req, file, cb) => {

    if (
        file.mimetype.startsWith("image/")
    ) {
        cb(null, true);
    } else {
        cb(new Error("Only images allowed"));
    }

};

module.exports = multer({

    storage,

    fileFilter,

    limits: {
        fileSize: 10 * 1024 * 1024
    }

});