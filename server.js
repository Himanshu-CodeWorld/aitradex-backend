require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const connectDB = require("./src/config/db");

const authRoutes = require("./src/routes/auth.routes");
const userRoutes = require("./src/routes/user.routes");

const app = express();

const PORT = process.env.PORT || 10000;

// ===============================================
// Middleware
// ===============================================

app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ===============================================
// Health Check
// ===============================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "AiTradeX Backend API is running",
    environment: process.env.NODE_ENV || "development",
  });
});

// ===============================================
// API Routes
// ===============================================

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);

// ===============================================
// 404
// ===============================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// ===============================================
// Start Server
// ===============================================

const startServer = async () => {
  try {
    await connectDB();

    console.log("");
    console.log("========================================");
    console.log("🚀 AiTradeX Backend Started");
    console.log(`🌐 Server      : http://localhost:${PORT}`);
    console.log(`📦 Environment : ${process.env.NODE_ENV || "development"}`);
    console.log("========================================");
    console.log("");

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Server startup failed:", error);
    process.exit(1);
  }
};

startServer();