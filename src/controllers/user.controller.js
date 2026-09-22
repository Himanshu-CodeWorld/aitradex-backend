const User = require("../models/User");

// ============================================
// CREATE OR UPDATE USER
// ============================================
const createOrUpdateUser = async (req, res) => {
  try {
    const {
      firebaseUid,
      email,
      username,
      fullName,
      phoneNumber,
      profileImage,
    } = req.body;

    if (!firebaseUid) {
      return res.status(400).json({
        success: false,
        message: "Firebase UID is required",
      });
    }

    let user = await User.findOne({ firebaseUid });

    if (user) {
      user.email = email ?? user.email;
      user.username = username ?? user.username;
      user.fullName = fullName ?? user.fullName;
      user.phoneNumber = phoneNumber ?? user.phoneNumber;
      user.profileImage = profileImage ?? user.profileImage;

      await user.save();

      return res.status(200).json({
        success: true,
        message: "User updated successfully",
        user,
      });
    }

    user = await User.create({
      firebaseUid,
      email,
      username,
      fullName,
      phoneNumber,
      profileImage,
    });

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      user,
    });
  } catch (error) {
    console.error("Create/Update User Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create or update user",
      error: error.message,
    });
  }
};

// ============================================
// GET USER BY FIREBASE UID
// ============================================
const getUserByFirebaseUid = async (req, res) => {
  try {
    const { firebaseUid } = req.params;

    if (!firebaseUid) {
      return res.status(400).json({
        success: false,
        message: "Firebase UID is required",
      });
    }

    const user = await User.findOne({ firebaseUid });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Get User Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get user",
      error: error.message,
    });
  }
};

// ============================================
// DELETE USER
// DELETE /api/users/delete
// ============================================
const deleteUser = async (req, res) => {
  try {
    /*
     * authMiddleware should put the Firebase
     * authenticated user information into req.user.
     *
     * Depending on your middleware, the UID may be
     * available as uid or firebaseUid.
     */

    const firebaseUid =
      req.user?.uid ||
      req.user?.firebaseUid;

    if (!firebaseUid) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Firebase UID not found.",
      });
    }

    const user = await User.findOne({ firebaseUid });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    await User.deleteOne({
      firebaseUid,
    });

    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete User Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete user",
      error: error.message,
    });
  }
};

// ============================================
// EXPORT CONTROLLERS
// ============================================
module.exports = {
  createOrUpdateUser,
  getUserByFirebaseUid,
  deleteUser,
};