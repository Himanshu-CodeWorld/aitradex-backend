const router = require("express").Router();

const upload = require("../middleware/upload.middleware");

const controller = require("../controllers/kyc.controller");

router.post(

    "/verify-document",

    upload.single("image"),

    controller.verifyDocument

);

module.exports = router;