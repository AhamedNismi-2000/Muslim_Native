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


// ════════════════════════════════════════════════════════
// LOCATION
// ════════════════════════════════════════════════════════

// @route  PUT /api/v1/prayer/location
// @desc   Update user location and reschedule notifications
// @access Private
router.put("/location", prayerLimiter, updateLocation);

// ════════════════════════════════════════════════════════
// PRAYER LOGS
// ════════════════════════════════════════════════════════

// @route  GET /api/v1/prayer/log/today
// @desc   Get today's prayer log
// @access Private
router.get("/log/today", prayerLogLimiter, getTodayLog);

// @route  GET /api/v1/prayer/log/weekly
// @desc   Get last 7 days prayer logs
// @access Private
router.get("/log/weekly", prayerLogLimiter, getWeeklyLogs);

// @route  GET /api/v1/prayer/log/:date
// @desc   Get prayer log for a specific date (YYYY-MM-DD)
// @access Private
router.get("/log/:date", prayerLogLimiter, getPrayerLogForDate);

// @route  PUT /api/v1/prayer/log/mark
// @desc   Mark a prayer as completed or missed
// @access Private
router.put("/log/mark", prayerLogLimiter, markPrayer);
