// src/middleware/firebaseAuth.middleware.js

const admin = require("../config/firebaseAdmin");

const firebaseAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authorization token is required",
      });
    }

    const token = authHeader.substring(7);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Firebase token is missing",
      });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);

    req.firebaseUser = decodedToken;
    req.userId = decodedToken.uid;

    next();
  } catch (error) {
    console.error("❌ Firebase Auth Error:", error.message);

    return res.status(401).json({
      success: false,
      message: "Invalid or expired Firebase authentication token",
    });
  }
};

module.exports = firebaseAuthMiddleware;