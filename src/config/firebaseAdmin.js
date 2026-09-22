const admin = require("firebase-admin");

// ==========================================================
// FIREBASE ADMIN INITIALIZATION
// ==========================================================

let firebaseAdmin;

// ==========================================================
// CHECK IF FIREBASE ADMIN IS ALREADY INITIALIZED
// ==========================================================

if (admin.apps && admin.apps.length > 0) {
  firebaseAdmin = admin.app();

  console.log("");
  console.log("========================================");
  console.log("🔥 Firebase Admin Already Initialized");
  console.log("========================================");
} else {
  try {
    // --------------------------------------------------------
    // Firebase service account configuration
    // --------------------------------------------------------

    const serviceAccount = {
      type: process.env.FIREBASE_TYPE,
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
        : undefined,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI,
      token_uri: process.env.FIREBASE_TOKEN_URI,
      auth_provider_x509_cert_url:
        process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
      client_x509_cert_url:
        process.env.FIREBASE_CLIENT_X509_CERT_URL,
    };

    // --------------------------------------------------------
    // Validate required Firebase configuration
    // --------------------------------------------------------

    const requiredVariables = [
      ["FIREBASE_PROJECT_ID", serviceAccount.project_id],
      ["FIREBASE_CLIENT_EMAIL", serviceAccount.client_email],
      ["FIREBASE_PRIVATE_KEY", serviceAccount.private_key],
    ];

    const missingVariables = requiredVariables
      .filter(([, value]) => !value)
      .map(([name]) => name);

    if (missingVariables.length > 0) {
      throw new Error(
        `Missing Firebase environment variables: ${missingVariables.join(
          ", "
        )}`
      );
    }

    // --------------------------------------------------------
    // Initialize Firebase Admin
    // --------------------------------------------------------

    firebaseAdmin = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log("");
    console.log("========================================");
    console.log("🔥 Firebase Admin Initialized");
    console.log("========================================");
    console.log(
      `📦 Project: ${process.env.FIREBASE_PROJECT_ID}`
    );
    console.log("========================================");
    console.log("");
  } catch (error) {
    console.error("");
    console.error("========================================");
    console.error("❌ Firebase Admin Initialization Failed");
    console.error("========================================");
    console.error("Message:", error.message);
    console.error("========================================");
    console.error("");

    throw error;
  }
}

// ==========================================================
// EXPORT FIREBASE ADMIN APP
// ==========================================================

module.exports = firebaseAdmin;