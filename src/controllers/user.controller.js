const User = require("../models/User");

// ==========================================================
// CREATE / UPDATE USER
// POST /api/users
// ==========================================================

const createOrUpdateUser = async (req, res) => {
  try {
    console.log("");
    console.log("========================================");
    console.log("CREATE / UPDATE USER");
    console.log("========================================");

    // ========================================================
    // FIREBASE UID MUST COME FROM AUTH MIDDLEWARE
    // ========================================================

    const firebaseUid =
      req.user?.uid ||
      req.user?.firebaseUid;

    if (!firebaseUid) {
      return res.status(401).json({
        success: false,
        message:
          "Unauthorized. Firebase UID not found.",
      });
    }

    // ========================================================
    // REQUEST DATA
    // ========================================================

    const {
      fullName,
      email,
      username,
      phoneNumber,
      profileImage,
      emailVerified,
      phoneVerified,
      firebaseCreatedAt,
      firebaseLastSignInAt,
    } = req.body;

    // ========================================================
    // REQUIRED FIELDS
    // ========================================================

    if (!fullName?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Full name is required.",
      });
    }

    if (!email?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }

    if (!username?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Username is required.",
      });
    }

    if (!phoneNumber?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required.",
      });
    }

    // ========================================================
    // NORMALIZE
    // ========================================================

    const normalizedEmail =
      email.trim().toLowerCase();

    const normalizedUsername =
      username.trim().toLowerCase();

    const normalizedFullName =
      fullName.trim();

    const normalizedPhone =
      phoneNumber.trim();

    // ========================================================
    // VALIDATE USERNAME
    // ========================================================

    if (
      !/^[a-zA-Z0-9_]{3,20}$/.test(
        normalizedUsername,
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Username must contain 3-20 letters, numbers or underscores.",
      });
    }

    // ========================================================
    // FIND EXISTING USER
    // ========================================================

    let user = await User.findOne({
      firebaseUid,
    });

    // ========================================================
    // CHECK DUPLICATE EMAIL
    // ========================================================

    const emailUser =
      await User.findOne({
        email: normalizedEmail,
        firebaseUid: {
          $ne: firebaseUid,
        },
      });

    if (emailUser) {
      return res.status(409).json({
        success: false,
        message:
          "This email is already associated with another account.",
      });
    }

    // ========================================================
    // CHECK DUPLICATE USERNAME
    // ========================================================

    const usernameUser =
      await User.findOne({
        username: normalizedUsername,
        firebaseUid: {
          $ne: firebaseUid,
        },
      });

    if (usernameUser) {
      return res.status(409).json({
        success: false,
        message:
          "This username is already taken.",
      });
    }

    // ========================================================
    // CHECK DUPLICATE PHONE
    // ========================================================

    const phoneUser =
      await User.findOne({
        phoneNumber: normalizedPhone,
        firebaseUid: {
          $ne: firebaseUid,
        },
      });

    if (phoneUser) {
      return res.status(409).json({
        success: false,
        message:
          "This phone number is already registered.",
      });
    }

    // ========================================================
    // CREATE
    // ========================================================

    if (!user) {
      user = new User({
        firebaseUid,
        fullName:
          normalizedFullName,
        username:
          normalizedUsername,
        email:
          normalizedEmail,
        phoneNumber:
          normalizedPhone,
        profileImage:
          profileImage?.trim() || "",
        emailVerified:
          emailVerified === true,
        phoneVerified:
          phoneVerified === true,
        firebaseCreatedAt:
          firebaseCreatedAt
            ? new Date(firebaseCreatedAt)
            : null,
        firebaseLastSignInAt:
          firebaseLastSignInAt
            ? new Date(firebaseLastSignInAt)
            : null,
        isActive: true,
        isBlocked: false,
      });

      await user.save();

      console.log(
        "MongoDB user CREATED:",
        user._id.toString(),
      );

      return res.status(201).json({
        success: true,
        message:
          "User created successfully.",
        user,
      });
    }

    // ========================================================
    // BLOCKED CHECK
    // ========================================================

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message:
          "This account has been blocked.",
      });
    }

    // ========================================================
    // UPDATE
    // ========================================================

    user.fullName =
      normalizedFullName;

    user.username =
      normalizedUsername;

    user.email =
      normalizedEmail;

    user.phoneNumber =
      normalizedPhone;

    user.profileImage =
      profileImage?.trim() ||
      user.profileImage ||
      "";

    user.emailVerified =
      emailVerified === true;

    user.phoneVerified =
      phoneVerified === true;

    if (firebaseCreatedAt) {
      const createdAt =
        new Date(firebaseCreatedAt);

      if (!Number.isNaN(
        createdAt.getTime(),
      )) {
        user.firebaseCreatedAt =
          createdAt;
      }
    }

    if (firebaseLastSignInAt) {
      const lastSignInAt =
        new Date(
          firebaseLastSignInAt,
        );

      if (!Number.isNaN(
        lastSignInAt.getTime(),
      )) {
        user.firebaseLastSignInAt =
          lastSignInAt;
      }
    }

    await user.save();

    console.log(
      "MongoDB user UPDATED:",
      user._id.toString(),
    );

    return res.status(200).json({
      success: true,
      message:
        "User updated successfully.",
      user,
    });
  } catch (error) {
    console.error(
      "CREATE / UPDATE USER ERROR:",
      error,
    );

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "Email, username, phone number or Firebase UID already exists.",
      });
    }

    if (
      error.name ===
      "ValidationError"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "User validation failed.",
        errors: Object.values(
          error.errors,
        ).map(
          (item) => item.message,
        ),
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to save user.",
      error:
        process.env.NODE_ENV ===
        "development"
          ? error.message
          : undefined,
    });
  }
};

// ==========================================================
// GET USER
// ==========================================================

const getUserByFirebaseUid = async (
  req,
  res,
) => {
  try {
    const requestedUid =
      req.params.firebaseUid;

    const authenticatedUid =
      req.user?.uid ||
      req.user?.firebaseUid;

    if (!authenticatedUid) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    // Users can only access their own profile.
    if (
      requestedUid !==
      authenticatedUid
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You are not allowed to access this user.",
      });
    }

    const user =
      await User.findOne({
        firebaseUid:
          authenticatedUid,
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "User not found.",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error(
      "GET USER ERROR:",
      error,
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to get user.",
    });
  }
};

// ==========================================================
// DELETE USER
// ==========================================================

const deleteUser = async (
  req,
  res,
) => {
  try {
    const firebaseUid =
      req.user?.uid ||
      req.user?.firebaseUid;

    if (!firebaseUid) {
      return res.status(401).json({
        success: false,
        message:
          "Unauthorized.",
      });
    }

    const user =
      await User.findOne({
        firebaseUid,
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "User not found.",
      });
    }

    await User.deleteOne({
      firebaseUid,
    });

    return res.status(200).json({
      success: true,
      message:
        "User deleted successfully.",
    });
  } catch (error) {
    console.error(
      "DELETE USER ERROR:",
      error,
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete user.",
    });
  }
};

module.exports = {
  createOrUpdateUser,
  getUserByFirebaseUid,
  deleteUser,
};