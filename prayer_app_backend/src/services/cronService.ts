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
