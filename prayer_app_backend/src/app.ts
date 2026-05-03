import express, { Application, Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import connectDB from "./config/db";
import initializeFirebase from "./config/firebase";

// Routes
import authRoutes from "./routes/auth.routes";
import prayerRoutes from "./routes/prayer.routes";
import userRoutes from "./routes/user.routes";
import notificationRoutes from "./routes/notification.routes";

// Load env variables
dotenv.config();

// Initialize express
const app: Application = express();

// Connect to MongoDB
connectDB();

// Initialize Firebase
initializeFirebase();

// ── Middleware ──────────────────────────────────────────
app.use(helmet());

app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? ["https://yourdomain.com"]
        : ["http://localhost:3000", "http://localhost:8081"],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ── Health Check ────────────────────────────────────────
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Prayer App API is running",
    environment: process.env.NODE_ENV,
    database:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes ──────────────────────────────────────────
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/prayer", prayerRoutes);
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/notifications", notificationRoutes);

// ── 404 Handler ─────────────────────────────────────────
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

// ── Global Error Handler ────────────────────────────────
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(`Global error: ${err.message}`);
  console.error(err.stack);

  res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
  });
});

// ── Start Server ────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`
  🕌 Prayer App Server Running
  ─────────────────────────────
  Environment : ${process.env.NODE_ENV}
  Port        : ${PORT}
  API Base    : http://localhost:${PORT}/api/v1
  Health      : http://localhost:${PORT}/health
  `);
});

// ── Graceful Shutdown ───────────────────────────────────
process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    mongoose.connection.close().then(() => {
      console.log("MongoDB connection closed.");
      process.exit(0);
    });
  });
});

process.on("unhandledRejection", (reason: Error) => {
  console.error(`Unhandled Rejection: ${reason.message}`);
  server.close(() => {
    process.exit(1);
  });
});

process.on("uncaughtException", (error: Error) => {
  console.error(`Uncaught Exception: ${error.message}`);
  process.exit(1);
});

export default app;