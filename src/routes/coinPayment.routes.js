const express = require("express");

const firebaseAuth = require("../middleware/firebaseAuth.middleware");
const paymentController = require("../controllers/coinPayment.controller");

const router = express.Router();

router.post(
  "/create-order",
  firebaseAuth,
  paymentController.createOrder
);

router.post(
  "/verify",
  firebaseAuth,
  paymentController.verifyPayment
);

module.exports = router;
