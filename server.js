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

const IS_PRODUCTION =
  NODE_ENV === "production";

// ==========================================================
// BASIC APP CONFIGURATION
// ==========================================================

app.disable("x-powered-by");

if (IS_PRODUCTION) {
  // Render runs behind a reverse proxy.
  app.set("trust proxy", 1);
}

// ==========================================================
// SECURITY / CORS
// ==========================================================
//
// Flutter mobile requests generally do not send an Origin header.
// Browser requests do.
//
// We intentionally do NOT use:
//   credentials: true
//
// together with:
//   origin: "*"
//
// because browsers reject wildcard origins with credentials.
//
// Upstox OAuth uses an HTTP-only cookie on the backend and
// does not require cross-origin credentialed API requests.
//

const configuredOrigins = (
  process.env.CORS_ORIGINS || ""
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Mobile apps / Postman / server-to-server requests.
      if (!origin) {
        return callback(null, true);
      }

      // If no specific origins are configured,
      // allow browser origins.
      if (configuredOrigins.length === 0) {
        return callback(null, true);
      }

      if (configuredOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error("CORS origin not allowed")
      );
    },

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
      "Origin",
      "X-Requested-With",
    ],

    exposedHeaders: [
      "Content-Length",
      "Content-Type",
    ],

    optionsSuccessStatus: 204,
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
    IS_PRODUCTION
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
//
// Required by Upstox OAuth state validation.
//

app.use(cookieParser());

// ==========================================================
// REQUEST DEBUGGING
// ==========================================================

if (!IS_PRODUCTION) {
  app.use((req, res, next) => {
    console.log(
      `[REQUEST] ${req.method} ${req.originalUrl}`
    );

    next();
  });
}

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
  `🗄️ MongoDB     : ${
    process.env.MONGODB_URI
      ? "Configured"
      : "Not Configured"
  }`
);

console.log(
  `🔐 Firebase    : ${
    process.env.FIREBASE_PROJECT_ID
      ? "Configured"
      : "Check Config"
  }`
);

console.log(
  `🤖 Groq        : ${
    process.env.GROQ_API_KEY
      ? "Configured"
      : "Not Configured"
  }`
);

console.log(
  `📈 Upstox      : ${
    process.env.UPSTOX_CLIENT_ID
      ? "Configured"
      : "Not Configured"
  }`
);

console.log("========================================");
console.log("");

// ==========================================================
// ROOT HEALTH CHECK
// ==========================================================

app.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "AiTradeX Backend API is running",
    service: "AiTradeX Backend",
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
    database: "connected",
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
// POST /api/auth/send-otp
// POST /api/auth/verify-otp
// POST /api/auth/resend-otp
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
// OAuth:
//
// GET /api/upstox/login
// GET /api/upstox/callback
//
// Market:
//
// GET /api/upstox/market-data
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
  "🔐 Auth        : /api/auth"
);

console.log(
  "👤 Users       : /api/users"
);

console.log(
  "🤖 AI          : /api/ai"
);

console.log(
  "📈 Upstox      : /api/upstox"
);

console.log(
  "🔗 Upstox Login: /api/upstox/login"
);

console.log(
  "📊 Market Data : /api/upstox/market-data"
);

console.log("========================================");
console.log("");

// ==========================================================
// 404 HANDLER
// ==========================================================
//
// IMPORTANT:
// This MUST be after all API routes.
//

app.use((req, res) => {
  console.log("");
  console.log("========================================");
  console.log("❌ ROUTE NOT FOUND");
  console.log("========================================");

  console.log(
    "METHOD :",
    req.method
  );

  console.log(
    "URL    :",
    req.originalUrl
  );

  console.log(
    "IP     :",
    req.ip
  );

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
// This MUST remain the final middleware.
//

app.use(
  (error, req, res, next) => {
    console.error("");
    console.error(
      "========================================"
    );
    console.error(
      "❌ GLOBAL SERVER ERROR"
    );
    console.error(
      "========================================"
    );

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
      error?.message
    );

    if (error?.stack) {
      console.error(
        "Stack  :",
        error.stack
      );
    }

    console.error(
      "========================================"
    );
    console.error("");

    // CORS error
    if (
      error?.message ===
      "CORS origin not allowed"
    ) {
      return res.status(403).json({
        success: false,
        message: "CORS origin not allowed",
      });
    }

    // Express/body-parser errors
    if (
      error?.type ===
      "entity.too.large"
    ) {
      return res.status(413).json({
        success: false,
        message: "Request payload is too large.",
      });
    }

    const statusCode =
      Number(error?.status) ||
      Number(error?.statusCode) ||
      500;

    const response = {
      success: false,
      message:
        IS_PRODUCTION && statusCode === 500
          ? "Internal server error."
          : error?.message ||
            "Internal server error.",
    };

    if (!IS_PRODUCTION) {
      response.stack = error?.stack;
    }

    return res
      .status(statusCode)
      .json(response);
  }
);

// ==========================================================
// ENVIRONMENT VALIDATION
// ==========================================================

const validateEnvironment = () => {
  const warnings = [];

  // --------------------------------------------------------
  // MongoDB
  // --------------------------------------------------------

  if (!process.env.MONGODB_URI) {
    warnings.push(
      "MONGODB_URI is not configured"
    );
  }

  // --------------------------------------------------------
  // Firebase
  // --------------------------------------------------------

  if (
    !process.env.FIREBASE_PROJECT_ID &&
    !process.env.FIREBASE_SERVICE_ACCOUNT
  ) {
    warnings.push(
      "Firebase environment configuration was not detected"
    );
  }

  // --------------------------------------------------------
  // Groq
  // --------------------------------------------------------

  if (!process.env.GROQ_API_KEY) {
    warnings.push(
      "GROQ_API_KEY is not configured"
    );
  }

  // --------------------------------------------------------
  // Upstox
  // --------------------------------------------------------

  if (!process.env.UPSTOX_CLIENT_ID) {
    warnings.push(
      "UPSTOX_CLIENT_ID is not configured"
    );
  }

  if (!process.env.UPSTOX_CLIENT_SECRET) {
    warnings.push(
      "UPSTOX_CLIENT_SECRET is not configured"
    );
  }

  if (!process.env.UPSTOX_REDIRECT_URI) {
    warnings.push(
      "UPSTOX_REDIRECT_URI is not configured"
    );
  }

  // --------------------------------------------------------
  // Display warnings
  // --------------------------------------------------------

  if (warnings.length > 0) {
    console.log("");
    console.log(
      "========================================"
    );
    console.log(
      "⚠️ ENVIRONMENT WARNINGS"
    );
    console.log(
      "========================================"
    );

    warnings.forEach((warning) => {
      console.log(`⚠️ ${warning}`);
    });

    console.log(
      "========================================"
    );
    console.log("");
  }

  return warnings;
};

// ==========================================================
// START SERVER
// ==========================================================

let server = null;

const startServer = async () => {
  try {
    // ======================================================
    // ENVIRONMENT VALIDATION
    // ======================================================

    console.log(
      "🔍 Checking environment configuration..."
    );

    validateEnvironment();

    // ======================================================
    // CONNECT DATABASE
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
    console.log(
      "========================================"
    );
    console.log(
      "🚀 AiTradeX Backend Started"
    );
    console.log(
      "========================================"
    );

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

    console.log(
      "========================================"
    );

    // ======================================================
    // START EXPRESS SERVER
    // ======================================================

    server = app.listen(
      PORT,
      "0.0.0.0",
      () => {
        console.log("");
        console.log(
          "========================================"
        );

        console.log(
          `🚀 Server listening on port ${PORT}`
        );

        console.log(
          `🏠 Local      : http://localhost:${PORT}`
        );

        if (
          process.env.RENDER_EXTERNAL_URL
        ) {
          console.log(
            `🌍 Render     : ${process.env.RENDER_EXTERNAL_URL}`
          );
        }

        console.log(
          "❤️ Health     : /api/health"
        );

        console.log(
          "🔐 Auth       : /api/auth"
        );

        console.log(
          "👤 Users      : /api/users"
        );

        console.log(
          "🤖 AI         : /api/ai"
        );

        console.log(
          "📈 Upstox      : /api/upstox"
        );

        console.log(
          "🔗 Upstox Login: /api/upstox/login"
        );

        console.log(
          "📊 Market Data : /api/upstox/market-data"
        );

        console.log(
          "========================================"
        );

        console.log("");
      }
    );

    // ======================================================
    // HTTP SERVER ERROR
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
      error?.message
    );

    if (error?.stack) {
      console.error(
        "Stack:",
        error.stack
      );
    }

    console.error(
      "========================================"
    );

    console.error("");

    process.exit(1);
  }
};

// ==========================================================
// GRACEFUL SHUTDOWN
// ==========================================================

const gracefulShutdown = async (
  signal
) => {
  console.log("");
  console.log(
    `🛑 ${signal} received. Shutting down...`
  );

  if (!server) {
    process.exit(0);
  }

  server.close(() => {
    console.log(
      "✅ HTTP server closed."
    );

    process.exit(0);
  });

  // Safety timeout
  setTimeout(() => {
    console.error(
      "⚠️ Forced shutdown after timeout."
    );

    process.exit(1);
  }, 10000).unref();
};

// ==========================================================
// PROCESS ERROR HANDLERS
// ==========================================================

process.on(
  "unhandledRejection",
  (reason) => {
    console.error("");
    console.error(
      "========================================"
    );
    console.error(
      "❌ UNHANDLED PROMISE REJECTION"
    );
    console.error(
      "========================================"
    );

    console.error(reason);

    console.error(
      "========================================"
    );
    console.error("");
  }
);

process.on(
  "uncaughtException",
  (error) => {
    console.error("");
    console.error(
      "========================================"
    );
    console.error(
      "❌ UNCAUGHT EXCEPTION"
    );
    console.error(
      "========================================"
    );

    console.error(
      error?.stack || error
    );

    console.error(
      "========================================"
    );
    console.error("");

    process.exit(1);
  }
);

// ==========================================================
// SIGNAL HANDLERS
// ==========================================================

process.on(
  "SIGTERM",
  () => {
    gracefulShutdown("SIGTERM");
  }
);

process.on(
  "SIGINT",
  () => {
    gracefulShutdown("SIGINT");
  }
);

// ==========================================================
// START APPLICATION
// ==========================================================

startServer();