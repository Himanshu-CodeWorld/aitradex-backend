// ==========================================================
// AiTradeX Backend - server.js
// ==========================================================

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

// ==========================================================
// DATABASE
// ==========================================================

const connectDB = require("./src/config/db");

// ==========================================================
// ROUTES
// ==========================================================

const authRoutes = require("./src/routes/auth.routes");
const userRoutes = require("./src/routes/user.routes");
const aiRoutes = require("./src/routes/ai.routes");
const upstoxRoutes = require("./src/upstox/upstox.routes");

// ==========================================================
// APP INITIALIZATION
// ==========================================================

const app = express();

const PORT = Number(process.env.PORT) || 10000;

const NODE_ENV =
  process.env.NODE_ENV || "development";

// ==========================================================
// BASIC APP CONFIGURATION
// ==========================================================

app.disable("x-powered-by");

// ==========================================================
// TRUST PROXY
// ==========================================================
//
// Render runs the application behind a reverse proxy.
// This allows Express to correctly understand HTTPS requests
// coming through Render.
//

if (NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

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
      "Accept",
    ],
  })
);

// ==========================================================
// HELMET
// ==========================================================

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

// ==========================================================
// LOGGING
// ==========================================================

app.use(
  morgan(
    NODE_ENV === "production"
      ? "combined"
      : "dev"
  )
);

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
// STARTUP INFORMATION
// ==========================================================

console.log("");
console.log("========================================");
console.log("🔥 AiTradeX Backend Initializing");
console.log("========================================");
console.log(
  `📦 Environment : ${NODE_ENV}`
);
console.log(
  `🔌 Port        : ${PORT}`
);
console.log(
  `🟢 Upstox      : ${
    process.env.UPSTOX_CLIENT_ID
      ? "Configured"
      : "Not Configured"
  }`
);
console.log("========================================");
console.log("");

// ==========================================================
// HEALTH CHECK
// ==========================================================

app.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "AiTradeX Backend API is running",
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ==========================================================
// API HEALTH CHECK
// ==========================================================

app.get("/api/health", (req, res) => {
  return res.status(200).json({
    success: true,
    service: "AiTradeX Backend",
    status: "healthy",
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ==========================================================
// API ROUTES
// ==========================================================

console.log("========================================");
console.log("📦 Loading API Routes");
console.log("========================================");

// ==========================================================
// AUTH ROUTES
// ==========================================================
//
// Base:
// /api/auth
//
// Examples:
// POST /api/auth/...
//
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
// Base:
// /api/users
//
// Firebase authentication middleware is handled
// inside the relevant user routes.
//
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
// Base:
// /api/ai
//
// Example:
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
// Firebase Auth Middleware
//    ↓
// AI Controller
//    ↓
// Groq API
//    ↓
// MongoDB
//    ↓
// Flutter
//
// ==========================================================

app.use(
  "/api/ai",
  aiRoutes
);

console.log(
  "✅ AI Routes Loaded"
);

// ==========================================================
// UPSTOX ROUTES
// ==========================================================
//
// Base:
// /api/upstox
//
// OAuth Login:
// GET /api/upstox/login
//
// OAuth Callback:
// GET /api/upstox/callback
//
// Future Market Data:
// GET /api/upstox/quote
// GET /api/upstox/ohlc
// etc.
//
// Flow:
//
// Flutter / Browser
//        ↓
// /api/upstox/login
//        ↓
// Upstox Login
//        ↓
// /api/upstox/callback
//        ↓
// Authorization Code
//        ↓
// Upstox Token API
//        ↓
// Access Token
//
// ==========================================================

app.use(
  "/api/upstox",
  upstoxRoutes
);

console.log(
  "✅ Upstox Routes Loaded"
);

// ==========================================================
// ROUTE INFORMATION
// ==========================================================

console.log("========================================");
console.log("📍 Registered API Routes");
console.log("========================================");
console.log(
  "🔐 Auth   : /api/auth"
);
console.log(
  "👤 Users  : /api/users"
);
console.log(
  "🤖 AI     : /api/ai"
);
console.log(
  "📈 Upstox : /api/upstox"
);
console.log("========================================");
console.log("");

// ==========================================================
// 404 HANDLER
// ==========================================================
//
// IMPORTANT:
// This must remain AFTER all API routes.
//

app.use((req, res) => {
  console.log("");
  console.log("========================================");
  console.log("❌ ROUTE NOT FOUND");
  console.log("========================================");
  console.log("METHOD :", req.method);
  console.log("URL    :", req.originalUrl);
  console.log("IP     :", req.ip);
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
//
// IMPORTANT:
// This must remain the LAST middleware.
//

app.use(
  (error, req, res, next) => {
    console.error("");
    console.error("========================================");
    console.error("❌ GLOBAL SERVER ERROR");
    console.error("========================================");
    console.error(
      "Method :",
      req.method
    );
    console.error(
      "URL    :",
      req.originalUrl
    );
    console.error(
      "Message:",
      error.message
    );
    console.error(
      "Stack  :",
      error.stack
    );
    console.error("========================================");
    console.error("");

    const statusCode =
      Number(error.status) ||
      Number(error.statusCode) ||
      500;

    return res.status(statusCode).json({
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
    // ENVIRONMENT VALIDATION
    // ======================================================

    console.log(
      "🔍 Checking environment configuration..."
    );

    if (!process.env.MONGODB_URI) {
      console.warn(
        "⚠️ MONGODB_URI is not configured."
      );
    }

    if (!process.env.FIREBASE_PROJECT_ID) {
      console.warn(
        "⚠️ Firebase environment variables may not be configured."
      );
    }

    if (!process.env.UPSTOX_CLIENT_ID) {
      console.warn(
        "⚠️ UPSTOX_CLIENT_ID is not configured."
      );
    }

    if (!process.env.UPSTOX_CLIENT_SECRET) {
      console.warn(
        "⚠️ UPSTOX_CLIENT_SECRET is not configured."
      );
    }

    if (!process.env.UPSTOX_REDIRECT_URI) {
      console.warn(
        "⚠️ UPSTOX_REDIRECT_URI is not configured."
      );
    }

    // ======================================================
    // CONNECT MONGODB
    // ======================================================

    console.log("");
    console.log(
      "🔌 Connecting to MongoDB..."
    );

    await connectDB();

    console.log(
      "✅ MongoDB Connected"
    );

    // ======================================================
    // SERVER INFORMATION
    // ======================================================

    console.log("");
    console.log("========================================");
    console.log("🚀 AiTradeX Backend Started");
    console.log("========================================");
    console.log(
      `🌐 Environment : ${NODE_ENV}`
    );
    console.log(
      `🔌 Port        : ${PORT}`
    );
    console.log(
      "🤖 AI Provider : Groq"
    );
    console.log(
      "🧠 AI Model    : openai/gpt-oss-120b"
    );

    console.log(
      `📈 Upstox      : ${
        process.env.UPSTOX_CLIENT_ID
          ? "Enabled"
          : "Disabled"
      }`
    );

    console.log("========================================");
    console.log("");

    // ======================================================
    // START EXPRESS SERVER
    // ======================================================

    const server = app.listen(
      PORT,
      "0.0.0.0",
      () => {
        console.log("========================================");
        console.log(
          `🚀 Server listening on port ${PORT}`
        );
        console.log(
          `🏠 Local      : http://localhost:${PORT}`
        );

        if (process.env.RENDER_EXTERNAL_URL) {
          console.log(
            `🌍 Render     : ${process.env.RENDER_EXTERNAL_URL}`
          );
        }

        console.log(
          `❤️ Health     : /api/health`
        );
        console.log(
          `📈 Upstox     : /api/upstox/login`
        );
        console.log("========================================");
        console.log("");
      }
    );

    // ======================================================
    // SERVER ERROR HANDLING
    // ======================================================

    server.on(
      "error",
      (error) => {
        console.error("");
        console.error(
          "========================================"
        );
        console.error(
          "❌ HTTP SERVER ERROR"
        );
        console.error(
          "========================================"
        );
        console.error(
          "Message:",
          error.message
        );
        console.error(
          "Code:",
          error.code
        );
        console.error(
          "========================================"
        );
        console.error("");

        process.exit(1);
      }
    );
  } catch (error) {
    // ======================================================
    // STARTUP ERROR
    // ======================================================

    console.error("");
    console.error(
      "========================================"
    );
    console.error(
      "❌ SERVER STARTUP FAILED"
    );
    console.error(
      "========================================"
    );
    console.error(
      "Message:",
      error.message
    );
    console.error(
      "Stack:",
      error.stack
    );
    console.error(
      "========================================"
    );
    console.error("");

    process.exit(1);
  }
};

// ==========================================================
// START APPLICATION
// ==========================================================

startServer();