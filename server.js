require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const path = require("path");

const connectDB = require("./src/config/db");

// ============================================================
// Route Imports
// ============================================================

const authRoutes = require("./src/routes/auth.routes");
const userRoutes = require("./src/routes/user.routes");
const uploadRoutes = require("./src/routes/upload.routes");
const kycRoutes = require("./src/routes/kyc.routes");

// ============================================================
// App Initialization
// ============================================================

const app = express();

// ============================================================
// Security & Middleware
// ============================================================

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  })
);

app.use(morgan("dev"));

app.use(cookieParser());

// ============================================================
// Body Parsers
// ============================================================

app.use(
  express.json({
    limit: "20mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "20mb",
  })
);

// ============================================================
// Static Files
// ============================================================

app.use(
  express.static(path.join(__dirname, "public"))
);

// ============================================================
// Captcha Page
// ============================================================

app.get("/captcha", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "captcha.html")
  );
});

// ============================================================
// Health Check
// ============================================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    app: "AiTradeX Backend API",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    message: "🚀 Server is running successfully",
  });
});

// ============================================================
// API Routes
// ============================================================

/*
|--------------------------------------------------------------------------
| Authentication
|--------------------------------------------------------------------------
| /api/auth/*
|
| Examples:
| POST /api/auth/send-otp
| POST /api/auth/verify-otp
| POST /api/auth/resend-otp
|--------------------------------------------------------------------------
*/

app.use("/api/auth", authRoutes);

/*
|--------------------------------------------------------------------------
| Users
|--------------------------------------------------------------------------
| /api/users/*
|
| Examples:
| POST /api/users
| GET  /api/users/firebase/:firebaseUid
|--------------------------------------------------------------------------
*/

app.use("/api/users", userRoutes);

/*
|--------------------------------------------------------------------------
| Uploads
|--------------------------------------------------------------------------
| /api/upload/*
|--------------------------------------------------------------------------
*/

app.use("/api/upload", uploadRoutes);

/*
|--------------------------------------------------------------------------
| KYC
|--------------------------------------------------------------------------
| /api/kyc/*
|--------------------------------------------------------------------------
*/

app.use("/api/kyc", kycRoutes);

// ============================================================
// 404 Handler
// ============================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
    method: req.method,
  });
});

// ============================================================
// Global Error Handler
// ============================================================

app.use((err, req, res, next) => {
  console.error("\n========================================");
  console.error("❌ Global Error");
  console.error("========================================");
  console.error("Message:", err.message);
  console.error("Stack:", err.stack);
  console.error("========================================\n");

  const statusCode = err.status || err.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    message:
      err.message || "Internal Server Error",
  });
});

// ============================================================
// Server Configuration
// ============================================================

const PORT = process.env.PORT || 5000;

// ============================================================
// Start Server
// ============================================================

const startServer = async () => {
  try {
    console.log("\n========================================");
    console.log("🚀 Starting AiTradeX Backend...");
    console.log("========================================");

    // --------------------------------------------------------
    // Connect MongoDB
    // --------------------------------------------------------

    await connectDB();

    // --------------------------------------------------------
    // Verify MongoDB connection
    // --------------------------------------------------------

    if (mongoose.connection.readyState !== 1) {
      throw new Error(
        "MongoDB connection was not established."
      );
    }

    console.log("✅ MongoDB connected successfully");

    // --------------------------------------------------------
    // Start Express server
    // --------------------------------------------------------

    app.listen(PORT, "0.0.0.0", () => {
      console.log("\n========================================");
      console.log("🚀 AiTradeX Backend Started");
      console.log("========================================");
      console.log(`🌐 Port        : ${PORT}`);
      console.log(
        `📦 Environment : ${
          process.env.NODE_ENV || "development"
        }`
      );
      console.log(
        `💾 MongoDB     : Connected`
      );
      console.log("========================================\n");
    });
  } catch (error) {
    console.error("\n========================================");
    console.error("❌ Failed to start AiTradeX Backend");
    console.error("========================================");
    console.error(error);
    console.error("========================================\n");

    process.exit(1);
  }
};

// ============================================================
// Start Application
// ============================================================

startServer();

// ============================================================
// Graceful Shutdown
// ============================================================

const gracefulShutdown = async (signal) => {
  try {
    console.log(`\n🛑 ${signal} received.`);

    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();

      console.log(
        "✅ MongoDB connection closed."
      );
    }

    console.log("🛑 AiTradeX Backend stopped.");

    process.exit(0);
  } catch (error) {
    console.error(
      "❌ Error during graceful shutdown:",
      error
    );

    process.exit(1);
  }
};

process.on("SIGINT", () => {
  gracefulShutdown("SIGINT");
});

process.on("SIGTERM", () => {
  gracefulShutdown("SIGTERM");
});