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

// ==========================================================
// MIDDLEWARE
// ==========================================================

app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

app.use(helmet());

app.use(morgan("dev"));

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use(cookieParser());

// ==========================================================
// HEALTH CHECK
// ==========================================================

app.get("/", (req, res) => {
  res.status(200).json({
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

// Authentication
app.use(
  "/api/auth",
  authRoutes
);

console.log("✅ Auth Routes Loaded");

// Users
app.use(
  "/api/users",
  userRoutes
);

console.log("✅ User Routes Loaded");

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
  (
    error,
    req,
    res,
    next
  ) => {
    console.error("");
    console.error("========================================");
    console.error("❌ GLOBAL SERVER ERROR");
    console.error("========================================");
    console.error("Message:", error.message);
    console.error("Stack:", error.stack);
    console.error("========================================");

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
    await connectDB();

    console.log("");
    console.log("========================================");
    console.log("🚀 AiTradeX Backend Started");
    console.log(
      `🌐 Server: http://localhost:${PORT}`
    );
    console.log(
      `📦 Environment: ${
        process.env.NODE_ENV ||
        "development"
      }`
    );
    console.log("========================================");
    console.log("");

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
    console.error(
      "❌ Server startup failed:",
      error
    );

    process.exit(1);
  }
};

startServer();