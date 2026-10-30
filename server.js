
// ==========================================================
// AiTradeX Backend - server.js
// ==========================================================
"use strict";

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");

const connectDB = require("./src/config/db");

// Routes
const authRoutes = require("./src/routes/auth.routes");
const userRoutes = require("./src/routes/user.routes");
const aiRoutes = require("./src/routes/ai.routes");
const upstoxRoutes = require("./src/upstox/upstox.routes");
const coinRoutes = require("./src/routes/coin.routes");
const coinPaymentRoutes = require("./src/routes/coinPayment.routes");
const referralRoutes = require("./src/routes/referral.routes");
const profileUploadRoutes = require("./src/routes/profileUpload.routes");
const tradingRoutes = require("./src/trading-engine/trading.routes");
const firebaseAuthMiddleware = require("./src/middleware/firebaseAuth.middleware");

const app = express();

const PORT = Number(process.env.PORT) || 10000;
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PRODUCTION = NODE_ENV === "production";

app.disable("x-powered-by");

if (IS_PRODUCTION) {
  app.set("trust proxy", 1);
}

// ==========================================================
// CORS
// ==========================================================

const configuredOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((value) => value.trim().replace(/\/+$/, ""))
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);

      if (configuredOrigins.length === 0) {
        return callback(null, true);
      }

      const normalizedOrigin = origin.trim().replace(/\/+$/, "");

      if (configuredOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      const error = new Error("CORS origin not allowed");
      error.status = 403;

      return callback(error);
    },

    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "Origin",
      "X-Requested-With",
    ],

    exposedHeaders: ["Content-Length", "Content-Type"],
    optionsSuccessStatus: 204,
  })
);

// ==========================================================
// SECURITY, LOGGING AND PARSERS
// ==========================================================

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

app.use(morgan(IS_PRODUCTION ? "combined" : "dev"));

app.use(express.json({ limit: "2mb" }));

app.use(
  express.urlencoded({
    extended: true,
    limit: "2mb",
  })
);

app.use(cookieParser());

// Development-only request logging.
if (!IS_PRODUCTION) {
  app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.originalUrl}`);
    next();
  });
}

// ==========================================================
// STARTUP BANNER
// ==========================================================

console.log("\n========================================");
console.log(" AiTradeX Backend Initializing");
console.log("========================================");

console.log(`Environment : ${NODE_ENV}`);
console.log(`Port        : ${PORT}`);

console.log(
  `MongoDB URI : ${
    process.env.MONGODB_URI ? "Configured" : "Missing"
  }`
);

console.log(
  `Firebase    : ${
    process.env.FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_SERVICE_ACCOUNT
      ? "Configured"
      : "Check configuration"
  }`
);

console.log(
  `Groq        : ${
    process.env.GROQ_API_KEY ? "Configured" : "Missing"
  }`
);

console.log(
  `Upstox      : ${
    process.env.UPSTOX_CLIENT_ID ? "Configured" : "Missing client ID"
  }`
);

console.log("========================================\n");

// ==========================================================
// HEALTH ENDPOINTS
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

app.get("/healthz", (req, res) => {
  return res.status(200).json({
    success: true,
    status: "alive",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/health", (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;

  return res.status(databaseConnected ? 200 : 503).json({
    success: databaseConnected,
    service: "AiTradeX Backend",
    status: databaseConnected ? "healthy" : "not_ready",
    environment: NODE_ENV,

    database: databaseConnected ? "connected" : "disconnected",

    coinSystem: {
      enabled: true,
      coinValueInr: 1,
      stockUnlockCost: 100,
    },

    ai: {
      provider: "Groq",
      configured: Boolean(process.env.GROQ_API_KEY),
    },

    marketData: {
      provider: "Upstox",
      configured: Boolean(process.env.UPSTOX_CLIENT_ID),
    },

    timestamp: new Date().toISOString(),
  });
});

// ==========================================================
// API ROUTES
// ==========================================================

console.log("========================================");
console.log("Loading AiTradeX API Routes");
console.log("========================================");

// AUTH
app.use("/api/auth", authRoutes);
console.log("Auth routes       : /api/auth");

// USERS
app.use("/api/users", userRoutes);
console.log("User routes       : /api/users");

// AI CHATBOT
// Uses AiChat as the only chatbot history model.
app.use("/api/ai", aiRoutes);
console.log("AI routes         : /api/ai");
console.log("  POST   /api/ai/chat");
console.log("  GET    /api/ai/chats");
console.log("  GET    /api/ai/chats/:chatId");
console.log("  DELETE /api/ai/chats/:chatId");

// UPSTOX
app.use("/api/upstox", upstoxRoutes);
console.log("Upstox routes     : /api/upstox");

// PROFILE UPLOAD
app.use("/api/upload", profileUploadRoutes);
console.log("Profile upload    : /api/upload");

// COINS
app.use("/api/coins", coinRoutes);
console.log("Coin routes       : /api/coins");

// COIN PAYMENTS
app.use("/api/coins/payment", coinPaymentRoutes);
console.log("Coin payments     : /api/coins/payment");

// REFERRALS
app.use("/api/referrals", referralRoutes);
console.log("Referral routes   : /api/referrals");

app.use("/api/trading", firebaseAuthMiddleware, tradingRoutes);

console.log("========================================\n");

// ==========================================================
// 404 HANDLER
// ==========================================================

app.use((req, res) => {
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

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const statusCode =
    Number(error.status) ||
    Number(error.statusCode) ||
    (error.type === "entity.too.large" ? 413 : 500);

  console.error("[SERVER ERROR]", {
    method: req.method,
    path: req.originalUrl,
    statusCode,
    message: error.message,
  });

  let message = "Internal server error.";

  if (error.message === "CORS origin not allowed") {
    message = "CORS origin not allowed.";
  } else if (error.type === "entity.too.large") {
    message = "Request payload is too large.";
  } else if (!IS_PRODUCTION && error.message) {
    message = error.message;
  }

  const response = {
    success: false,
    message,
  };

  if (!IS_PRODUCTION && error.stack) {
    response.stack = error.stack;
  }

  return res.status(statusCode).json(response);
});

// ==========================================================
// ENVIRONMENT VALIDATION
// ==========================================================

function validateEnvironment() {
  const warnings = [];

  if (!process.env.MONGODB_URI) {
    warnings.push("MONGODB_URI is not configured.");
  }

  if (
    !process.env.FIREBASE_PROJECT_ID &&
    !process.env.FIREBASE_SERVICE_ACCOUNT
  ) {
    warnings.push("Firebase environment configuration was not detected.");
  }

  if (!process.env.GROQ_API_KEY) {
    warnings.push("GROQ_API_KEY is not configured; AI chat will not work.");
  }

  if (!process.env.UPSTOX_CLIENT_ID) {
    warnings.push("UPSTOX_CLIENT_ID is not configured.");
  }

  if (!process.env.UPSTOX_CLIENT_SECRET) {
    warnings.push("UPSTOX_CLIENT_SECRET is not configured.");
  }

  if (!process.env.UPSTOX_REDIRECT_URI) {
    warnings.push("UPSTOX_REDIRECT_URI is not configured.");
  }

  if (!process.env.REFERRAL_REWARD_COINS) {
    console.log("Referral reward default: 250 coins.");
  }

  if (warnings.length > 0) {
    console.warn("\nEnvironment warnings:");

    warnings.forEach((warning) => {
      console.warn(`- ${warning}`);
    });

    console.warn("");
  }
}

// ==========================================================
// SERVER STARTUP
// ==========================================================

let server = null;
let isShuttingDown = false;

async function startServer() {
  try {
    console.log("Checking environment configuration...");

    validateEnvironment();

    if (!process.env.MONGODB_URI) {
      throw new Error(
        "MONGODB_URI is required. Server startup cancelled."
      );
    }

    console.log("Connecting to MongoDB Atlas...");

    await connectDB();

    if (mongoose.connection.readyState !== 1) {
      throw new Error(
        "MongoDB connection did not reach the connected state."
      );
    }

    console.log("MongoDB Atlas connected successfully.");

    server = app.listen(PORT, "0.0.0.0", () => {
      console.log("\n========================================");
      console.log("AiTradeX Backend Started");
      console.log("========================================");

      console.log(`Environment : ${NODE_ENV}`);
      console.log(`Port        : ${PORT}`);
      console.log(`Local       : http://localhost:${PORT}`);

      if (process.env.RENDER_EXTERNAL_URL) {
        console.log(`Render URL  : ${process.env.RENDER_EXTERNAL_URL}`);
      }

      console.log("Health      : /api/health");
      console.log("AI Chat     : /api/ai/chat");
      console.log("Chat History: /api/ai/chats");
      console.log("Upstox      : /api/upstox");

      console.log("========================================\n");
    });

    server.on("error", (error) => {
      console.error("[HTTP SERVER ERROR]", error.message);

      if (error.code === "EADDRINUSE") {
        console.error(`Port ${PORT} is already in use.`);
      }

      process.exitCode = 1;
      void gracefulShutdown("HTTP_SERVER_ERROR");
    });
  } catch (error) {
    console.error("\n========================================");
    console.error("AiTradeX server startup failed");
    console.error("========================================");

    console.error(error.message);

    if (!IS_PRODUCTION && error.stack) {
      console.error(error.stack);
    }

    console.error("========================================");

    process.exitCode = 1;

    await gracefulShutdown("STARTUP_FAILURE");
  }
}

// ==========================================================
// GRACEFUL SHUTDOWN
// ==========================================================

async function gracefulShutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.log(`\n${signal} received. Shutting down AiTradeX...`);

  const forceExit = setTimeout(() => {
    console.error("Forced shutdown after 10 seconds.");
    process.exit(1);
  }, 10000);

  forceExit.unref();

  try {
    if (server) {
      await new Promise((resolve) => {
        server.close((error) => {
          if (error) {
            console.error("HTTP close error:", error.message);
          } else {
            console.log("HTTP server closed.");
          }

          resolve();
        });
      });

      server = null;
    }

    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log("MongoDB connection closed.");
    }

    clearTimeout(forceExit);

    console.log("AiTradeX shutdown complete.");

    if (signal === "SIGTERM" || signal === "SIGINT") {
      process.exit(0);
    }
  } catch (error) {
    console.error("Shutdown error:", error.message);

    clearTimeout(forceExit);
    process.exit(1);
  }
}

// ==========================================================
// PROCESS SIGNALS
// ==========================================================

process.on("SIGTERM", () => {
  void gracefulShutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void gracefulShutdown("SIGINT");
});

// ==========================================================
// PROCESS ERROR HANDLERS
// ==========================================================

process.on("unhandledRejection", (reason) => {
  console.error("[UNHANDLED PROMISE REJECTION]", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[UNCAUGHT EXCEPTION]", error);

  process.exitCode = 1;

  void gracefulShutdown("UNCAUGHT_EXCEPTION");
});

// ==========================================================
// START APPLICATION
// ==========================================================

void startServer();

module.exports = {
  app,
  startServer,
};
