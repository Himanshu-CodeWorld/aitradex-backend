const express = require("express");

const router = express.Router();

const {
  createOrUpdateUser,
  getUserByFirebaseUid,
} = require("../controllers/user.controller");

/*
|--------------------------------------------------------------------------
| User Routes
|--------------------------------------------------------------------------
*/

/**
 * Create or update Firebase user in MongoDB
 *
 * POST /api/users
 */
router.post("/", createOrUpdateUser);

/**
 * Get MongoDB user using Firebase UID
 *
 * GET /api/users/firebase/:firebaseUid
 */
router.get("/firebase/:firebaseUid", getUserByFirebaseUid);

module.exports = router;