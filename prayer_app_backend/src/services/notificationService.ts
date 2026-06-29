import mongoose from "mongoose";
import Notification, { INotification, IScheduledPrayer } from "../models/Notification";
import User, { IUser } from "../models/User";
import { PrayerName } from "../models/PrayerLog";
import { sendPushNotification, sendMulticastNotification } from "../config/firebase";
import { calculatePrayerTimes, getTodayString } from "./prayerService";

// ── Interfaces ───────────────────────────────────────────
export interface IScheduleResult {
  success: boolean;
  userId: string;
  date: string;
  scheduledCount: number;
  message: string;
}

export interface INotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

// ── Prayer Notification Messages ─────────────────────────
const getPrayerMessage = (
  prayerName: PrayerName,
  minutesBefore: number
): INotificationPayload => {
  const prayerDisplayNames: Record<PrayerName, string> = {
    fajr:    "Fajr",
    dhuhr:   "Dhuhr",
    asr:     "Asr",
    maghrib: "Maghrib",
    isha:    "Isha",
  };

  const prayerEmojis: Record<PrayerName, string> = {
    fajr:    "🌙",
    dhuhr:   "☀️",
    asr:     "🌤️",
    maghrib: "🌅",
    isha:    "🌙",
  };

  const displayName = prayerDisplayNames[prayerName];
  const emoji = prayerEmojis[prayerName];

  if (minutesBefore === 0) {
    return {
      title: `${emoji} ${displayName} Prayer Time`,
      body: `It's time for ${displayName} prayer. May Allah accept your prayers.`,
      data: {
        type: "prayer_time",
        prayer: prayerName,
      },
    };
  }

  return {
    title: `${emoji} ${displayName} in ${minutesBefore} minutes`,
    body: `${displayName} prayer will begin in ${minutesBefore} minutes. Prepare for prayer.`,
    data: {
      type: "prayer_reminder",
      prayer: prayerName,
      minutesBefore: minutesBefore.toString(),
    },
  };
};

// ── Calculate Notification Time ──────────────────────────
const getNotificationTime = (
  prayerTime: Date,
  minutesBefore: number
): Date => {
  const notifTime = new Date(prayerTime);
  notifTime.setMinutes(notifTime.getMinutes() - minutesBefore);
  return notifTime;
};

// ── Schedule Notifications for a Single User ─────────────
export const scheduleUserNotifications = async (
  userId: mongoose.Types.ObjectId,
  date: string
): Promise<IScheduleResult> => {
  try {
    // 1. Get user with notification settings
    const user = await User.findById(userId);
    if (!user) {
      return {
        success: false,
        userId: userId.toString(),
        date,
        scheduledCount: 0,
        message: "User not found",
      };
    }

    // 2. Check if user has FCM tokens
    if (!user.fcmTokens || user.fcmTokens.length === 0) {
      return {
        success: false,
        userId: userId.toString(),
        date,
        scheduledCount: 0,
        message: "No FCM tokens found for user",
      };
    }
