const express = require('express');

const upstoxController =
  require('./upstox.controller');

const router = express.Router();

router.get(
  '/login',
  upstoxController.login,
);

router.get(
  '/callback',
  upstoxController.callback,
);

module.exports = router;