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


// ── Dev Error Response (full details) ───────────────────
const sendDevError = (err: AppError, res: Response): void => {
  const response: ErrorResponse = {
    success: false,
    status: err.status || "error",
    message: err.message,
    code: err.code,
    stack: err.stack,
  };
  res.status(err.statusCode || 500).json(response);
};

// ── Prod Error Response (safe details only) ──────────────
const sendProdError = (err: AppError, res: Response): void => {
  // Operational errors — safe to send to client
  if (err.isOperational) {
    const response: ErrorResponse = {
      success: false,
      status: err.status,
      message: err.message,
      code: err.code,
    };
    res.status(err.statusCode).json(response);
    return;
  }

  // Unknown errors — don't leak details
  console.error("UNKNOWN ERROR:", err);
  res.status(500).json({
    success: false,
    status: "error",
    message: "Something went wrong. Please try again later.",
  });
};

// ── Mongoose Validation Error Formatter ─────────────────
export const formatValidationErrors = (
  err: mongoose.Error.ValidationError
): Record<string, string> => {
  const errors: Record<string, string> = {};
  Object.keys(err.errors).forEach((key) => {
    errors[key] = err.errors[key].message;
  });
  return errors;
};

// ── Not Found Handler ────────────────────────────────────
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const error = new AppError(
    `Route '${req.originalUrl}' not found.`,
    404,
    "ROUTE_NOT_FOUND"
  );
  next(error);
};

// ── Async Handler Wrapper ────────────────────────────────
// Wraps async controllers so we don't need try/catch in every one
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
};


// ── Global Error Handler ─────────────────────────────────
// Must have 4 parameters for Express to recognize it as error middleware
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  let error = { ...err } as AppError;
  error.message = err.message;
  error.stack = err.stack;

  // Set defaults
  if (!error.statusCode) error.statusCode = 500;
  if (!error.status) error.status = "error";
  if (error.isOperational === undefined) error.isOperational = false;

  // Log all errors in development
  if (process.env.NODE_ENV === "development") {
    console.error("─────────────────────────────────");
    console.error(`${new Date().toISOString()}`);
    console.error(`${req.method} ${req.originalUrl}`);
    console.error(`Status: ${error.statusCode}`);
    console.error(`Message: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    console.error("─────────────────────────────────");
  }

  // Map known error types to AppError
  if (err instanceof mongoose.Error.CastError) {
    error = handleCastError(err);
  }

  if (err instanceof mongoose.Error.ValidationError) {
    error = handleValidationError(err);
  }

  if (
    (err as mongoose.mongo.MongoServerError).code === 11000
  ) {
    error = handleDuplicateKeyError(
      err as mongoose.mongo.MongoServerError
    );
  }

  if (err.name === "JsonWebTokenError") {
    error = handleJWTError();
  }

  if (err.name === "TokenExpiredError") {
    error = handleJWTExpiredError();
  }

  // Send response
  if (process.env.NODE_ENV === "development") {
    sendDevError(error, res);
  } else {
    sendProdError(error, res);
  }
};

// ── Common AppError Shortcuts ────────────────────────────
export const BadRequest = (message: string, code?: string): AppError =>
  new AppError(message, 400, code || "BAD_REQUEST");

export const Unauthorized = (message: string, code?: string): AppError =>
  new AppError(message, 401, code || "UNAUTHORIZED");

export const Forbidden = (message: string, code?: string): AppError =>
  new AppError(message, 403, code || "FORBIDDEN");

export const NotFound = (message: string, code?: string): AppError =>
  new AppError(message, 404, code || "NOT_FOUND");

export const Conflict = (message: string, code?: string): AppError =>
  new AppError(message, 409, code || "CONFLICT");

export const InternalError = (message: string, code?: string): AppError =>
  new AppError(message, 500, code || "INTERNAL_ERROR");