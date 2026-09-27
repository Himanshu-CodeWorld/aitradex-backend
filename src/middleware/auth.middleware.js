// ==========================================================
// AiTradeX Firebase Authentication Middleware
// ==========================================================

const {
  firebaseAuth,
} = require("../config/firebaseAdmin");

// ==========================================================
// FIREBASE AUTH MIDDLEWARE
// ==========================================================

const authMiddleware = async (
  req,
  res,
  next,
) => {
  try {
    console.log("");
    console.log(
      "========================================",
    );
    console.log(
      "🔐 FIREBASE AUTH MIDDLEWARE",
    );
    console.log(
      "========================================",
    );

    // ======================================================
    // 1. GET AUTHORIZATION HEADER
    // ======================================================

    const authorization =
      req.headers?.authorization;

    if (
      !authorization ||
      typeof authorization !== "string"
    ) {
      console.log(
        "❌ Authorization header missing",
      );

      console.log(
        "========================================",
      );

      return res.status(401).json({
        success: false,
        message:
          "Authorization token is required.",
        code:
          "AUTHORIZATION_HEADER_MISSING",
      });
    }

    console.log(
      "Authorization header received: true",
    );

    // ======================================================
    // 2. VALIDATE BEARER FORMAT
    // ======================================================

    const parts =
      authorization.trim().split(/\s+/);

    if (
      parts.length !== 2 ||
      parts[0].toLowerCase() !== "bearer"
    ) {
      console.log(
        "❌ Invalid Authorization header format",
      );

      console.log(
        "========================================",
      );

      return res.status(401).json({
        success: false,
        message:
          "Invalid authorization format.",
        code:
          "INVALID_AUTHORIZATION_FORMAT",
      });
    }

    // ======================================================
    // 3. EXTRACT TOKEN
    // ======================================================

    const idToken = parts[1].trim();

    if (!idToken) {
      console.log(
        "❌ Firebase ID token is empty",
      );

      console.log(
        "========================================",
      );

      return res.status(401).json({
        success: false,
        message:
          "Firebase ID token is required.",
        code:
          "TOKEN_MISSING",
      });
    }

    console.log(
      "Firebase ID token received: true",
    );

    console.log(
      "Token length:",
      idToken.length,
    );

    // ======================================================
    // 4. CHECK FIREBASE ADMIN AUTH
    // ======================================================

    if (!firebaseAuth) {
      console.error(
        "❌ Firebase Admin Auth is not initialized",
      );

      console.error(
        "========================================",
      );

      return res.status(500).json({
        success: false,
        message:
          "Firebase authentication service is not initialized.",
        code:
          "FIREBASE_NOT_INITIALIZED",
      });
    }

    // ======================================================
    // 5. VERIFY FIREBASE ID TOKEN
    // ======================================================

    let decodedToken;

    try {
      decodedToken =
        await firebaseAuth.verifyIdToken(
          idToken,
        );
    } catch (firebaseError) {
      console.error("");
      console.error(
        "========================================",
      );
      console.error(
        "❌ FIREBASE TOKEN VERIFICATION FAILED",
      );
      console.error(
        "========================================",
      );

      console.error(
        "Firebase Error Code:",
        firebaseError?.code ||
          "N/A",
      );

      console.error(
        "Firebase Error Name:",
        firebaseError?.name ||
          "N/A",
      );

      console.error(
        "Firebase Error Message:",
        firebaseError?.message ||
          "Unknown error",
      );

      console.error(
        "========================================",
      );

      if (
        firebaseError?.code ===
        "auth/id-token-expired"
      ) {
        return res.status(401).json({
          success: false,
          message:
            "Firebase authentication token has expired.",
          code:
            "TOKEN_EXPIRED",
        });
      }

      if (
        firebaseError?.code ===
        "auth/id-token-revoked"
      ) {
        return res.status(401).json({
          success: false,
          message:
            "Firebase authentication token has been revoked.",
          code:
            "TOKEN_REVOKED",
        });
      }

      if (
        firebaseError?.code ===
          "auth/argument-error" ||
        firebaseError?.code ===
          "auth/invalid-id-token"
      ) {
        return res.status(401).json({
          success: false,
          message:
            "Invalid Firebase authentication token.",
          code:
            "INVALID_TOKEN",
        });
      }

      return res.status(401).json({
        success: false,
        message:
          "Invalid or expired Firebase authentication token.",
        code:
          "AUTHENTICATION_FAILED",
      });
    }

    // ======================================================
    // 6. VALIDATE DECODED TOKEN
    // ======================================================

    if (
      !decodedToken ||
      !decodedToken.uid
    ) {
      console.log(
        "❌ Firebase UID missing from decoded token",
      );

      console.log(
        "========================================",
      );

      return res.status(401).json({
        success: false,
        message:
          "Firebase UID is missing.",
        code:
          "UID_MISSING",
      });
    }

    // ======================================================
    // 7. ATTACH USER TO REQUEST
    // ======================================================

    req.user = decodedToken;

    req.firebaseUser =
      decodedToken;

    req.auth = decodedToken;

    req.userId =
      decodedToken.uid;

    // ======================================================
    // 8. SUCCESS LOG
    // ======================================================

    console.log("");
    console.log(
      "========================================",
    );
    console.log(
      "✅ FIREBASE TOKEN VERIFIED",
    );
    console.log(
      "========================================",
    );

    console.log(
      "Firebase UID:",
      decodedToken.uid,
    );

    console.log(
      "Email:",
      decodedToken.email ||
        "N/A",
    );

    console.log(
      "Email Verified:",
      decodedToken.email_verified ===
        true,
    );

    console.log(
      "Provider:",
      decodedToken.firebase
        ?.sign_in_provider ||
        "N/A",
    );

    console.log(
      "Issuer:",
      decodedToken.iss ||
        "N/A",
    );

    console.log(
      "Audience:",
      decodedToken.aud ||
        "N/A",
    );

    console.log(
      "========================================",
    );
    console.log(
      "✅ FIREBASE AUTH SUCCESS",
    );
    console.log(
      "========================================",
    );
    console.log("");

    // ======================================================
    // 9. CONTINUE
    // ======================================================

    return next();
  } catch (error) {
    console.error("");
    console.error(
      "========================================",
    );
    console.error(
      "❌ FIREBASE AUTH MIDDLEWARE ERROR",
    );
    console.error(
      "========================================",
    );

    console.error(
      "Code:",
      error?.code ||
        "N/A",
    );

    console.error(
      "Message:",
      error?.message ||
        "Unknown error",
    );

    console.error(
      "========================================",
    );

    return res.status(401).json({
      success: false,
      message:
        "Invalid or expired Firebase authentication token.",
      code:
        "AUTHENTICATION_FAILED",
    });
  }
};

// ==========================================================
// EXPORT
// ==========================================================

module.exports =
  authMiddleware;