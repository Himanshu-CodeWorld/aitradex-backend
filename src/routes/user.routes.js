const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/auth.middleware");

const {
  createOrUpdateUser,
  getUserByFirebaseUid,
  deleteUser,
} = require("../controllers/user.controller");

// ============================================
// CREATE / UPDATE USER
// POST /api/users
// ============================================
router.post("/", authMiddleware, createOrUpdateUser);

// ============================================
// GET USER BY FIREBASE UID
// GET /api/users/firebase/:firebaseUid
// ============================================
router.get("/firebase/:firebaseUid", authMiddleware, getUserByFirebaseUid);

// ============================================
// DELETE USER
// DELETE /api/users/delete
// ============================================
router.delete("/delete", authMiddleware, deleteUser);

module.exports = router;