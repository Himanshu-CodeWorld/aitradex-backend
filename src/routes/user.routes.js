const express = require("express");
const firebaseAuth = require("../middleware/firebaseAuth.middleware");
const {
  createOrUpdateUser,
  getUserByFirebaseUid,
} = require("../controllers/auth.controller");

const router = express.Router();

// Mount this router at /api/users.
// Flutter POSTs to /api/users and GETs /api/users/firebase/:firebaseUid.
router.post("/", firebaseAuth, createOrUpdateUser);
router.get("/firebase/:firebaseUid", firebaseAuth, getUserByFirebaseUid);

module.exports = router;
