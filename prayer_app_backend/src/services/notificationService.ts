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

       // 3. Cancel any existing notifications for this date
    await Notification.cancelUserNotifications(userId);

    // 4. Calculate prayer times for the date
    const targetDate = new Date(date);
    const prayerData = calculatePrayerTimes(
      user.location.latitude,
      user.location.longitude,
      targetDate,
      user.calculationMethod,
      user.madhab,
      user.location.timezone
    );

    // 5. Build scheduled prayers based on user preferences
    const scheduledPrayers: IScheduledPrayer[] = [];
    const { notificationSettings } = user;
    const minutesBefore = notificationSettings.reminderMinutesBefore;

    const prayerNames: PrayerName[] = [
      "fajr",
      "dhuhr",
      "asr",
      "maghrib",
      "isha",
    ];

    for (const prayerName of prayerNames) {
      // Skip if user disabled this prayer's notification
      if (!notificationSettings[prayerName]) continue;

      const prayer = prayerData.prayers.find((p) => p.name === prayerName);
      if (!prayer) continue;

      const scheduledTime = getNotificationTime(prayer.time, minutesBefore);

      // Skip if scheduled time is in the past
      if (scheduledTime < new Date()) continue;

      scheduledPrayers.push({
        name: prayerName,
        scheduledTime,
        status: "pending",
      });
    }

    if (scheduledPrayers.length === 0) {
      return {
        success: true,
        userId: userId.toString(),
        date,
        scheduledCount: 0,
        message: "No upcoming notifications to schedule",
      };
    }

       // 6. Use first FCM token as primary
    const primaryFcmToken = user.fcmTokens[0];

    // 7. Create notification document
    await Notification.create({
      userId,
      date,
      type: "prayer_time",
      fcmToken: primaryFcmToken,
      scheduledPrayers,
      isProcessed: false,
    });

    return {
      success: true,
      userId: userId.toString(),
      date,
      scheduledCount: scheduledPrayers.length,
      message: `Successfully scheduled ${scheduledPrayers.length} notifications`,
    };
  } catch (error) {
    console.error(`Error scheduling notifications for user ${userId}: ${error}`);
    return {
      success: false,
      userId: userId.toString(),
      date,
      scheduledCount: 0,
      message: `Error: ${error}`,
    };
  }
};

// ── Schedule Notifications for All Users ─────────────────
export const scheduleAllUsersNotifications = async (
  date: string
): Promise<void> => {
  try {
    console.log(`Scheduling notifications for all users — date: ${date}`);

    // Get all active users in batches to avoid memory overload
    const batchSize = 100;
    let skip = 0;
    let processedCount = 0;

    while (true) {
      const users = await User.find({ isActive: true })
        .select("_id")
        .skip(skip)
        .limit(batchSize);

      if (users.length === 0) break;

      // Process batch in parallel
      await Promise.allSettled(
        users.map((user) =>
          scheduleUserNotifications(
            user._id as mongoose.Types.ObjectId,
            date
          )
        )
      );

      processedCount += users.length;
      skip += batchSize;

      console.log(`Processed ${processedCount} users...`);
    }

    console.log(
      `Notification scheduling complete. Total users processed: ${processedCount}`
    );
  } catch (error) {
    console.error(`Error scheduling notifications for all users: ${error}`);
  }
};

