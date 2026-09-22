const User = require("../models/User");

// ==========================================================
// Normalize Phone Number
// ==========================================================

const normalizePhoneNumber = (phone) => {
  if (phone === undefined || phone === null) {
    return "";
  }

  let normalized = String(phone).trim();

  normalized = normalized.replace(/[\s\-()]/g, "");

  if (normalized.startsWith("0091")) {
    normalized = `+${normalized.substring(2)}`;
  }

  if (
    normalized.startsWith("91") &&
    normalized.length === 12
  ) {
    normalized = `+${normalized}`;
  }

  if (
    normalized.length === 10 &&
    /^[6-9]\d{9}$/.test(normalized)
  ) {
    normalized = `+91${normalized}`;
  }

  return normalized;
};

// ==========================================================
// Validate Indian Phone Number
// ==========================================================

const isValidIndianPhoneNumber = (phone) => {
  return /^\+91[6-9]\d{9}$/.test(phone);
};

// ==========================================================
// Parse Firebase Date
// ==========================================================

const parseFirebaseDate = (value) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

// ==========================================================
// CREATE / UPDATE FIREBASE USER
//
// POST /api/users
//
// This endpoint receives Firebase Authentication user
// information from Flutter and mirrors it into MongoDB.
//
// IMPORTANT:
// Firebase password is NEVER stored in MongoDB.
// ==========================================================

exports.createOrUpdateUser = async (req, res) => {
  console.log("");
  console.log("========================================");
  console.log("CREATE / UPDATE FIREBASE USER");
  console.log("========================================");

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

    // ======================================================
    // Required Firebase UID
    // ======================================================

    if (
      !firebaseUid ||
      String(firebaseUid).trim() === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Firebase UID is required.",
      });
    }

    // ======================================================
    // Required Email
    // ======================================================

    if (
      !email ||
      String(email).trim() === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }

    // ======================================================
    // Normalize Data
    // ======================================================

    const normalizedFirebaseUid =
      String(firebaseUid).trim();

    const normalizedEmail =
      String(email)
        .trim()
        .toLowerCase();

    const normalizedDisplayName =
      displayName
        ? String(displayName).trim()
        : "";

    const normalizedPhoneNumber =
      phoneNumber
        ? normalizePhoneNumber(phoneNumber)
        : "";

    const normalizedPhotoURL =
      photoURL
        ? String(photoURL).trim()
        : "";

    // ======================================================
    // Log Request
    // ======================================================

    console.log(
      "Firebase UID:",
      normalizedFirebaseUid
    );

    console.log(
      "Email:",
      normalizedEmail
    );

    console.log(
      "Display Name:",
      normalizedDisplayName
    );

    console.log(
      "Phone:",
      normalizedPhoneNumber || "Not provided"
    );

    console.log(
      "Email Verified:",
      Boolean(emailVerified)
    );

    // ======================================================
    // Find Existing Firebase User
    // ======================================================

    let user = await User.findOne({
      firebaseUid: normalizedFirebaseUid,
    });

    // ======================================================
    // CREATE NEW USER
    // ======================================================

    if (!user) {
      console.log(
        "User not found in MongoDB."
      );

      console.log(
        "Creating new Firebase user..."
      );

      // ----------------------------------------------------
      // Check duplicate email
      // ----------------------------------------------------

      const emailUser =
        await User.findOne({
          email: normalizedEmail,
        });

      if (emailUser) {
        return res.status(409).json({
          success: false,
          message:
            "This email is already associated with another Firebase user.",
        });
      }

      // ----------------------------------------------------
      // Create MongoDB user
      // ----------------------------------------------------

      user = new User({
        firebaseUid:
          normalizedFirebaseUid,

        displayName:
          normalizedDisplayName,

        email:
          normalizedEmail,

        emailVerified:
          Boolean(emailVerified),

        phoneNumber:
          normalizedPhoneNumber,

        photoURL:
          normalizedPhotoURL,

        firebaseCreatedAt:
          parseFirebaseDate(
            firebaseCreatedAt
          ),

        firebaseLastSignInAt:
          parseFirebaseDate(
            firebaseLastSignInAt
          ),

        isActive: true,

        isBlocked: false,
      });

      await user.save();

      console.log(
        "========================================"
      );

      console.log(
        "FIREBASE USER CREATED IN MONGODB"
      );

      console.log(
        "MongoDB ID:",
        user._id.toString()
      );

      console.log(
        "Firebase UID:",
        user.firebaseUid
      );

      console.log(
        "========================================"
      );

      return res.status(201).json({
        success: true,
        message:
          "Firebase user created in MongoDB successfully.",
        user,
      });
    }

    // ======================================================
    // BLOCKED USER CHECK
    // ======================================================

    if (user.isBlocked === true) {
      return res.status(403).json({
        success: false,
        message:
          "This account has been blocked.",
      });
    }

    // ======================================================
    // UPDATE EXISTING USER
    // ======================================================

    console.log(
      "User found in MongoDB."
    );

    console.log(
      "Updating Firebase user information..."
    );

    user.displayName =
      normalizedDisplayName;

    user.email =
      normalizedEmail;

    user.emailVerified =
      Boolean(emailVerified);

    user.phoneNumber =
      normalizedPhoneNumber;

    user.photoURL =
      normalizedPhotoURL;

    if (firebaseCreatedAt) {
      const createdAt =
        parseFirebaseDate(
          firebaseCreatedAt
        );

      if (createdAt) {
        user.firebaseCreatedAt =
          createdAt;
      }
    }

    if (firebaseLastSignInAt) {
      const lastSignInAt =
        parseFirebaseDate(
          firebaseLastSignInAt
        );

      if (lastSignInAt) {
        user.firebaseLastSignInAt =
          lastSignInAt;
      }
    }

    await user.save();

    console.log(
      "========================================"
    );

    console.log(
      "FIREBASE USER UPDATED IN MONGODB"
    );

    console.log(
      "MongoDB ID:",
      user._id.toString()
    );

    console.log(
      "Firebase UID:",
      user.firebaseUid
    );

    console.log(
      "========================================"
    );

    return res.status(200).json({
      success: true,
      message:
        "Firebase user updated in MongoDB successfully.",
      user,
    });
  } catch (error) {
    console.error("");
    console.error(
      "========================================"
    );

    console.error(
      "CREATE / UPDATE FIREBASE USER ERROR"
    );

    console.error(
      "========================================"
    );

    console.error(
      "Message:",
      error.message
    );

    console.error(
      "Stack:",
      error.stack
    );

    // ======================================================
    // Duplicate Key
    // ======================================================

    if (error.code === 11000) {
      console.error(
        "Duplicate Key:",
        error.keyValue
      );

      return res.status(409).json({
        success: false,
        message:
          "A Firebase user with this UID or email already exists.",
        error:
          process.env.NODE_ENV ===
          "development"
            ? error.keyValue
            : undefined,
      });
    }

    // ======================================================
    // Validation Error
    // ======================================================

    if (
      error.name ===
      "ValidationError"
    ) {
      const validationErrors =
        Object.values(
          error.errors
        ).map(
          (item) => item.message
        );

      return res.status(400).json({
        success: false,
        message:
          "User validation failed.",
        errors:
          validationErrors,
      });
    }

    // ======================================================
    // Server Error
    // ======================================================

    return res.status(500).json({
      success: false,
      message:
        "Failed to save Firebase user in MongoDB.",
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
//
// GET /api/users/firebase/:firebaseUid
// ==========================================================

exports.getUserByFirebaseUid = async (
  req,
  res
) => {
  console.log("");
  console.log(
    "========================================"
  );
  console.log(
    "GET USER BY FIREBASE UID"
  );
  console.log(
    "========================================"
  );

  try {
    const {
      firebaseUid,
    } = req.params;

    // ======================================================
    // Validate UID
    // ======================================================

    if (
      !firebaseUid ||
      String(firebaseUid).trim() === ""
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Firebase UID is required.",
      });
    }

    const normalizedFirebaseUid =
      String(firebaseUid).trim();

    console.log(
      "Firebase UID:",
      normalizedFirebaseUid
    );

    // ======================================================
    // Find User
    // ======================================================

    const user =
      await User.findOne({
        firebaseUid:
          normalizedFirebaseUid,
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "User not found in MongoDB.",
      });
    }

    // ======================================================
    // Blocked User
    // ======================================================

    if (user.isBlocked === true) {
      return res.status(403).json({
        success: false,
        message:
          "This account has been blocked.",
      });
    }

    // ======================================================
    // Response
    // ======================================================

    return res.status(200).json({
      success: true,
      message:
        "User retrieved successfully.",
      user,
    });
  } catch (error) {
    console.error(
      "GET USER ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to retrieve user.",
      error:
        process.env.NODE_ENV ===
        "development"
          ? error.message
          : undefined,
    });
  }
};

// ==========================================================
// DELETE USER FROM MONGODB
//
// DELETE /api/users/delete
//
// This removes the MongoDB mirror.
// Firebase Authentication deletion should be performed
// separately using Firebase Authentication / Firebase Admin.
// ==========================================================

exports.deleteUser = async (
  req,
  res
) => {
  console.log("");
  console.log(
    "========================================"
  );
  console.log(
    "DELETE FIREBASE USER MIRROR"
  );
  console.log(
    "========================================"
  );

  try {
    let firebaseUid =
      req.body?.firebaseUid;

    // ------------------------------------------------------
    // Also support Firebase UID from params
    // ------------------------------------------------------

    if (
      !firebaseUid &&
      req.params?.firebaseUid
    ) {
      firebaseUid =
        req.params.firebaseUid;
    }

    if (
      !firebaseUid ||
      String(firebaseUid).trim() === ""
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Firebase UID is required.",
      });
    }

    firebaseUid =
      String(firebaseUid).trim();

    console.log(
      "Firebase UID:",
      firebaseUid
    );

    // ======================================================
    // Find User
    // ======================================================

    const user =
      await User.findOne({
        firebaseUid,
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "User not found in MongoDB.",
      });
    }

    // ======================================================
    // Delete User
    // ======================================================

    await User.deleteOne({
      _id: user._id,
    });

    console.log(
      "MongoDB user deleted successfully."
    );

    return res.status(200).json({
      success: true,
      message:
        "User deleted from MongoDB successfully.",
    });
  } catch (error) {
    console.error(
      "DELETE USER ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete user from MongoDB.",
      error:
        process.env.NODE_ENV ===
        "development"
          ? error.message
          : undefined,
    });
  }
};

// ==========================================================
// CHECK EMAIL
//
// POST /api/auth/check-email
// ==========================================================

exports.checkEmail = async (
  req,
  res
) => {
  try {
    const {
      email,
    } = req.body;

    if (
      !email ||
      String(email).trim() === ""
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Email is required.",
      });
    }

    const normalizedEmail =
      String(email)
        .trim()
        .toLowerCase();

    const user =
      await User.findOne({
        email: normalizedEmail,
      });

    return res.status(200).json({
      success: true,
      exists: !!user,
    });
  } catch (error) {
    console.error(
      "CHECK EMAIL ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to check email.",
    });
  }
};

// ==========================================================
// SEND PHONE OTP
//
// POST /api/auth/send-phone-otp
// ==========================================================

exports.sendPhoneOtp = async (
  req,
  res
) => {
  console.log("");
  console.log(
    "========================================"
  );
  console.log(
    "SEND PHONE OTP REQUEST"
  );
  console.log(
    "========================================"
  );

  try {
    let {
      phone,
      purpose = "signup",
    } = req.body;

    // ======================================================
    // Validate Phone
    // ======================================================

    if (
      !phone ||
      typeof phone !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Phone number is required.",
      });
    }

    phone =
      normalizePhoneNumber(phone);

    console.log(
      "Phone:",
      phone
    );

    console.log(
      "Purpose:",
      purpose
    );

    if (
      !isValidIndianPhoneNumber(
        phone
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid Indian phone number.",
      });
    }

    // ======================================================
    // For signup:
    // Prevent sending OTP to an existing account.
    // ======================================================

    if (purpose === "signup") {
      const existingUser =
        await User.findOne({
          phoneNumber: phone,
        });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message:
            "This phone number is already registered.",
        });
      }
    }

    // ======================================================
    // Send OTP Through Message Central
    // ======================================================

    const result =
      await otpService.sendPhoneOtp(
        phone
      );

    console.log(
      "========== OTP SERVICE RESULT =========="
    );

    console.log(
      JSON.stringify(
        result,
        null,
        2
      )
    );

    if (
      !result ||
      result.success !== true
    ) {
      return res.status(502).json({
        success: false,
        message:
          result?.message ||
          "Failed to send OTP.",
        data:
          result || null,
      });
    }

    // ======================================================
    // Response
    // ======================================================

    return res.status(200).json({
      success: true,
      message:
        "OTP sent successfully.",
      data: {
        verificationId:
          result.verificationId,
        expiresAt:
          result.expiresAt,
      },
    });
  } catch (error) {
    console.error("");
    console.error(
      "========================================"
    );
    console.error(
      "SEND PHONE OTP ERROR"
    );
    console.error(
      "========================================"
    );

    console.error(
      "Message:",
      error.message
    );

    if (error.response) {
      console.error(
        "Status:",
        error.response.status
      );

      console.error(
        "Response:",
        JSON.stringify(
          error.response.data,
          null,
          2
        )
      );
    }

    const providerData =
      error.response?.data;

    const providerMessage =
      providerData?.message ||
      providerData?.errorMessage ||
      providerData?.error ||
      providerData?.data?.message ||
      providerData?.data?.errorMessage;

    const statusCode =
      error.response?.status &&
      error.response.status >= 400 &&
      error.response.status <= 599
        ? error.response.status
        : 500;

    return res.status(
      statusCode
    ).json({
      success: false,
      message:
        providerMessage ||
        error.message ||
        "Failed to send OTP.",
      data:
        process.env.NODE_ENV ===
        "development"
          ? providerData || null
          : undefined,
    });
  }
};

// ==========================================================
// VERIFY PHONE OTP
//
// POST /api/auth/verify-phone-otp
// ==========================================================

exports.verifyPhoneOtp = async (
  req,
  res
) => {
  console.log("");
  console.log(
    "========================================"
  );
  console.log(
    "VERIFY PHONE OTP REQUEST"
  );
  console.log(
    "========================================"
  );

  try {
    let {
      phone,
      otp,
    } = req.body;

    // ======================================================
    // Validate
    // ======================================================

    if (
      !phone ||
      !otp
    ) {
      return res.status(400).json({
        success: false,
        verified: false,
        message:
          "Phone number and OTP are required.",
      });
    }

    phone =
      normalizePhoneNumber(phone);

    otp =
      String(otp).trim();

    if (
      !isValidIndianPhoneNumber(
        phone
      )
    ) {
      return res.status(400).json({
        success: false,
        verified: false,
        message:
          "Invalid Indian phone number.",
      });
    }

    if (
      !/^\d{6}$/.test(otp)
    ) {
      return res.status(400).json({
        success: false,
        verified: false,
        message:
          "OTP must be exactly 6 digits.",
      });
    }

    console.log(
      "Phone:",
      phone
    );

    // Never log the real OTP.
    console.log(
      "OTP: ******"
    );

    // ======================================================
    // Verify OTP
    // ======================================================

    const result =
      await otpService.verifyPhoneOtp(
        phone,
        otp
      );

    console.log(
      "========== VERIFY RESULT =========="
    );

    console.log(
      JSON.stringify(
        result,
        null,
        2
      )
    );

    if (
      !result ||
      result.success !== true ||
      result.verified !== true
    ) {
      return res.status(400).json({
        success: false,
        verified: false,
        message:
          result?.message ||
          "Invalid OTP. Please try again.",
      });
    }

    // ======================================================
    // Check Existing Firebase User
    // ======================================================

    const user =
      await User.findOne({
        phoneNumber: phone,
      });

    // ======================================================
    // Phone Verified
    //
    // IMPORTANT:
    // For Firebase Authentication signup,
    // do not create the MongoDB Firebase user here
    // because Firebase UID does not exist yet.
    // Flutter should create Firebase account first,
    // then call POST /api/users.
    // ======================================================

    return res.status(200).json({
      success: true,
      verified: true,
      message:
        "Phone verified successfully.",
      userExists: !!user,
      user:
        user || null,
    });
  } catch (error) {
    console.error("");
    console.error(
      "========================================"
    );
    console.error(
      "VERIFY PHONE OTP ERROR"
    );
    console.error(
      "========================================"
    );

    console.error(
      "Message:",
      error.message
    );

    if (error.response) {
      console.error(
        "Status:",
        error.response.status
      );

      console.error(
        "Response:",
        JSON.stringify(
          error.response.data,
          null,
          2
        )
      );
    }

    const providerData =
      error.response?.data;

    const providerMessage =
      providerData?.message ||
      providerData?.errorMessage ||
      providerData?.error ||
      providerData?.data?.message ||
      providerData?.data?.errorMessage;

    return res.status(
      error.response?.status &&
      error.response.status >= 400 &&
      error.response.status <= 599
        ? error.response.status
        : 500
    ).json({
      success: false,
      verified: false,
      message:
        providerMessage ||
        error.message ||
        "OTP verification failed.",
      data:
        process.env.NODE_ENV ===
        "development"
          ? providerData || null
          : undefined,
    });
  }
};

// ==========================================================
// RESEND PHONE OTP
//
// POST /api/auth/resend-phone-otp
// ==========================================================

exports.resendPhoneOtp = async (
  req,
  res
) => {
  console.log("");
  console.log(
    "========================================"
  );
  console.log(
    "RESEND PHONE OTP REQUEST"
  );
  console.log(
    "========================================"
  );

  try {
    let {
      phone,
    } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message:
          "Phone number is required.",
      });
    }

    phone =
      normalizePhoneNumber(phone);

    if (
      !isValidIndianPhoneNumber(
        phone
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid Indian phone number.",
      });
    }

    const result =
      await otpService.resendPhoneOtp(
        phone
      );

    console.log(
      "========== RESEND RESULT =========="
    );

    console.log(
      JSON.stringify(
        result,
        null,
        2
      )
    );

    if (
      !result ||
      result.success !== true
    ) {
      return res.status(502).json({
        success: false,
        message:
          result?.message ||
          "Failed to resend OTP.",
        data:
          result || null,
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "OTP resent successfully.",
      data: {
        verificationId:
          result.verificationId,
        expiresAt:
          result.expiresAt,
      },
    });
  } catch (error) {
    console.error(
      "RESEND PHONE OTP ERROR:",
      error
    );

    const providerData =
      error.response?.data;

    const providerMessage =
      providerData?.message ||
      providerData?.errorMessage ||
      providerData?.error ||
      providerData?.data?.message ||
      providerData?.data?.errorMessage;

    return res.status(
      error.response?.status || 500
    ).json({
      success: false,
      message:
        providerMessage ||
        error.message ||
        "Failed to resend OTP.",
      data:
        process.env.NODE_ENV ===
        "development"
          ? providerData || null
          : undefined,
    });
  }
};

// ==========================================================
// EXPORT
// ==========================================================

module.exports = {
  createOrUpdateUser:
    exports.createOrUpdateUser,

  getUserByFirebaseUid:
    exports.getUserByFirebaseUid,

  deleteUser:
    exports.deleteUser,

  checkEmail:
    exports.checkEmail,

  sendPhoneOtp:
    exports.sendPhoneOtp,

  verifyPhoneOtp:
    exports.verifyPhoneOtp,

  resendPhoneOtp:
    exports.resendPhoneOtp,
};