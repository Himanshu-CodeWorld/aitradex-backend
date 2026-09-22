// src/config/firebaseAdmin.js

const {
  initializeApp,
  getApps,
  cert,
} = require("firebase-admin/app");

const { getAuth } = require("firebase-admin/auth");

// ============================================
// Firebase Admin Configuration
// ============================================

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;

// ============================================
// Validate Environment Variables
// ============================================

if (!projectId) {
  throw new Error("❌ FIREBASE_PROJECT_ID is missing");
}

if (!clientEmail) {
  throw new Error("❌ FIREBASE_CLIENT_EMAIL is missing");
}

if (!privateKey) {
  throw new Error("❌ FIREBASE_PRIVATE_KEY is missing");
}

// ============================================
// Initialize Firebase Admin
// ============================================

let firebaseApp;

if (getApps().length === 0) {
  firebaseApp = initializeApp({
    credential: cert({
      projectId: projectId,
      clientEmail: clientEmail,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    }),
  });

  console.log("====================================");
  console.log("🔥 Firebase Admin Initialized");
  console.log("📦 Project:", projectId);
  console.log("====================================");
} else {
  firebaseApp = getApps()[0];

  console.log("🔥 Firebase Admin already initialized");
}

// ============================================
// Firebase Authentication
// ============================================

const firebaseAuth = getAuth(firebaseApp);

module.exports = {
  firebaseApp,
  firebaseAuth,
};