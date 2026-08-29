require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const path = require("path");

const connectDB = require("./src/config/db");

// ===============================================
// Route Imports
// ===============================================

const authRoutes = require("./src/routes/auth.routes");
const userRoutes = require("./src/routes/user.routes");
const uploadRoutes = require("./src/routes/upload.routes");
const kycRoutes = require("./src/routes/kyc.routes");

// ===============================================
// App
// ===============================================

const app = express();

// ===============================================
// Static Files
// ===============================================

// Serve public folder
app.use(express.static(path.join(__dirname, "public")));

// Captcha Page
app.get("/captcha", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "captcha.html"));
});



// ===============================================
// Security & Middleware
// ===============================================

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(helmet());

app.use(morgan("dev"));

app.use(cookieParser());

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

// ===============================================
// Health Check
// ===============================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    app: "AiTradeX Backend API",
    version: "1.0.0",
    environment: process.env.NODE_ENV,
    message: "🚀 Server is running successfully",
  });
});

// ===============================================
// API Routes
// ===============================================

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/kyc", kycRoutes);

// ===============================================
// 404 Route
// ===============================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// ===============================================
// Global Error Handler
// ===============================================

app.use((err, req, res, next) => {
  console.error("========================================");
  console.error("Global Error");
  console.error(err);
  console.error("========================================");

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

// ===============================================
// Start Server
// ===============================================

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    if (require("mongoose").connection.readyState !== 1) {
      throw new Error("MongoDB not connected");
    }

    app.listen(PORT, () => {
      console.log("\n========================================");
      console.log("🚀 AiTradeX Backend Started");
      console.log(`🌐 Server      : http://localhost:${PORT}`);
      console.log(`📦 Environment : ${process.env.NODE_ENV}`);
      console.log("========================================\n");
    });
  } catch (error) {
    console.error("========================================");
    console.error("❌ Failed to start server");
    console.error(error);
    console.error("========================================");

    process.exit(1);
  }
};

startServer();

// ===============================================
// Graceful Shutdown
// ===============================================

process.on("SIGINT", () => {
  console.log("\n🛑 Server stopped.");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Server terminated.");
  process.exit(0);
});