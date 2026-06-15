import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";

// ── Custom Error Class ───────────────────────────────────
export class AppError extends Error {
  statusCode: number;
  status: string;
  isOperational: boolean;
  code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.status = statusCode >= 400 && statusCode < 500 ? "fail" : "error";
    this.isOperational = true;
    this.code = code;

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

// ── Error Response Interface ─────────────────────────────
interface ErrorResponse {
  success: false;
  status: string;
  message: string;
  code?: string;
  errors?: Record<string, string>;
  stack?: string;
}

// ── Handle Specific Error Types ──────────────────────────

// MongoDB duplicate key error (e.g. duplicate email)
const handleDuplicateKeyError = (
  err: mongoose.mongo.MongoServerError
): AppError => {
  const field = Object.keys(err.keyValue || {})[0];
  const value = err.keyValue?.[field];
  const message = `${field} '${value}' already exists. Please use a different value.`;
  return new AppError(message, 409, "DUPLICATE_KEY");
};

// Mongoose validation error
const handleValidationError = (
  err: mongoose.Error.ValidationError
): AppError => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Validation failed: ${errors.join(". ")}`;
  return new AppError(message, 400, "VALIDATION_ERROR");
};

// Mongoose cast error (e.g. invalid ObjectId)
const handleCastError = (
  err: mongoose.Error.CastError
): AppError => {
  const message = `Invalid ${err.path}: '${err.value}' is not a valid ID.`;
  return new AppError(message, 400, "INVALID_ID");
};

// JWT expired
const handleJWTExpiredError = (): AppError => {
  return new AppError(
    "Your session has expired. Please login again.",
    401,
    "TOKEN_EXPIRED"
  );
};

// JWT invalid
const handleJWTError = (): AppError => {
  return new AppError(
    "Invalid token. Please login again.",
    401,
    "TOKEN_INVALID"
  );
};