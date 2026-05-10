import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User, { IUser } from "../models/User";

// ── Extend Express Request ───────────────────────────────
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      userId?: string;
    }
  }
}

// ── Interfaces ───────────────────────────────────────────
interface JwtPayload {
  id: string;
  email: string;
  iat: number;
  exp: number;
}

// ── Helper: Extract Token ────────────────────────────────
const extractToken = (req: Request): string | null => {
  // Check Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }

  // Fallback to cookie
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }

  return null;
};

// ── Main Auth Guard ──────────────────────────────────────
export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. Extract token
    const token = extractToken(req);

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
      return;
    }

    // 2. Verify token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error("JWT_SECRET is not defined in environment variables");
    }

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, jwtSecret) as JwtPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        res.status(401).json({
          success: false,
          message: "Token has expired. Please login again.",
          code: "TOKEN_EXPIRED",
        });
        return;
      }

      if (err instanceof jwt.JsonWebTokenError) {
        res.status(401).json({
          success: false,
          message: "Invalid token. Please login again.",
          code: "TOKEN_INVALID",
        });
        return;
      }

      throw err;
    }

    // 3. Find user from token payload
    const user = await User.findById(decoded.id).select(
      "-password"
    );

    if (!user) {
      res.status(401).json({
        success: false,
        message: "User no longer exists.",
        code: "USER_NOT_FOUND",
      });
      return;
    }

    // 4. Check if user account is active
    if (!user.isActive) {
      res.status(401).json({
        success: false,
        message: "Your account has been deactivated. Please contact support.",
        code: "ACCOUNT_DEACTIVATED",
      });
      return;
    }

    // 5. Attach user to request
    req.user = user;
    req.userId = user._id.toString();

    next();
  } catch (error) {
    console.error(`Auth guard error: ${error}`);
    res.status(500).json({
      success: false,
      message: "Internal server error during authentication.",
    });
  }
};

// ── Optional Auth (does not block if no token) ───────────
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);

    if (!token) {
      return next(); // Continue without user
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return next();

    try {
      const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
      const user = await User.findById(decoded.id).select("-password");

      if (user && user.isActive) {
        req.user = user;
        req.userId = user._id.toString();
      }
    } catch {
      // Token invalid but not blocking — just continue
    }

    next();
  } catch (error) {
    next(); // Never block on optional auth
  }
};

// ── Generate JWT Token ───────────────────────────────────
export const generateToken = (
  userId: string,
  email: string
): string => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is not defined in environment variables");
  }

  return jwt.sign(
    {
      id: userId,
      email,
    },
    jwtSecret,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    } as jwt.SignOptions
  );
};

// ── Verify Token Utility (used in controllers) ───────────
export const verifyToken = (token: string): JwtPayload => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is not defined in environment variables");
  }

  return jwt.verify(token, jwtSecret) as JwtPayload;
};