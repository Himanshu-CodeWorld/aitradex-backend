'use strict';

const express = require('express');
const controller = require('./paper-trading.controller');

const router = express.Router();

// Apply Firebase auth on the parent router before mounting this router.
router.get('/account', controller.account);
router.post('/orders', controller.placeOrder);
router.get('/positions', controller.positions);
router.get('/orders', controller.orders);
router.post('/reset', controller.reset);

module.exports = router;
