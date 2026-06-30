import cron, { ScheduledTask } from "node-cron";
import {
  scheduleAllUsersNotifications,
  fireDueNotifications,
} from "./notificationService";
import { createDailyPrayerLog, getTodayString } from "./prayerService";
import User from "../models/User";
import mongoose from "mongoose";

// ── Track Running Jobs ───────────────────────────────────
const jobs: ScheduledTask[] = [];

// ── Job 1: Fire Due Notifications ────────────────────────
// Runs every minute — checks for prayers due right now and sends push notifications
const startNotificationFireJob = (): void => {
  const job = cron.schedule(
    "* * * * *", // Every minute
    async () => {
      try {
        await fireDueNotifications();
      } catch (error) {
        console.error(`[CRON] Notification fire job error: ${error}`);
      }
    },
    {
      timezone: "UTC",
    }
  );

  jobs.push(job);
  console.log("[CRON] Notification fire job started — runs every minute");
};

// ── Job 2: Schedule Tomorrow's Notifications ─────────────
// Runs daily at 00:01 UTC — builds the next day's notification schedule for all users
const startDailySchedulingJob = (): void => {
  const job = cron.schedule(
    "1 0 * * *", // 00:01 every day
    async () => {
      try {
        console.log("[CRON] Starting daily notification scheduling job...");
        const today = getTodayString();
        await scheduleAllUsersNotifications(today);
        console.log("[CRON] Daily notification scheduling job completed");
      } catch (error) {
        console.error(`[CRON] Daily scheduling job error: ${error}`);
      }
    },
    {
      timezone: "UTC",
    }
  );

  jobs.push(job);
  console.log(
    "[CRON] Daily notification scheduling job started — runs at 00:01 UTC"
  );
};

// ── Job 3: Create Daily Prayer Logs ──────────────────────
// Runs daily at 00:05 UTC — creates a fresh prayer log document for every active user
const startDailyPrayerLogJob = (): void => {
  const job = cron.schedule(
    "5 0 * * *", // 00:05 every day
    async () => {
      try {
        console.log("[CRON] Starting daily prayer log creation job...");

        const batchSize = 100;
        let skip = 0;
        let processedCount = 0;

        while (true) {
          const users = await User.find({ isActive: true })
            .skip(skip)
            .limit(batchSize);

          if (users.length === 0) break;

          await Promise.allSettled(
            users.map((user) =>
              createDailyPrayerLog(
                user._id as mongoose.Types.ObjectId,
                user
              )
            )
          );

          processedCount += users.length;
          skip += batchSize;
        }

        console.log(
          `[CRON] Daily prayer log job completed — ${processedCount} logs created`
        );
      } catch (error) {
        console.error(`[CRON] Daily prayer log job error: ${error}`);
      }
    },
    {
      timezone: "UTC",
    }
  );

  jobs.push(job);
  console.log(
    "[CRON] Daily prayer log creation job started — runs at 00:05 UTC"
  );
};

// ── Job 4: Cleanup Stale FCM Tokens ─────────────────────
// Runs weekly on Sunday at 03:00 UTC — removes inactive user accounts' stale data
const startWeeklyCleanupJob = (): void => {
  const job = cron.schedule(
    "0 3 * * 0", // 03:00 every Sunday
    async () => {
      try {
        console.log("[CRON] Starting weekly cleanup job...");

        // Deactivate accounts that haven't logged in for 180+ days
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);

        const result = await User.updateMany(
          {
            lastLogin: { $lt: sixMonthsAgo },
            isActive: true,
          },
          {
            $set: { fcmTokens: [] }, // Clear stale tokens, keep account
          }
        );

        console.log(
          `[CRON] Weekly cleanup completed — cleared tokens for ${result.modifiedCount} inactive users`
        );
      } catch (error) {
        console.error(`[CRON] Weekly cleanup job error: ${error}`);
      }
    },
    {
      timezone: "UTC",
    }
  );

  jobs.push(job);
  console.log(
    "[CRON] Weekly cleanup job started — runs Sundays at 03:00 UTC"
  );
};
