// server.js

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const connectDB = require("./src/config/db");

// ==========================================================
// ROUTES
// ==========================================================

const authRoutes = require("./src/routes/auth.routes");
const userRoutes = require("./src/routes/user.routes");
const aiRoutes = require("./src/routes/ai.routes");

// ==========================================================
// APP INITIALIZATION
// ==========================================================

const app = express();

const PORT = process.env.PORT || 10000;

// ==========================================================
// SECURITY / CORS
// ==========================================================

app.use(
  cors({
    origin: "*",
    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);

app.use(helmet());

// ==========================================================
// LOGGING
// ==========================================================

app.use(morgan("dev"));

// ==========================================================
// BODY PARSERS
// ==========================================================

app.use(
  express.json({
    limit: "2mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "2mb",
  })
);

// ==========================================================
// COOKIE PARSER
// ==========================================================

app.use(cookieParser());

// ==========================================================
// HEALTH CHECK
// ==========================================================

app.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "AiTradeX Backend API is running",
    environment:
      process.env.NODE_ENV || "development",
  });
});

// ==========================================================
// API ROUTES
// ==========================================================

console.log("");
console.log("========================================");
console.log("📦 Loading API Routes");
console.log("========================================");

// ==========================================================
// AUTH ROUTES
// ==========================================================
//
// Base URL:
// /api/auth
//
// Examples:
// POST /api/auth/...
// ==========================================================

app.use(
  "/api/auth",
  authRoutes
);

console.log(
  "✅ Auth Routes Loaded"
);

// ==========================================================
// USER ROUTES
// ==========================================================
//
// Base URL:
// /api/users
//
// Firebase authentication middleware is handled
// inside the relevant user routes.
// ==========================================================

app.use(
  "/api/users",
  userRoutes
);

console.log(
  "✅ User Routes Loaded"
);

// ==========================================================
// AI ROUTES
// ==========================================================
//
// Base URL:
// /api/ai
//
// Chat endpoint:
// POST /api/ai/chat
//
// Authentication:
// Authorization: Bearer <Firebase ID Token>
//
// Flow:
//
// Flutter
//    ↓
// Firebase ID Token
//    ↓
// firebaseAuth.middleware.js
//    ↓
// ai.controller.js
//    ↓
// Groq API
//    ↓
// MongoDB
//    ↓
// Flutter
// ==========================================================

app.use(
  "/api/ai",
  aiRoutes
);

console.log(
  "✅ AI Routes Loaded"
);

console.log("========================================");
console.log("");

// ==========================================================
// 404 HANDLER
// ==========================================================

app.use((req, res) => {
  console.log("");
  console.log("========================================");
  console.log("❌ ROUTE NOT FOUND");
  console.log("========================================");
  console.log("METHOD :", req.method);
  console.log("URL    :", req.originalUrl);
  console.log("========================================");
  console.log("");

  return res.status(404).json({
    success: false,
    message: "Route not found",
    method: req.method,
    path: req.originalUrl,
  });
});

// ==========================================================
// GLOBAL ERROR HANDLER
// ==========================================================

app.use(
  (error, req, res, next) => {
    console.error("");
    console.error("========================================");
    console.error("❌ GLOBAL SERVER ERROR");
    console.error("========================================");
    console.error(
      "Message:",
      error.message
    );
    console.error(
      "Stack:",
      error.stack
    );
    console.error("========================================");
    console.error("");

    return res.status(
      error.status || 500
    ).json({
      success: false,
      message:
        error.message ||
        "Internal server error.",
    });
  }
);

// ==========================================================
// START SERVER
// ==========================================================

const startServer = async () => {
  try {
    // ======================================================
    // CONNECT MONGODB
    // ======================================================

    await connectDB();

    console.log("");
    console.log("========================================");
    console.log("🚀 AiTradeX Backend Started");
    console.log("========================================");
    console.log(
      `🌐 Server      : http://localhost:${PORT}`
    );
    console.log(
      `📦 Environment : ${
        process.env.NODE_ENV ||
        "development"
      }`
    );
    console.log(
      "🤖 AI Provider : Groq"
    );
    console.log(
      "🧠 AI Model    : openai/gpt-oss-120b"
    );
    console.log("========================================");
    console.log("");

    // ======================================================
    // START EXPRESS SERVER
    // ======================================================

    app.listen(
      PORT,
      "0.0.0.0",
      () => {
        console.log(
          `🚀 Server listening on port ${PORT}`
        );
      }
    );
  } catch (error) {
    console.error("");
    console.error("========================================");
    console.error("❌ SERVER STARTUP FAILED");
    console.error("========================================");
    console.error(
      "Message:",
      error.message
    );
    console.error(
      "Stack:",
      error.stack
    );
    console.error("========================================");
    console.error("");

    process.exit(1);
  }
};

// ==========================================================
// START APPLICATION
// ==========================================================

startServer();