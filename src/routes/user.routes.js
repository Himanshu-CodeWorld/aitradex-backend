const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/auth.middleware");

const {
  createOrUpdateUser,
  getUserByFirebaseUid,
  deleteUser,
} = require("../controllers/user.controller");

// Create / update user
router.post(
  "/",
  authMiddleware,
  createOrUpdateUser
);

// Get user
router.get(
  "/firebase/:firebaseUid",
  authMiddleware,
  getUserByFirebaseUid
);

// Delete user
router.delete(
  "/delete",
  authMiddleware,
  deleteUser
);

module.exports = router;