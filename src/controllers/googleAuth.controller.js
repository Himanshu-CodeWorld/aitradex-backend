const crypto = require("crypto");
const User = require("../models/User");

function makeReferralCode() {
  // 10 uppercase hex characters; model requires 8–16 characters.
  return crypto.randomBytes(5).toString("hex").toUpperCase();
}

async function createUserWithUniqueReferralCode(userData) {
  // Retry only referral-code collisions. Other database errors should surface.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await User.create({
        ...userData,
        referralCode: makeReferralCode(),
      });
    } catch (error) {
      if (error?.code === 11000 &&
          (error?.keyPattern?.referralCode || String(error?.message).includes("referralCode"))) {
        continue;
      }
      throw error;
    }
  }
  throw new Error("Could not allocate a unique referral code.");
}

async function googleAuth(req, res) {
  const requestStartedAt = Date.now();

  try {
    // Set only by firebaseAuthMiddleware after verifyIdToken succeeds.
    const firebaseUser = req.firebaseUser;
    if (!firebaseUser?.uid) {
      return res.status(401).json({
        success: false,
        message: "A valid Firebase ID token is required.",
        code: "FIREBASE_USER_MISSING",
      });
    }

    const firebaseUid = firebaseUser.uid;
    const email = String(firebaseUser.email || "").trim().toLowerCase();
    const fullName = String(
      firebaseUser.name ||
      (email ? email.split("@")[0] : "AiTradeX User")
    ).trim() || "AiTradeX User";
    const profileImage = String(firebaseUser.picture || "").trim();
    const emailVerified = firebaseUser.email_verified === true;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Google account email is missing.",
        code: "GOOGLE_EMAIL_MISSING",
      });
    }

    console.log(`[GoogleAuth] Sync started for Firebase UID ${firebaseUid}`);

    // First match the stable Firebase identity.
    let user = await User.findOne({ firebaseUid }).maxTimeMS(10000);
    let isNewUser = false;

    if (!user) {
      // Do not silently attach a different Firebase identity to an existing
      // email account. Account linking should be an explicit, verified flow.
      const existingEmailUser = await User.findOne({ email }).maxTimeMS(10000);
      if (existingEmailUser && existingEmailUser.firebaseUid !== firebaseUid) {
        return res.status(409).json({
          success: false,
          message: "An account with this email already exists. Sign in using its original method.",
          code: "EMAIL_ACCOUNT_EXISTS",
        });
      }

      user = await createUserWithUniqueReferralCode({
        firebaseUid,
        authProvider: "google",
        email,
        fullName,
        profileImage,
        emailVerified,
        firebaseCreatedAt: firebaseUser.auth_time
          ? new Date(firebaseUser.auth_time * 1000)
          : new Date(),
        firebaseLastSignInAt: firebaseUser.auth_time
          ? new Date(firebaseUser.auth_time * 1000)
          : new Date(),
      });
      isNewUser = true;
    } else {
      if (user.isBlocked || user.isActive === false) {
        return res.status(403).json({
          success: false,
          message: "This AiTradeX account is disabled. Please contact support.",
          code: "ACCOUNT_DISABLED",
        });
      }

      user.email = email;
      user.fullName = fullName;
      user.profileImage = profileImage;
      user.authProvider = "google";
      user.emailVerified = emailVerified;
      user.firebaseLastSignInAt = firebaseUser.auth_time
        ? new Date(firebaseUser.auth_time * 1000)
        : new Date();

      await user.save();
    }

    console.log(
      `[GoogleAuth] Sync succeeded (${isNewUser ? "new user" : "existing user"}) in ${Date.now() - requestStartedAt}ms`
    );

    return res.status(isNewUser ? 201 : 200).json({
      success: true,
      isNewUser,
      message: isNewUser
        ? "Google account created successfully."
        : "Google account signed in successfully.",
      user: {
        id: user._id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        fullName: user.fullName,
        username: user.username || null,
        profileImage: user.profileImage || "",
        authProvider: user.authProvider,
        emailVerified: user.emailVerified,
        referralCode: user.referralCode,
      },
    });
  } catch (error) {
    console.error("[GoogleAuth] Profile sync failed:", {
      name: error?.name,
      code: error?.code,
      message: error?.message,
      elapsedMs: Date.now() - requestStartedAt,
    });

    if (error?.name === "MongooseError" ||
        error?.name === "MongoServerSelectionError" ||
        error?.name === "MongoNetworkError" ||
        error?.name === "MongoOperationTimeoutError") {
      return res.status(503).json({
        success: false,
        message: "Database is temporarily unavailable. Please try again.",
        code: "DATABASE_UNAVAILABLE",
      });
    }

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with these details already exists.",
        code: "DUPLICATE_ACCOUNT",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to synchronize Google account.",
      code: "GOOGLE_PROFILE_SYNC_FAILED",
    });
  }
}

module.exports = { googleAuth };
