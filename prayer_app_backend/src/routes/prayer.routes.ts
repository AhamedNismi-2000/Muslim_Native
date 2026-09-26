import { Router } from "express";
import {
  getTodayTimes,
  getPrayerTimesByDate,
  getWeeklyTimes,
  getCustomLocationTimes,
  markPrayer,
  getTodayLog,
  getPrayerLogForDate,
  getWeeklyLogs,
  getStats,
  getQibla,
  getCustomQibla,
  updateLocation,
} from "../controllers/prayer.controller";
import { protect } from "../middleware/authGuard";
import {
  prayerLimiter,
  prayerLogLimiter,
} from "../middleware/rateLimiter";

const router = Router();

// ── Apply protect to all prayer routes ──────────────────
router.use(protect);

// ════════════════════════════════════════════════════════
// PRAYER TIMES
// ════════════════════════════════════════════════════════

// @route  GET /api/v1/prayer/today
// @desc   Get today's prayer times for logged-in user
// @access Private
router.get("/today", prayerLimiter, getTodayTimes);

// @route  GET /api/v1/prayer/weekly
// @desc   Get next 7 days prayer times
// @access Private
router.get("/weekly", prayerLimiter, getWeeklyTimes);

// @route  GET /api/v1/prayer/date/:date
// @desc   Get prayer times for a specific date (YYYY-MM-DD)
// @access Private
router.get("/date/:date", prayerLimiter, getPrayerTimesByDate);

// @route  POST /api/v1/prayer/custom
// @desc   Get prayer times for custom coordinates
// @access Private
router.post("/custom", prayerLimiter, getCustomLocationTimes);

// ════════════════════════════════════════════════════════
// QIBLA
// ════════════════════════════════════════════════════════

// @route  GET /api/v1/prayer/qibla
// @desc   Get Qibla direction for logged-in user's location
// @access Private
router.get("/qibla", prayerLimiter, getQibla);

// @route  POST /api/v1/prayer/qibla/custom
// @desc   Get Qibla direction for custom coordinates
// @access Private
router.post("/qibla/custom", prayerLimiter, getCustomQibla);