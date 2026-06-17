import { Request, Response, NextFunction } from "express";
import User from "../models/User";
import { generateToken } from "../middleware/authGuard";
import {
  asyncHandler,
  BadRequest,
  Unauthorized,
  Conflict,
  NotFound,
} from "../middleware/errorHandler";
import { CALCULATION_METHODS, MADHABS } from "../constants/calculationMethods";

// ── Helper: Validate Email Format ────────────────────────
const isValidEmail = (email: string): boolean => {
  const regex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
  return regex.test(email);
};

// ── @desc   Register a new user
// ── @route  POST /api/v1/auth/register
// ── @access Public
export const register = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const {
      name,
      email,
      password,
      location,
      calculationMethod,
      madhab,
    } = req.body;

    // 1. Validate required fields
    if (!name || !email || !password || !location) {
      throw BadRequest(
        "Name, email, password, and location are required."
      );
    }

    if (!isValidEmail(email)) {
      throw BadRequest("Please provide a valid email address.");
    }

    if (password.length < 6) {
      throw BadRequest("Password must be at least 6 characters long.");
    }

    const { latitude, longitude, city, country, timezone } = location;
    if (
      latitude === undefined ||
      longitude === undefined ||
      !city ||
      !country
    ) {
      throw BadRequest(
        "Location must include latitude, longitude, city, and country."
      );
    }


      // 2. Validate calculation method and madhab if provided
    if (
      calculationMethod &&
      !CALCULATION_METHODS.includes(calculationMethod)
    ) {
      throw BadRequest(
        `Invalid calculation method. Must be one of: ${CALCULATION_METHODS.join(", ")}`
      );
    }

    if (madhab && !MADHABS.includes(madhab)) {
      throw BadRequest(`Invalid madhab. Must be one of: ${MADHABS.join(", ")}`);
    }

    // 3. Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw Conflict("An account with this email already exists.");
    }

    // 4. Create user (password is hashed automatically via pre-save hook)
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      location: {
        latitude,
        longitude,
        city,
        country,
        timezone: timezone || "UTC",
      },
      calculationMethod: calculationMethod || "MuslimWorldLeague",
      madhab: madhab || "Shafi",
    });

    // 5. Generate JWT
    const token = generateToken(user._id.toString(), user.email);

    // 6. Send response (password excluded via toJSON transform on model)
    res.status(201).json({
      success: true,
      message: "Account created successfully.",
      data: {
        user,
        token,
      },
    });
  }
);

// ── @desc   Login user
// ── @route  POST /api/v1/auth/login
// ── @access Public
export const login = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { email, password, fcmToken } = req.body;

    // 1. Validate input
    if (!email || !password) {
      throw BadRequest("Email and password are required.");
    }

    // 2. Find user with password included
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password"
    );

    if (!user) {
      throw Unauthorized("Invalid email or password.");
    }

    // 3. Check account status
    if (!user.isActive) {
      throw Unauthorized(
        "Your account has been deactivated. Please contact support."
      );
    }

        // 2. Validate calculation method and madhab if provided
    if (
      calculationMethod &&
      !CALCULATION_METHODS.includes(calculationMethod)
    ) {
      throw BadRequest(
        `Invalid calculation method. Must be one of: ${CALCULATION_METHODS.join(", ")}`
      );
    }

    if (madhab && !MADHABS.includes(madhab)) {
      throw BadRequest(`Invalid madhab. Must be one of: ${MADHABS.join(", ")}`);
    }

    // 3. Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw Conflict("An account with this email already exists.");
    }

    // 4. Create user (password is hashed automatically via pre-save hook)
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      location: {
        latitude,
        longitude,
        city,
        country,
        timezone: timezone || "UTC",
      },
      calculationMethod: calculationMethod || "MuslimWorldLeague",
      madhab: madhab || "Shafi",
    });

    // 5. Generate JWT
    const token = generateToken(user._id.toString(), user.email);

    // 6. Send response (password excluded via toJSON transform on model)
    res.status(201).json({
      success: true,
      message: "Account created successfully.",
      data: {
        user,
        token,
      },
    });
  }
);

// ── @desc   Login user
// ── @route  POST /api/v1/auth/login
// ── @access Public
export const login = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { email, password, fcmToken } = req.body;

    // 1. Validate input
    if (!email || !password) {
      throw BadRequest("Email and password are required.");
    }

    // 2. Find user with password included
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password"
    );

    if (!user) {
      throw Unauthorized("Invalid email or password.");
    }

    // 3. Check account status
    if (!user.isActive) {
      throw Unauthorized(
        "Your account has been deactivated. Please contact support."
      );
    }

    // 4. Compare password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw Unauthorized("Invalid email or password.");
    }

    // 5. Register FCM token if provided (for push notifications)
    if (fcmToken) {
      await user.addFcmToken(fcmToken);
    }

    // 6. Update last login
    user.lastLogin = new Date();
    await user.save();

    // 7. Generate JWT
    const token = generateToken(user._id.toString(), user.email);

    res.status(200).json({
      success: true,
      message: "Login successful.",
      data: {
        user,
        token,
      },
    });
  }
);