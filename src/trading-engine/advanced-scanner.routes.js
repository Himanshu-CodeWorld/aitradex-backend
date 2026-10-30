 "use strict";
const express = require("express");
const router = express.Router();
const controller = require("./advanced-scanner.controller");
router.post("/run", controller.run);
router.get("/latest", controller.latest);
module.exports = router;
