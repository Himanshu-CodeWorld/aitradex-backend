const User = require("../models/User");

/*
|--------------------------------------------------------------------------
| Create or Update Firebase User
|--------------------------------------------------------------------------
| This endpoint receives Firebase Authentication user data from Flutter
| and creates/updates the corresponding MongoDB user document.
|
| IMPORTANT:
| - Firebase remains the authentication system.
| - MongoDB only stores the user profile/account information.
| - Never store the Firebase password in MongoDB.
|--------------------------------------------------------------------------
*/

const createOrUpdateUser = async (req, res) => {
  try {
    const {
      firebaseUid,
      displayName,
      email,
      emailVerified,
      phoneNumber,
      photoURL,
      firebaseCreatedAt,
      firebaseLastSignInAt,
    } = req.body;

    // ---------------------------------------------------------------
    // Validate required fields
    // ---------------------------------------------------------------

    if (!firebaseUid) {
      return res.status(400).json({
        success: false,
        message: "Firebase UID is required.",
      });
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }

    // ---------------------------------------------------------------
    // Normalize values
    // ---------------------------------------------------------------

    const normalizedFirebaseUid = String(firebaseUid).trim();

    const normalizedEmail = String(email)
      .trim()
      .toLowerCase();

    const normalizedDisplayName = displayName
      ? String(displayName).trim()
      : "";

    const normalizedPhoneNumber = phoneNumber
      ? String(phoneNumber).trim()
      : "";

    const normalizedPhotoURL = photoURL
      ? String(photoURL).trim()
      : "";

    // ---------------------------------------------------------------
    // Find existing user
    // ---------------------------------------------------------------

    let user = await User.findOne({
      firebaseUid: normalizedFirebaseUid,
    });

    // ---------------------------------------------------------------
    // Create new MongoDB user
    // ---------------------------------------------------------------

    if (!user) {
      user = new User({
        firebaseUid: normalizedFirebaseUid,
        displayName: normalizedDisplayName,
        email: normalizedEmail,
        emailVerified: Boolean(emailVerified),
        phoneNumber: normalizedPhoneNumber,
        photoURL: normalizedPhotoURL,
        firebaseCreatedAt: firebaseCreatedAt
          ? new Date(firebaseCreatedAt)
          : null,
        firebaseLastSignInAt: firebaseLastSignInAt
          ? new Date(firebaseLastSignInAt)
          : null,
        isActive: true,
        isBlocked: false,
      });

      await user.save();

      return res.status(201).json({
        success: true,
        message: "Firebase user created in MongoDB successfully.",
        user,
      });
    }

    // ---------------------------------------------------------------
    // Update existing MongoDB user
    // ---------------------------------------------------------------

    user.displayName = normalizedDisplayName;
    user.email = normalizedEmail;
    user.emailVerified = Boolean(emailVerified);
    user.phoneNumber = normalizedPhoneNumber;
    user.photoURL = normalizedPhotoURL;

    if (firebaseCreatedAt) {
      user.firebaseCreatedAt = new Date(firebaseCreatedAt);
    }

    if (firebaseLastSignInAt) {
      user.firebaseLastSignInAt = new Date(firebaseLastSignInAt);
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Firebase user updated in MongoDB successfully.",
      user,
    });
  } catch (error) {
    console.error("Create/Update User Error:", error);

    // ---------------------------------------------------------------
    // MongoDB duplicate key error
    // ---------------------------------------------------------------

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A user with this Firebase UID or email already exists.",
        error: error.keyValue,
      });
    }

    // ---------------------------------------------------------------
    // Invalid MongoDB date
    // ---------------------------------------------------------------

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "User validation failed.",
        errors: Object.values(error.errors).map(
          (item) => item.message
        ),
      });
    }

    // ---------------------------------------------------------------
    // Generic server error
    // ---------------------------------------------------------------

    return res.status(500).json({
      success: false,
      message: "Failed to save Firebase user in MongoDB.",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
};

/*
|--------------------------------------------------------------------------
| Get User By Firebase UID
|--------------------------------------------------------------------------
| GET /api/users/firebase/:firebaseUid
|--------------------------------------------------------------------------
*/

const getUserByFirebaseUid = async (req, res) => {
  try {
    const { firebaseUid } = req.params;

    if (!firebaseUid) {
      return res.status(400).json({
        success: false,
        message: "Firebase UID is required.",
      });
    }

    const user = await User.findOne({
      firebaseUid: String(firebaseUid).trim(),
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found in MongoDB.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User retrieved successfully.",
      user,
    });
  } catch (error) {
    console.error("Get User Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve user.",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
};

module.exports = {
  createOrUpdateUser,
  getUserByFirebaseUid,
};