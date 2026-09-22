const express = require("express");

const router = express.Router();

const {
  createOrUpdateUser,
  getUserByFirebaseUid,
  deleteUser,
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
 *
 * Used after Firebase Authentication account creation.
 */
router.post(
  "/",
  createOrUpdateUser
);

/**
 * Get MongoDB user using Firebase UID
 *
 * GET /api/users/firebase/:firebaseUid
 */
router.get(
  "/firebase/:firebaseUid",
  getUserByFirebaseUid
);

/**
 * Delete MongoDB user using Firebase UID
 *
 * DELETE /api/users/delete
 *
 * Body:
 * {
 *   "firebaseUid": "firebase-user-uid"
 * }
 */
router.delete(
  "/delete",
  deleteUser
);

module.exports = router;