import { Request, Response } from "express";
import mongoose from "mongoose";
import User from "../models/User";
import {
  asyncHandler,
  BadRequest,
  NotFound,
  Unauthorized,
} from "../middleware/errorHandler";
import {
  rescheduleUserNotifications,
  cancelUserNotifications,
  getUserNotificationStatus,
} from "../services/notificationService";
import { getPrayerStats, getTodayString } from "../services/prayerService";
import { CALCULATION_METHODS, MADHABS } from "../constants/calculationMethods";

// ── @desc   Get user profile
// ── @route  GET /api/v1/user/profile
// ── @access Private
export const getProfile = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw Unauthorized("Not authenticated.");
    }

    res.status(200).json({
      success: true,
      data: {
        user: req.user,
      },
    });
  }
);

// ── @desc   Update user profile (name, email)
// ── @route  PUT /api/v1/user/profile
// ── @access Private
export const updateProfile = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user || !req.userId) {
      throw Unauthorized("Not authenticated.");
    }

    const { name, email } = req.body;

    if (!name && !email) {
      throw BadRequest("Provide at least one field to update.");
    }

    // Validate email format if provided
    if (email) {
      const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailRegex.test(email)) {
        throw BadRequest("Please provide a valid email address.");
      }

      // Check if email is already taken by another user
      const existingUser = await User.findOne({
        email: email.toLowerCase(),
        _id: { $ne: req.userId },
      });

      if (existingUser) {
        throw BadRequest("Email is already in use by another account.");
      }
    }

    // Apply updates
    if (name) req.user.name = name;
    if (email) req.user.email = email.toLowerCase();

    await req.user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      data: {
        user: req.user,
      },
    });
  }
);