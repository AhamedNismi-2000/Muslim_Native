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

// ── @desc   Update calculation method and madhab
// ── @route  PUT /api/v1/user/prayer-settings
// ── @access Private
export const updatePrayerSettings = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user || !req.userId) {
      throw Unauthorized("Not authenticated.");
    }

    const { calculationMethod, madhab } = req.body;

    if (!calculationMethod && !madhab) {
      throw BadRequest(
        "Provide at least one setting to update (calculationMethod or madhab)."
      );
    }

    if (
      calculationMethod &&
      !CALCULATION_METHODS.includes(calculationMethod)
    ) {
      throw BadRequest(
        `Invalid calculation method. Must be one of: ${CALCULATION_METHODS.join(", ")}`
      );
    }

    if (madhab && !MADHABS.includes(madhab)) {
      throw BadRequest(
        `Invalid madhab. Must be one of: ${MADHABS.join(", ")}`
      );
    }

    if (calculationMethod) req.user.calculationMethod = calculationMethod;
    if (madhab) req.user.madhab = madhab;

    await req.user.save();

    // Reschedule notifications since prayer times changed
    const userId = new mongoose.Types.ObjectId(req.userId);
    await rescheduleUserNotifications(userId);

    res.status(200).json({
      success: true,
      message: "Prayer settings updated and notifications rescheduled.",
      data: {
        calculationMethod: req.user.calculationMethod,
        madhab:            req.user.madhab,
      },
    });
  }
);

// ── @desc   Update notification settings per prayer
// ── @route  PUT /api/v1/user/notification-settings
// ── @access Private
export const updateNotificationSettings = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user || !req.userId) {
      throw Unauthorized("Not authenticated.");
    }

    const {
      fajr,
      dhuhr,
      asr,
      maghrib,
      isha,
      reminderMinutesBefore,
    } = req.body;

    // Validate reminderMinutesBefore if provided
    if (reminderMinutesBefore !== undefined) {
      if (
        typeof reminderMinutesBefore !== "number" ||
        reminderMinutesBefore < 0 ||
        reminderMinutesBefore > 60
      ) {
        throw BadRequest(
          "reminderMinutesBefore must be a number between 0 and 60."
        );
      }
    }

    // Validate boolean fields
    const booleanFields = { fajr, dhuhr, asr, maghrib, isha };
    for (const [key, value] of Object.entries(booleanFields)) {
      if (value !== undefined && typeof value !== "boolean") {
        throw BadRequest(`${key} must be a boolean value.`);
      }
    }

    // Apply updates
    const settings = req.user.notificationSettings;
    if (fajr    !== undefined) settings.fajr    = fajr;
    if (dhuhr   !== undefined) settings.dhuhr   = dhuhr;
    if (asr     !== undefined) settings.asr     = asr;
    if (maghrib !== undefined) settings.maghrib = maghrib;
    if (isha    !== undefined) settings.isha    = isha;
    if (reminderMinutesBefore !== undefined) {
      settings.reminderMinutesBefore = reminderMinutesBefore;
    }

    req.user.notificationSettings = settings;
    await req.user.save();

    // Reschedule with new settings
    const userId = new mongoose.Types.ObjectId(req.userId);
    await rescheduleUserNotifications(userId);

    res.status(200).json({
      success: true,
      message: "Notification settings updated and notifications rescheduled.",
      data: {
        notificationSettings: req.user.notificationSettings,
      },
    });
  }
);

// ── @desc   Register FCM token for push notifications
// ── @route  POST /api/v1/user/fcm-token
// ── @access Private
export const registerFcmToken = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user || !req.userId) {
      throw Unauthorized("Not authenticated.");
    }

    const { fcmToken } = req.body;

    if (!fcmToken || typeof fcmToken !== "string") {
      throw BadRequest("A valid FCM token is required.");
    }

    await req.user.addFcmToken(fcmToken);

    // Reschedule notifications for this device
    const userId = new mongoose.Types.ObjectId(req.userId);
    await rescheduleUserNotifications(userId);

    res.status(200).json({
      success: true,
      message: "FCM token registered successfully.",
      data: {
        fcmTokenCount: req.user.fcmTokens.length,
      },
    });
  }
);

// ── @desc   Remove FCM token (on logout from a device)
// ── @route  DELETE /api/v1/user/fcm-token
// ── @access Private
export const removeFcmToken = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw Unauthorized("Not authenticated.");
    }

    const { fcmToken } = req.body;

    if (!fcmToken || typeof fcmToken !== "string") {
      throw BadRequest("A valid FCM token is required.");
    }

    await req.user.removeFcmToken(fcmToken);

    res.status(200).json({
      success: true,
      message: "FCM token removed successfully.",
      data: {
        fcmTokenCount: req.user.fcmTokens.length,
      },
    });
  }
);

// ── @desc   Get user prayer statistics
// ── @route  GET /api/v1/user/stats
// ── @access Private
export const getUserStats = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.userId) {
      throw Unauthorized("Not authenticated.");
    }

    const userId = new mongoose.Types.ObjectId(req.userId);
    const stats  = await getPrayerStats(userId);

    res.status(200).json({
      success: true,
      data: stats,
    });
  }
);

// ── @desc   Get notification status for today
// ── @route  GET /api/v1/user/notification-status
// ── @access Private
export const getNotificationStatus = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.userId) {
      throw Unauthorized("Not authenticated.");
    }

    const userId = new mongoose.Types.ObjectId(req.userId);
    const today  = getTodayString();

    const status = await getUserNotificationStatus(userId, today);

    if (!status) {
      res.status(200).json({
        success: true,
        message: "No notifications scheduled for today yet.",
        data: null,
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: status,
    });
  }
);

// ── @desc   Cancel all notifications for user
// ── @route  DELETE /api/v1/user/notifications
// ── @access Private
export const cancelNotifications = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.userId) {
      throw Unauthorized("Not authenticated.");
    }

    const userId = new mongoose.Types.ObjectId(req.userId);
    await cancelUserNotifications(userId);

    res.status(200).json({
      success: true,
      message: "All notifications cancelled successfully.",
    });
  }
);

// ── @desc   Get full user dashboard data in one call
// ── @route  GET /api/v1/user/dashboard
// ── @access Private
export const getDashboard = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user || !req.userId) {
      throw Unauthorized("Not authenticated.");
    }

    const userId = new mongoose.Types.ObjectId(req.userId);

    // Run all queries in parallel
    const [stats, notificationStatus] = await Promise.all([
      getPrayerStats(userId),
      getUserNotificationStatus(userId, getTodayString()),
    ]);

    res.status(200).json({
      success: true,
      data: {
        user:               req.user,
        stats,
        notificationStatus,
      },
    });
  }
);

// ── @desc   Deactivate account
// ── @route  PUT /api/v1/user/deactivate
// ── @access Private
export const deactivateAccount = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user || !req.userId) {
      throw Unauthorized("Not authenticated.");
    }

    const { password } = req.body;

    if (!password) {
      throw BadRequest("Password is required to deactivate your account.");
    }

    // Verify password
    const user = await User.findById(req.userId).select("+password");
    if (!user) throw NotFound("User not found.");

    const isMatch = await user.comparePassword(password);
    if (!isMatch) throw Unauthorized("Incorrect password.");

    // Cancel all notifications first
    const userId = new mongoose.Types.ObjectId(req.userId);
    await cancelUserNotifications(userId);

    // Deactivate
    user.isActive   = false;
    user.fcmTokens  = [];
    await user.save();

    res.status(200).json({
      success: true,
      message: "Account deactivated successfully.",
    });
  }
);
