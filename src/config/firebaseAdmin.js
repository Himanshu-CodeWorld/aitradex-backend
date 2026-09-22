require("dotenv").config();

const {
  initializeApp,
  getApps,
  getApp,
  cert,
} = require("firebase-admin/app");

// ==========================================================
// FIREBASE ADMIN CONFIGURATION
// ==========================================================

const projectId = process.env.FIREBASE_PROJECT_ID;

const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

const privateKey = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
  : null;

// ==========================================================
// VALIDATE ENVIRONMENT VARIABLES
// ==========================================================

const missingVariables = [];

if (!projectId) {
  missingVariables.push("FIREBASE_PROJECT_ID");
}

if (!clientEmail) {
  missingVariables.push("FIREBASE_CLIENT_EMAIL");
}

if (!privateKey) {
  missingVariables.push("FIREBASE_PRIVATE_KEY");
}

if (missingVariables.length > 0) {
  console.error("");
  console.error("========================================");
  console.error("❌ FIREBASE CONFIGURATION ERROR");
  console.error("========================================");
  console.error(
    "Missing variables:",
    missingVariables.join(", ")
  );
  console.error("========================================");
  console.error("");

  throw new Error(
    `Missing Firebase environment variables: ${missingVariables.join(
      ", "
    )}`
  );
}

// ==========================================================
// FIREBASE ADMIN INITIALIZATION
// ==========================================================

let firebaseApp;

try {
  // --------------------------------------------------------
  // Reuse existing Firebase Admin app
  // --------------------------------------------------------

  if (getApps().length > 0) {
    firebaseApp = getApp();

    console.log("");
    console.log("========================================");
    console.log("🔥 Firebase Admin Already Initialized");
    console.log("========================================");
    console.log("📦 Project:", projectId);
    console.log("========================================");
    console.log("");
  } else {
    // ------------------------------------------------------
    // Initialize Firebase Admin
    // ------------------------------------------------------

    firebaseApp = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });

    console.log("");
    console.log("========================================");
    console.log("🔥 Firebase Admin Initialized");
    console.log("========================================");
    console.log("📦 Project:", projectId);
    console.log("========================================");
    console.log("");
  }
} catch (error) {
  console.error("");
  console.error("========================================");
  console.error("❌ FIREBASE ADMIN INITIALIZATION FAILED");
  console.error("========================================");
  console.error("Message:", error.message);
  console.error("========================================");
  console.error("");

  throw error;
}

// ==========================================================
// EXPORT FIREBASE ADMIN APP
// ==========================================================

module.exports = firebaseApp;