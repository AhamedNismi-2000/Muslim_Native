import mongoose, { Document, Schema, Model } from "mongoose";
import { PrayerName } from "./PrayerLog";

// ── Interfaces ──────────────────────────────────────────
export type NotificationStatus = "pending" | "sent" | "failed" | "cancelled";

export type NotificationType = "prayer_time" | "prayer_reminder" | "general";

export interface IScheduledPrayer {
  name: PrayerName;
  scheduledTime: Date;
  status: NotificationStatus;
  sentAt?: Date;
  failureReason?: string;
}

export interface INotification extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  date: string;                        // "YYYY-MM-DD"
  type: NotificationType;
  fcmToken: string;
  scheduledPrayers: IScheduledPrayer[];
  title?: string;                      // For general notifications
  body?: string;                       // For general notifications
  isProcessed: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  markPrayerSent(prayerName: PrayerName): Promise<INotification>;
  markPrayerFailed(prayerName: PrayerName, reason: string): Promise<INotification>;
  cancelAll(): Promise<INotification>;
}

export interface INotificationModel extends Model<INotification> {
  findPendingForDate(date: string): Promise<INotification[]>;
  findByUserAndDate(
    userId: mongoose.Types.ObjectId,
    date: string
  ): Promise<INotification | null>;
  cancelUserNotifications(
    userId: mongoose.Types.ObjectId
  ): Promise<void>;
}

// ── Sub Schemas ─────────────────────────────────────────
const ScheduledPrayerSchema = new Schema<IScheduledPrayer>(
  {
    name: {
      type: String,
      enum: ["fajr", "dhuhr", "asr", "maghrib", "isha"],
      required: true,
    },
    scheduledTime: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "sent", "failed", "cancelled"],
      default: "pending",
    },
    sentAt: {
      type: Date,
      default: null,
    },
    failureReason: {
      type: String,
      default: null,
    },
  },
  { _id: false }
);

// ── Main Schema ──────────────────────────────────────────
const NotificationSchema = new Schema<INotification, INotificationModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    date: {
      type: String,
      required: [true, "Date is required"],
      match: [
        /^\d{4}-\d{2}-\d{2}$/,
        "Date must be in YYYY-MM-DD format",
      ],
    },
    type: {
      type: String,
      enum: ["prayer_time", "prayer_reminder", "general"],
      default: "prayer_time",
    },
    fcmToken: {
      type: String,
      required: [true, "FCM token is required"],
    },
    scheduledPrayers: {
      type: [ScheduledPrayerSchema],
      default: [],
    },
    title: {
      type: String,
      trim: true,
      default: null,
    },
    body: {
      type: String,
      trim: true,
      default: null,
    },
    isProcessed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ── Indexes ──────────────────────────────────────────────
NotificationSchema.index({ userId: 1, date: 1 });
NotificationSchema.index({ date: 1, isProcessed: 1 });
NotificationSchema.index({ "scheduledPrayers.scheduledTime": 1 });
NotificationSchema.index({ "scheduledPrayers.status": 1 });
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // Auto-delete after 30 days

// ── Instance Methods ─────────────────────────────────────
NotificationSchema.methods.markPrayerSent = async function (
  prayerName: PrayerName
): Promise<INotification> {
  const prayer = this.scheduledPrayers.find(
    (p: IScheduledPrayer) => p.name === prayerName
  );

  if (!prayer) {
    throw new Error(`Prayer ${prayerName} not found in notification`);
  }

  prayer.status = "sent";
  prayer.sentAt = new Date();

  // Mark whole document as processed if all prayers are sent or failed
  const allDone = this.scheduledPrayers.every(
    (p: IScheduledPrayer) =>
      p.status === "sent" ||
      p.status === "failed" ||
      p.status === "cancelled"
  );

  if (allDone) this.isProcessed = true;

  return this.save();
};

NotificationSchema.methods.markPrayerFailed = async function (
  prayerName: PrayerName,
  reason: string
): Promise<INotification> {
  const prayer = this.scheduledPrayers.find(
    (p: IScheduledPrayer) => p.name === prayerName
  );

  if (!prayer) {
    throw new Error(`Prayer ${prayerName} not found in notification`);
  }

  prayer.status = "failed";
  prayer.failureReason = reason;

  const allDone = this.scheduledPrayers.every(
    (p: IScheduledPrayer) =>
      p.status === "sent" ||
      p.status === "failed" ||
      p.status === "cancelled"
  );

  if (allDone) this.isProcessed = true;

  return this.save();
};

NotificationSchema.methods.cancelAll = async function (): Promise<INotification> {
  this.scheduledPrayers.forEach((p: IScheduledPrayer) => {
    if (p.status === "pending") {
      p.status = "cancelled";
    }
  });

  this.isProcessed = true;
  return this.save();
};

// ── Static Methods ───────────────────────────────────────
NotificationSchema.statics.findPendingForDate = function (
  date: string
): Promise<INotification[]> {
  return this.find({
    date,
    isProcessed: false,
    scheduledPrayers: {
      $elemMatch: { status: "pending" },
    },
  }).populate("userId", "name email fcmTokens notificationSettings");
};

NotificationSchema.statics.findByUserAndDate = function (
  userId: mongoose.Types.ObjectId,
  date: string
): Promise<INotification | null> {
  return this.findOne({ userId, date });
};

NotificationSchema.statics.cancelUserNotifications = async function (
  userId: mongoose.Types.ObjectId
): Promise<void> {
  const notifications = await this.find({
    userId,
    isProcessed: false,
  });

  for (const notification of notifications) {
    await notification.cancelAll();
  }
};

// ── Export ────────────────────────────────────────────────
const Notification = mongoose.model<INotification, INotificationModel>(
  "Notification",
  NotificationSchema
);

export default Notification;