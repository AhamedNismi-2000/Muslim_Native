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
