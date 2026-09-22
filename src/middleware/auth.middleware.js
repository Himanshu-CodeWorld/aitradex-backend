const admin = require("../config/firebaseAdmin");

/**
 * ==========================================================
 * AiTradeX Firebase Authentication Middleware
 * ==========================================================
 *
 * Flutter sends:
 *
 * Authorization: Bearer <Firebase ID Token>
 *
 * Backend verifies the token using:
 *
 * admin.auth().verifyIdToken(idToken)
 *
 * IMPORTANT:
 * Firebase ID tokens must NOT be verified with:
 *
 * jwt.verify()
 *
 * Firebase Admin SDK handles:
 * - Signature verification
 * - Firebase project verification
 * - Token expiration
 * - Issuer verification
 * - Audience verification
 * - Token claims
 * ==========================================================
 */

const authMiddleware = async (req, res, next) => {
  try {
    console.log("");
    console.log("========================================");
    console.log("🔐 FIREBASE AUTH MIDDLEWARE");
    console.log("========================================");

    // ========================================================
    // 1. GET AUTHORIZATION HEADER
    // ========================================================

    const authorization = req.headers.authorization;

    if (!authorization) {
      console.log("❌ Authorization header missing");
      console.log("========================================");
      console.log("");

      return res.status(401).json({
        success: false,
        message: "Authorization token is required.",
      });
    }

    // ========================================================
    // 2. CHECK BEARER FORMAT
    // ========================================================

    if (!authorization.startsWith("Bearer ")) {
      console.log("❌ Invalid Authorization header format");
      console.log("Expected: Bearer <Firebase ID Token>");
      console.log("========================================");
      console.log("");

      return res.status(401).json({
        success: false,
        message: "Invalid authorization format.",
      });
    }

    // ========================================================
    // 3. EXTRACT FIREBASE ID TOKEN
    // ========================================================

    const idToken = authorization.substring(7).trim();

    if (!idToken) {
      console.log("❌ Firebase ID token is empty");
      console.log("========================================");
      console.log("");

      return res.status(401).json({
        success: false,
        message: "Firebase ID token is required.",
      });
    }

    console.log("Firebase ID token received: true");

    // ========================================================
    // 4. VERIFY FIREBASE ID TOKEN
    // ========================================================
    //
    // DO NOT USE:
    //
    // jwt.verify(idToken, process.env.JWT_SECRET)
    //
    // Firebase ID tokens are verified by Firebase Admin SDK.
    //
    // ========================================================

    const decodedToken = await admin.auth().verifyIdToken(idToken);

    // ========================================================
    // 5. VALIDATE DECODED TOKEN
    // ========================================================

    if (!decodedToken) {
      console.log("❌ Firebase token decoded to empty value");

      return res.status(401).json({
        success: false,
        message: "Invalid Firebase authentication token.",
      });
    }

    if (!decodedToken.uid) {
      console.log("❌ Firebase UID missing from token");

      return res.status(401).json({
        success: false,
        message: "Firebase UID is missing from authentication token.",
      });
    }

    // ========================================================
    // 6. ATTACH FIREBASE USER TO REQUEST
    // ========================================================

    req.user = decodedToken;

    // ========================================================
    // 7. AUTHENTICATION SUCCESS LOG
    // ========================================================

    console.log("✅ Firebase token verified successfully");
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

    // ========================================================
    // 8. CONTINUE REQUEST
    // ========================================================

    return next();
  } catch (error) {
    // ========================================================
    // FIREBASE AUTH ERROR
    // ========================================================

    console.error("");
    console.error("========================================");
    console.error("❌ FIREBASE TOKEN VERIFICATION FAILED");
    console.error("========================================");
    console.error("Error code:", error.code || "N/A");
    console.error("Error name:", error.name || "N/A");
    console.error("Error message:", error.message || "Unknown error");
    console.error("========================================");
    console.error("");

    // ========================================================
    // TOKEN EXPIRED
    // ========================================================

    if (
      error.code === "auth/id-token-expired" ||
      error.code === "auth/id-token-expired"
    ) {
      return res.status(401).json({
        success: false,
        message: "Firebase authentication token has expired.",
        code: "TOKEN_EXPIRED",
      });
    }

    // ========================================================
    // TOKEN REVOKED
    // ========================================================

    if (error.code === "auth/id-token-revoked") {
      return res.status(401).json({
        success: false,
        message: "Firebase authentication token has been revoked.",
        code: "TOKEN_REVOKED",
      });
    }

    // ========================================================
    // INVALID TOKEN
    // ========================================================

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

    // ========================================================
    // DEFAULT AUTHENTICATION ERROR
    // ========================================================

    return res.status(401).json({
      success: false,
      message: "Invalid or expired Firebase authentication token.",
      code: "AUTHENTICATION_FAILED",
    });
  }
};

module.exports = authMiddleware;