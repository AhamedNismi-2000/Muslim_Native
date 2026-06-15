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