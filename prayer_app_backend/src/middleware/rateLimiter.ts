import rateLimit, { RateLimitRequestHandler } from "express-rate-limit";
import { Request, Response } from "express";

// ── Helper: Rate Limit Response ──────────────────────────
const rateLimitHandler = (
  req: Request,
  res: Response
): void => {
  res.status(429).json({
    success: false,
    message: "Too many requests. Please try again later.",
    retryAfter: res.getHeader("Retry-After"),
  });
};

// ── Global Limiter ───────────────────────────────────────
// Applied to all routes in app.ts
export const globalLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 100,                    // 100 requests per window
  standardHeaders: true,       // Return rate limit info in headers
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests from this IP. Please try again after 15 minutes.",
  },
  handler: rateLimitHandler,
  skip: (req: Request) => {
    // Skip rate limiting for health check
    return req.path === "/health";
  },
});

// ── Auth Limiter ─────────────────────────────────────────
// Strict — applied only to /auth/login and /auth/register
export const authLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 10,                     // Only 10 auth attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skipSuccessfulRequests: true, // Don't count successful logins
  keyGenerator: (req: Request): string => {
    // Rate limit by IP + email combo to prevent targeted attacks
    const email = req.body?.email || "";
    return `${req.ip}-${email.toLowerCase()}`;
  },
});

// ── Prayer Times Limiter ─────────────────────────────────
// Applied to prayer time fetch routes
export const prayerLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 1 * 60 * 1000,    // 1 minute
  max: 30,                     // 30 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

// ── Notification Limiter ─────────────────────────────────
// Applied to notification scheduling routes
export const notificationLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000,   // 1 hour
  max: 20,                     // 20 notification requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

// ── FCM Token Limiter ────────────────────────────────────
// Applied to FCM token registration route
export const fcmTokenLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000,   // 1 hour
  max: 10,                     // 10 token registrations per hour
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

// ── Prayer Log Limiter ───────────────────────────────────
// Applied to prayer marking routes
export const prayerLogLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 1 * 60 * 1000,    // 1 minute
  max: 20,                     // 20 log updates per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});