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

