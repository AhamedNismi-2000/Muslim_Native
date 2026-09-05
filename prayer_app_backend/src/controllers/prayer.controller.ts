import { Request, Response } from "express";
import mongoose from "mongoose";
import {
  asyncHandler,
  BadRequest,
  NotFound,
} from "../middleware/errorHandler";
import {
  getTodayPrayerTimes,
  getWeeklyPrayerTimes,
  calculatePrayerTimes,
  markPrayerStatus,
  getPrayerLogByDate,
  getWeeklyPrayerLogs,
  getPrayerStats,
  getQiblaDirection,
  getTodayString,
} from "../services/prayerService";
import { PrayerName } from "../models/PrayerLog";
import {
  rescheduleUserNotifications,
} from "../services/notificationService";

// ── Valid Prayer Names ────────────────────────────────────
const VALID_PRAYERS: PrayerName[] = [
  "fajr",
  "dhuhr",
  "asr",
  "maghrib",
  "isha",
];

// ── @desc   Get today's prayer times for logged-in user
// ── @route  GET /api/v1/prayer/today
// ── @access Private
export const getTodayTimes = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw BadRequest("User not found in request.");
    }

    const prayerData = getTodayPrayerTimes(req.user);

    res.status(200).json({
      success: true,
      data: prayerData,
    });
  }
);

// ── @desc   Get prayer times for a specific date
// ── @route  GET /api/v1/prayer/date/:date
// ── @access Private
export const getPrayerTimesByDate = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { date } = req.params;

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      throw BadRequest("Invalid date format. Use YYYY-MM-DD.");
    }

    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      throw BadRequest("Invalid date value.");
    }

    if (!req.user) {
      throw BadRequest("User not found in request.");
    }

    const prayerData = calculatePrayerTimes(
      req.user.location.latitude,
      req.user.location.longitude,
      targetDate,
      req.user.calculationMethod,
      req.user.madhab,
      req.user.location.timezone
    );

    prayerData.location.city    = req.user.location.city;
    prayerData.location.country = req.user.location.country;

    res.status(200).json({
      success: true,
      data: prayerData,
    });
  }
);

// ── @desc   Get weekly prayer times (next 7 days)
// ── @route  GET /api/v1/prayer/weekly
// ── @access Private
export const getWeeklyTimes = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw BadRequest("User not found in request.");
    }

    const weeklyData = getWeeklyPrayerTimes(req.user);

    res.status(200).json({
      success: true,
      data: weeklyData,
    });
  }
);

// ── @desc   Get prayer times for custom coordinates
// ── @route  POST /api/v1/prayer/custom
// ── @access Private
export const getCustomLocationTimes = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const {
      latitude,
      longitude,
      date,
      calculationMethod,
      madhab,
      timezone,
    } = req.body;

    // Validate coordinates
    if (latitude === undefined || longitude === undefined) {
      throw BadRequest("Latitude and longitude are required.");
    }

    if (latitude < -90 || latitude > 90) {
      throw BadRequest("Latitude must be between -90 and 90.");
    }

    if (longitude < -180 || longitude > 180) {
      throw BadRequest("Longitude must be between -180 and 180.");
    }

    const targetDate = date ? new Date(date) : new Date();
    if (isNaN(targetDate.getTime())) {
      throw BadRequest("Invalid date value.");
    }

    const method = calculationMethod || req.user?.calculationMethod || "MuslimWorldLeague";
    const madhabValue = madhab || req.user?.madhab || "Shafi";
    const tz = timezone || req.user?.location.timezone || "UTC";

    const prayerData = calculatePrayerTimes(
      latitude,
      longitude,
      targetDate,
      method,
      madhabValue,
      tz
    );

    res.status(200).json({
      success: true,
      data: prayerData,
    });
  }
);

// ── @desc   Mark a prayer as completed or missed
// ── @route  PUT /api/v1/prayer/log/mark
// ── @access Private
export const markPrayer = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { prayerName, status, date } = req.body;

    // Validate prayer name
    if (!prayerName || !VALID_PRAYERS.includes(prayerName)) {
      throw BadRequest(
        `Invalid prayer name. Must be one of: ${VALID_PRAYERS.join(", ")}`
      );
    }

    // Validate status
    if (!status || !["completed", "missed"].includes(status)) {
      throw BadRequest("Status must be either 'completed' or 'missed'.");
    }

    const targetDate = date || getTodayString();

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(targetDate)) {
      throw BadRequest("Invalid date format. Use YYYY-MM-DD.");
    }

    if (!req.userId) {
      throw BadRequest("User not authenticated.");
    }

    const userId = new mongoose.Types.ObjectId(req.userId);

    const updatedLog = await markPrayerStatus(
      userId,
      targetDate,
      prayerName as PrayerName,
      status
    );

    res.status(200).json({
      success: true,
      message: `${prayerName} marked as ${status}.`,
      data: updatedLog,
    });
  }
);
// ── @desc   Get prayer log for today
// ── @route  GET /api/v1/prayer/log/today
// ── @access Private
export const getTodayLog = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.userId) {
      throw BadRequest("User not authenticated.");
    }

    const userId = new mongoose.Types.ObjectId(req.userId);
    const today  = getTodayString();

    const log = await getPrayerLogByDate(userId, today);

    if (!log) {
      throw NotFound(
        "No prayer log found for today. It will be created automatically at midnight."
      );
    }

    res.status(200).json({
      success: true,
      data: log,
    });
  }
);
// ── @desc   Get prayer log for a specific date
// ── @route  GET /api/v1/prayer/log/:date
// ── @access Private
export const getPrayerLogForDate = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { date } = req.params;

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      throw BadRequest("Invalid date format. Use YYYY-MM-DD.");
    }

    if (!req.userId) {
      throw BadRequest("User not authenticated.");
    }

    const userId = new mongoose.Types.ObjectId(req.userId);
    const log    = await getPrayerLogByDate(userId, date);

    if (!log) {
      throw NotFound(`No prayer log found for date ${date}.`);
    }

    res.status(200).json({
      success: true,
      data: log,
    });
  }
);

// ── @desc   Get weekly prayer logs
// ── @route  GET /api/v1/prayer/log/weekly
// ── @access Private
export const getWeeklyLogs = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.userId) {
      throw BadRequest("User not authenticated.");
    }

    const userId = new mongoose.Types.ObjectId(req.userId);
    const logs   = await getWeeklyPrayerLogs(userId);

    res.status(200).json({
      success: true,
      count: logs.length,
      data: logs,
    });
  }
);
// ── @desc   Get prayer statistics
// ── @route  GET /api/v1/prayer/stats
// ── @access Private
export const getStats = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.userId) {
      throw BadRequest("User not authenticated.");
    }

    const userId = new mongoose.Types.ObjectId(req.userId);
    const stats  = await getPrayerStats(userId);

    res.status(200).json({
      success: true,
      data: stats,
    });
  }
);

