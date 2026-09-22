const { getAuth } = require("firebase-admin/auth");

const firebaseApp = require("../config/firebaseAdmin");

/**
 * ==========================================================
 * AiTradeX Firebase Authentication Middleware
 * ==========================================================
 */

const authMiddleware = async (req, res, next) => {
  try {
    console.log("");
    console.log("========================================");
    console.log("🔐 FIREBASE AUTH MIDDLEWARE");
    console.log("========================================");

    // ========================================================
    // GET AUTHORIZATION HEADER
    // ========================================================

    const authorization = req.headers.authorization;

    if (!authorization) {
      console.log("❌ Authorization header missing");

      return res.status(401).json({
        success: false,
        message: "Authorization token is required.",
      });
    }

    // ========================================================
    // CHECK BEARER FORMAT
    // ========================================================

    if (!authorization.startsWith("Bearer ")) {
      console.log("❌ Invalid Authorization header format");

      return res.status(401).json({
        success: false,
        message: "Invalid authorization format.",
      });
    }

    // ========================================================
    // EXTRACT FIREBASE ID TOKEN
    // ========================================================

    const idToken = authorization.substring(7).trim();

    if (!idToken) {
      console.log("❌ Firebase ID token is empty");

      return res.status(401).json({
        success: false,
        message: "Firebase ID token is required.",
      });
    }

    console.log("Firebase ID token received: true");

    // ========================================================
    // VERIFY FIREBASE ID TOKEN
    // ========================================================

    const decodedToken = await getAuth(
      firebaseApp
    ).verifyIdToken(idToken);

    // ========================================================
    // VALIDATE TOKEN
    // ========================================================

    if (!decodedToken) {
      console.log("❌ Firebase token verification returned empty");

      return res.status(401).json({
        success: false,
        message: "Invalid Firebase authentication token.",
      });
    }

    if (!decodedToken.uid) {
      console.log("❌ Firebase UID missing from token");

      return res.status(401).json({
        success: false,
        message: "Firebase UID is missing.",
      });
    }

    // ========================================================
    // ATTACH USER TO REQUEST
    // ========================================================

    req.user = decodedToken;

    // ========================================================
    // SUCCESS LOG
    // ========================================================

    console.log("✅ Firebase token verified");
    console.log("Firebase UID:", decodedToken.uid);
    console.log("Email:", decodedToken.email || "N/A");
    console.log(
      "Email verified:",
      decodedToken.email_verified === true
    );

    console.log("========================================");
    console.log("✅ FIREBASE AUTH SUCCESS");
    console.log("========================================");
    console.log("");

    return next();
  } catch (error) {
    console.error("");
    console.error("========================================");
    console.error("❌ FIREBASE TOKEN VERIFICATION FAILED");
    console.error("========================================");
    console.error("Code:", error.code || "N/A");
    console.error("Name:", error.name || "N/A");
    console.error("Message:", error.message || "Unknown error");
    console.error("========================================");
    console.error("");

    if (error.code === "auth/id-token-expired") {
      return res.status(401).json({
        success: false,
        message: "Firebase authentication token has expired.",
        code: "TOKEN_EXPIRED",
      });
    }

    if (error.code === "auth/id-token-revoked") {
      return res.status(401).json({
        success: false,
        message: "Firebase authentication token has been revoked.",
        code: "TOKEN_REVOKED",
      });
    }

    if (
      error.code === "auth/argument-error" ||
      error.code === "auth/invalid-id-token"
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid Firebase authentication token.",
        code: "INVALID_TOKEN",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid or expired Firebase authentication token.",
      code: "AUTHENTICATION_FAILED",
    });
  }
};

module.exports = authMiddleware;