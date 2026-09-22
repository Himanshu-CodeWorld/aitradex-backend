// src/middleware/firebaseAuth.middleware.js

const { firebaseAuth } = require("../config/firebaseAdmin");

const firebaseAuthMiddleware = async (req, res, next) => {
  try {
    // ============================================
    // Get Authorization Header
    // ============================================

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Authorization header is required",
      });
    }

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Invalid authorization format",
      });
    }

    // ============================================
    // Extract Firebase ID Token
    // ============================================

    const token = authHeader.substring(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Firebase token is missing",
      });
    }

    // ============================================
    // Verify Firebase Token
    // ============================================

    const decodedToken = await firebaseAuth.verifyIdToken(token);

    // ============================================
    // Attach User Information
    // ============================================

    req.firebaseUser = decodedToken;
    req.userId = decodedToken.uid;

    next();
  } catch (error) {
    console.error("====================================");
    console.error("❌ Firebase Authentication Error");
    console.error("Message:", error.message);
    console.error("====================================");

    return res.status(401).json({
      success: false,
      message: "Invalid or expired Firebase authentication token",
    });
  }
};

module.exports = firebaseAuthMiddleware;