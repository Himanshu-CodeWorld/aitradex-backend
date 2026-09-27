// ==========================================================
// AiTradeX Firebase Authentication Middleware
// ==========================================================

const {
  firebaseAuth,
} = require("../config/firebaseAdmin");

// ==========================================================
// FIREBASE AUTH MIDDLEWARE
// ==========================================================

const firebaseAuthMiddleware = async (
  req,
  res,
  next,
) => {
  try {
    const authorization =
      req.headers?.authorization;

    if (
      !authorization ||
      typeof authorization !== "string"
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Authorization token is required.",
        code:
          "AUTHORIZATION_HEADER_MISSING",
      });
    }

    const parts =
      authorization.trim().split(/\s+/);

    if (
      parts.length !== 2 ||
      parts[0].toLowerCase() !== "bearer"
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid authorization format.",
        code:
          "INVALID_AUTHORIZATION_FORMAT",
      });
    }

    const token =
      parts[1].trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message:
          "Firebase token is missing.",
        code:
          "TOKEN_MISSING",
      });
    }

    if (!firebaseAuth) {
      return res.status(500).json({
        success: false,
        message:
          "Firebase authentication service is not initialized.",
        code:
          "FIREBASE_NOT_INITIALIZED",
      });
    }

    const decodedToken =
      await firebaseAuth.verifyIdToken(
        token,
      );

    if (
      !decodedToken ||
      !decodedToken.uid
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Firebase UID is missing.",
        code:
          "UID_MISSING",
      });
    }

    req.firebaseUser =
      decodedToken;

    req.user =
      decodedToken;

    req.auth =
      decodedToken;

    req.userId =
      decodedToken.uid;

    return next();
  } catch (error) {
    console.error("");
    console.error(
      "========================================",
    );
    console.error(
      "❌ FIREBASE AUTHENTICATION ERROR",
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

    if (
      error?.code ===
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
      error?.code ===
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

    return res.status(401).json({
      success: false,
      message:
        "Invalid or expired Firebase authentication token.",
      code:
        "AUTHENTICATION_FAILED",
    });
  }
};

module.exports =
  firebaseAuthMiddleware;