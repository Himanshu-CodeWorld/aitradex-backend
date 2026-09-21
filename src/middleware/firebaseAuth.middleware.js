const admin = require("../config/firebaseAdmin");

const firebaseAuthMiddleware = async (
  req,
  res,
  next
) => {
  try {
    const authorization =
      req.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authorization token is required.",
      });
    }

    const idToken =
      authorization.substring(7);

    if (!idToken) {
      return res.status(401).json({
        success: false,
        message: "Firebase ID token is missing.",
      });
    }

    const decodedToken =
      await admin.auth().verifyIdToken(idToken);

    req.firebaseUser = decodedToken;

    next();
  } catch (error) {
    console.error(
      "Firebase token verification error:",
      error
    );

    return res.status(401).json({
      success: false,
      message: "Invalid or expired Firebase token.",
    });
  }
};

module.exports =
  firebaseAuthMiddleware;