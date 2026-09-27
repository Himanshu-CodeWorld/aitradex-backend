const { getAuth } = require("firebase-admin/auth");

const firebaseApp = require("../config/firebaseAdmin");

/**
 * ==========================================================
 * AiTradeX Firebase Authentication Middleware
 * ==========================================================
 *
 * Responsibilities:
 * 1. Read Authorization header.
 * 2. Validate Bearer token format.
 * 3. Verify Firebase ID token.
 * 4. Attach decoded Firebase user to request.
 * 5. Continue to protected route exactly once.
 *
 * Request objects populated:
 *   req.user
 *   req.firebaseUser
 *   req.auth
 *
 * All three point to the same Firebase decoded token.
 * ==========================================================
 */

/**
 * Get Firebase UID safely from the request.
 *
 * This helper is also useful for controllers that support
 * multiple authentication request properties.
 */
function getFirebaseUid(req) {
  return (
    req?.user?.uid ||
    req?.firebaseUser?.uid ||
    req?.auth?.uid ||
    null
  );
}

/**
 * Firebase Authentication Middleware
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

    const authorization = req.headers?.authorization;

    if (!authorization) {
      console.log("❌ Authorization header missing");
      console.log("========================================");

      return res.status(401).json({
        success: false,
        message: "Authorization token is required.",
        code: "AUTHORIZATION_HEADER_MISSING",
      });
    }

    // ========================================================
    // 2. CHECK BEARER FORMAT
    // ========================================================

    if (!authorization.startsWith("Bearer ")) {
      console.log("❌ Invalid Authorization header format");
      console.log("Authorization must start with: Bearer");
      console.log("========================================");

      return res.status(401).json({
        success: false,
        message: "Invalid authorization format.",
        code: "INVALID_AUTHORIZATION_FORMAT",
      });
    }

    // ========================================================
    // 3. EXTRACT FIREBASE ID TOKEN
    // ========================================================

    const idToken = authorization.substring(7).trim();

    if (!idToken) {
      console.log("❌ Firebase ID token is empty");
      console.log("========================================");

      return res.status(401).json({
        success: false,
        message: "Firebase ID token is required.",
        code: "TOKEN_MISSING",
      });
    }

    console.log("Firebase ID token received: true");
    console.log(
      "Token length:",
      idToken.length
    );

    // ========================================================
    // 4. GET FIREBASE AUTH INSTANCE
    // ========================================================

    if (!firebaseApp) {
      console.error("❌ Firebase Admin app is not initialized");
      console.error("========================================");

      return res.status(500).json({
        success: false,
        message: "Firebase authentication service is not initialized.",
        code: "FIREBASE_NOT_INITIALIZED",
      });
    }

    const auth = getAuth(firebaseApp);

    // ========================================================
    // 5. VERIFY FIREBASE ID TOKEN
    // ========================================================

    const decodedToken = await auth.verifyIdToken(idToken);

    // ========================================================
    // 6. VALIDATE DECODED TOKEN
    // ========================================================

    if (!decodedToken) {
      console.log(
        "❌ Firebase token verification returned empty"
      );
      console.log("========================================");

      return res.status(401).json({
        success: false,
        message: "Invalid Firebase authentication token.",
        code: "INVALID_TOKEN",
      });
    }

    if (!decodedToken.uid) {
      console.log(
        "❌ Firebase UID missing from decoded token"
      );
      console.log("========================================");

      return res.status(401).json({
        success: false,
        message: "Firebase UID is missing.",
        code: "UID_MISSING",
      });
    }

    // ========================================================
    // 7. ATTACH FIREBASE USER TO REQUEST
    // ========================================================

    req.user = decodedToken;
    req.firebaseUser = decodedToken;
    req.auth = decodedToken;

    // ========================================================
    // 8. GET UID
    // ========================================================

    const firebaseUid = getFirebaseUid(req);

    if (!firebaseUid) {
      console.log(
        "❌ Unable to extract Firebase UID from request"
      );
      console.log("========================================");

      return res.status(401).json({
        success: false,
        message: "Firebase UID could not be determined.",
        code: "UID_EXTRACTION_FAILED",
      });
    }

    // ========================================================
    // 9. SUCCESS LOG
    // ========================================================

    console.log("✅ Firebase token verified");
    console.log("Firebase UID:", firebaseUid);
    console.log(
      "Email:",
      decodedToken.email || "N/A"
    );
    console.log(
      "Email verified:",
      decodedToken.email_verified === true
    );
    console.log(
      "Firebase provider:",
      decodedToken.firebase?.sign_in_provider || "N/A"
    );

    console.log("========================================");
    console.log("✅ FIREBASE AUTH SUCCESS");
    console.log("========================================");
    console.log("");

    // ========================================================
    // 10. CONTINUE TO PROTECTED ROUTE
    // IMPORTANT:
    // next() MUST ONLY BE CALLED ONCE.
    // ========================================================

    return next();
  } catch (error) {
    console.error("");
    console.error("========================================");
    console.error("❌ FIREBASE TOKEN VERIFICATION FAILED");
    console.error("========================================");
    console.error("Code:", error?.code || "N/A");
    console.error("Name:", error?.name || "N/A");
    console.error(
      "Message:",
      error?.message || "Unknown error"
    );
    console.error("========================================");
    console.error("");

    // ========================================================
    // TOKEN EXPIRED
    // ========================================================

    if (error?.code === "auth/id-token-expired") {
      return res.status(401).json({
        success: false,
        message: "Firebase authentication token has expired.",
        code: "TOKEN_EXPIRED",
      });
    }

    // ========================================================
    // TOKEN REVOKED
    // ========================================================

    if (error?.code === "auth/id-token-revoked") {
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
      error?.code === "auth/argument-error" ||
      error?.code === "auth/invalid-id-token"
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid Firebase authentication token.",
        code: "INVALID_TOKEN",
      });
    }

    // ========================================================
    // FIREBASE AUTH ERROR
    // ========================================================

    if (
      error?.code === "auth/invalid-credential" ||
      error?.code === "auth/user-disabled"
    ) {
      return res.status(401).json({
        success: false,
        message: "Firebase authentication failed.",
        code: "AUTHENTICATION_FAILED",
      });
    }

    // ========================================================
    // DEFAULT AUTH ERROR
    // ========================================================

    return res.status(401).json({
      success: false,
      message: "Invalid or expired Firebase authentication token.",
      code: "AUTHENTICATION_FAILED",
    });
  }
};

module.exports = authMiddleware;