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
    // FIREBASE UID
    // ========================================================
    //
    // NEVER trust firebaseUid from req.body.
    //
    // auth.middleware.js verifies the Firebase ID token
    // and stores the decoded Firebase user in req.user.
    //
    // ========================================================

    const firebaseUid =
      req.user?.uid || req.user?.firebaseUid;

    if (!firebaseUid) {
      console.log(
        "❌ Firebase UID not found in authenticated request.",
      );

      return res.status(401).json({
        success: false,
        message:
          "Unauthorized. Firebase UID not found.",
      });
    }

    // ========================================================
    // REQUEST BODY
    // ========================================================

    console.log(
      "Request body:",
      JSON.stringify(req.body, null, 2),
    );

    const {
      fullName,
      displayName,
      email,
      username,
      phoneNumber,
      profileImage,
      photoURL,
      emailVerified,
      phoneVerified,
      firebaseCreatedAt,
      firebaseLastSignInAt,
    } = req.body;

    // ========================================================
    // NORMALIZE INPUT
    // ========================================================

    // Support displayName temporarily for compatibility,
    // but the Flutter app should now send fullName.
    const normalizedFullName =
      typeof fullName === "string" &&
      fullName.trim().length > 0
        ? fullName.trim()
        : typeof displayName === "string"
          ? displayName.trim()
          : "";

    const normalizedEmail =
      typeof email === "string"
        ? email.trim().toLowerCase()
        : "";

    const normalizedUsername =
      typeof username === "string"
        ? username.trim().toLowerCase()
        : "";

    const normalizedPhone =
      typeof phoneNumber === "string"
        ? phoneNumber.trim()
        : "";

    const normalizedProfileImage =
      typeof profileImage === "string"
        ? profileImage.trim()
        : typeof photoURL === "string"
          ? photoURL.trim()
          : "";

    // ========================================================
    // LOG NORMALIZED DATA
    // ========================================================

    console.log(
      "Firebase UID :",
      firebaseUid,
    );

    console.log(
      "Full Name    :",
      JSON.stringify(normalizedFullName),
    );

    console.log(
      "Username     :",
      JSON.stringify(normalizedUsername),
    );

    console.log(
      "Email        :",
      JSON.stringify(normalizedEmail),
    );

    console.log(
      "Phone        :",
      JSON.stringify(normalizedPhone),
    );

    // ========================================================
    // REQUIRED FIELDS
    // ========================================================

    if (!normalizedFullName) {
      console.log(
        "❌ Full name is missing.",
      );

      return res.status(400).json({
        success: false,
        message: "Full name is required.",
        field: "fullName",
      });
    }

    if (normalizedFullName.length < 2) {
      console.log(
        "❌ Full name is too short.",
      );

      return res.status(400).json({
        success: false,
        message:
          "Full name must contain at least 2 characters.",
        field: "fullName",
      });
    }

    if (!normalizedEmail) {
      console.log(
        "❌ Email is missing.",
      );

      return res.status(400).json({
        success: false,
        message: "Email is required.",
        field: "email",
      });
    }

    if (!normalizedUsername) {
      console.log(
        "❌ Username is missing.",
      );

      return res.status(400).json({
        success: false,
        message: "Username is required.",
        field: "username",
      });
    }

    if (!normalizedPhone) {
      console.log(
        "❌ Phone number is missing.",
      );

      return res.status(400).json({
        success: false,
        message: "Phone number is required.",
        field: "phoneNumber",
      });
    }

    // ========================================================
    // VALIDATE EMAIL
    // ========================================================

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
        field: "email",
      });
    }

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
        field: "username",
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

    const emailUser = await User.findOne({
      email: normalizedEmail,
      firebaseUid: {
        $ne: firebaseUid,
      },
    });

    if (emailUser) {
      console.log(
        "❌ Duplicate email detected.",
      );

      return res.status(409).json({
        success: false,
        message:
          "This email is already associated with another account.",
        field: "email",
      });
    }

    // ========================================================
    // CHECK DUPLICATE USERNAME
    // ========================================================

    const usernameUser = await User.findOne({
      username: normalizedUsername,
      firebaseUid: {
        $ne: firebaseUid,
      },
    });

    if (usernameUser) {
      console.log(
        "❌ Duplicate username detected.",
      );

      return res.status(409).json({
        success: false,
        message:
          "This username is already taken.",
        field: "username",
      });
    }

    // ========================================================
    // CHECK DUPLICATE PHONE
    // ========================================================

    const phoneUser = await User.findOne({
      phoneNumber: normalizedPhone,
      firebaseUid: {
        $ne: firebaseUid,
      },
    });

    if (phoneUser) {
      console.log(
        "❌ Duplicate phone number detected.",
      );

      return res.status(409).json({
        success: false,
        message:
          "This phone number is already registered.",
        field: "phoneNumber",
      });
    }

    // ========================================================
    // CREATE USER
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
          normalizedProfileImage,

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

      console.log("");
      console.log(
        "✅ MongoDB USER CREATED",
      );
      console.log(
        "MongoDB ID:",
        user._id.toString(),
      );
      console.log(
        "Firebase UID:",
        firebaseUid,
      );
      console.log(
        "Full Name:",
        normalizedFullName,
      );
      console.log(
        "Username:",
        normalizedUsername,
      );
      console.log("========================================");
      console.log("");

      return res.status(201).json({
        success: true,
        message:
          "User created successfully.",
        user,
      });
    }

    // ========================================================
    // BLOCKED USER CHECK
    // ========================================================

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message:
          "This account has been blocked.",
      });
    }

    // ========================================================
    // UPDATE EXISTING USER
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
      normalizedProfileImage ||
      user.profileImage ||
      "";

    user.emailVerified =
      emailVerified === true;

    user.phoneVerified =
      phoneVerified === true;

    // ========================================================
    // FIREBASE CREATED DATE
    // ========================================================

    if (firebaseCreatedAt) {
      const createdAt =
        new Date(firebaseCreatedAt);

      if (
        !Number.isNaN(
          createdAt.getTime(),
        )
      ) {
        user.firebaseCreatedAt =
          createdAt;
      }
    }

    // ========================================================
    // FIREBASE LAST SIGN-IN DATE
    // ========================================================

    if (firebaseLastSignInAt) {
      const lastSignInAt =
        new Date(
          firebaseLastSignInAt,
        );

      if (
        !Number.isNaN(
          lastSignInAt.getTime(),
        )
      ) {
        user.firebaseLastSignInAt =
          lastSignInAt;
      }
    }

    await user.save();

    console.log("");
    console.log(
      "✅ MongoDB USER UPDATED",
    );
    console.log(
      "MongoDB ID:",
      user._id.toString(),
    );
    console.log(
      "Firebase UID:",
      firebaseUid,
    );
    console.log(
      "Full Name:",
      normalizedFullName,
    );
    console.log(
      "Username:",
      normalizedUsername,
    );
    console.log("========================================");
    console.log("");

    return res.status(200).json({
      success: true,
      message:
        "User updated successfully.",
      user,
    });
  } catch (error) {
    console.error("");
    console.error(
      "========================================",
    );
    console.error(
      "❌ CREATE / UPDATE USER ERROR",
    );
    console.error(
      "========================================",
    );
    console.error(error);
    console.error(
      "========================================",
    );

    // ========================================================
    // MONGOOSE DUPLICATE KEY
    // ========================================================

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "Email, username, phone number or Firebase UID already exists.",
        error:
          process.env.NODE_ENV ===
          "development"
            ? error.message
            : undefined,
      });
    }

    // ========================================================
    // MONGOOSE VALIDATION
    // ========================================================

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

    // ========================================================
    // GENERAL SERVER ERROR
    // ========================================================

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
// GET USER BY FIREBASE UID
// GET /api/users/firebase/:firebaseUid
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
        message:
          "Unauthorized.",
      });
    }

    // Users can only access their
    // own profile.
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
// DELETE /api/users/delete
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

// ==========================================================
// EXPORTS
// ==========================================================

module.exports = {
  createOrUpdateUser,
  getUserByFirebaseUid,
  deleteUser,
};