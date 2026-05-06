import mongoose, { Document, Schema, Model } from "mongoose";

// ── Interfaces ──────────────────────────────────────────
export type PrayerName = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";

export type PrayerStatus = "completed" | "missed" | "pending";

export interface IPrayerEntry {
  name: PrayerName;
  time: string;        // Scheduled time e.g. "05:30"
  status: PrayerStatus;
  completedAt?: Date;  // Actual time user marked it
}

export interface IStreak {
  current: number;     // Current streak in days
  longest: number;     // All-time longest streak
  lastUpdated: Date;
}

export interface IPrayerLog extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  date: string;        // "YYYY-MM-DD" format
  prayers: IPrayerEntry[];
  streak: IStreak;
  completedCount: number;
  totalCount: number;
  completionPercentage: number;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  markPrayer(prayerName: PrayerName, status: PrayerStatus): Promise<IPrayerLog>;
  isFullyCompleted(): boolean;
}

export interface IPrayerLogModel extends Model<IPrayerLog> {
  findByUserAndDate(
    userId: mongoose.Types.ObjectId,
    date: string
  ): Promise<IPrayerLog | null>;

  getWeeklyLogs(
    userId: mongoose.Types.ObjectId,
    startDate: string,
    endDate: string
  ): Promise<IPrayerLog[]>;

  getUserStreak(
    userId: mongoose.Types.ObjectId
  ): Promise<IStreak>;
}

// ── Sub Schemas ─────────────────────────────────────────
const PrayerEntrySchema = new Schema<IPrayerEntry>(
  {
    name: {
      type: String,
      enum: ["fajr", "dhuhr", "asr", "maghrib", "isha"],
      required: true,
    },
    time: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["completed", "missed", "pending"],
      default: "pending",
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const StreakSchema = new Schema<IStreak>(
  {
    current: {
      type: Number,
      default: 0,
      min: 0,
    },
    longest: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

// ── Main Schema ──────────────────────────────────────────
const PrayerLogSchema = new Schema<IPrayerLog, IPrayerLogModel>(
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
    prayers: {
      type: [PrayerEntrySchema],
      default: [],
      validate: {
        validator: function (prayers: IPrayerEntry[]) {
          return prayers.length === 5;
        },
        message: "A prayer log must contain exactly 5 prayers",
      },
    },
    streak: {
      type: StreakSchema,
      default: () => ({
        current: 0,
        longest: 0,
        lastUpdated: new Date(),
      }),
    },
    completedCount: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalCount: {
      type: Number,
      default: 5,
    },
    completionPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
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
PrayerLogSchema.index({ userId: 1, date: -1 });
PrayerLogSchema.index({ userId: 1, date: 1 }, { unique: true }); // One log per user per day
PrayerLogSchema.index({ "streak.current": -1 });

// ── Pre-save Hook ────────────────────────────────────────
PrayerLogSchema.pre("save", function (next) {
  // Auto-calculate completedCount and completionPercentage
  const completed = this.prayers.filter(
    (p) => p.status === "completed"
  ).length;

  this.completedCount = completed;
  this.totalCount = 5;
  this.completionPercentage = Math.round((completed / 5) * 100);

  next();
});

// ── Instance Methods ─────────────────────────────────────
PrayerLogSchema.methods.markPrayer = async function (
  prayerName: PrayerName,
  status: PrayerStatus
): Promise<IPrayerLog> {
  const prayer = this.prayers.find(
    (p: IPrayerEntry) => p.name === prayerName
  );

  if (!prayer) {
    throw new Error(`Prayer ${prayerName} not found in log`);
  }

  prayer.status = status;
  prayer.completedAt = status === "completed" ? new Date() : undefined;

  return this.save();
};

PrayerLogSchema.methods.isFullyCompleted = function (): boolean {
  return this.prayers.every(
    (p: IPrayerEntry) => p.status === "completed"
  );
};

// ── Static Methods ───────────────────────────────────────
PrayerLogSchema.statics.findByUserAndDate = function (
  userId: mongoose.Types.ObjectId,
  date: string
): Promise<IPrayerLog | null> {
  return this.findOne({ userId, date });
};

PrayerLogSchema.statics.getWeeklyLogs = function (
  userId: mongoose.Types.ObjectId,
  startDate: string,
  endDate: string
): Promise<IPrayerLog[]> {
  return this.find({
    userId,
    date: {
      $gte: startDate,
      $lte: endDate,
    },
  }).sort({ date: 1 });
};

PrayerLogSchema.statics.getUserStreak = async function (
  userId: mongoose.Types.ObjectId
): Promise<IStreak> {
  // Get all logs sorted by date descending
  const logs = await this.find({ userId })
    .sort({ date: -1 })
    .select("date completedCount streak");

  if (!logs.length) {
    return { current: 0, longest: 0, lastUpdated: new Date() };
  }

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  const today = new Date().toISOString().split("T")[0];
  let expectedDate = today;

  for (const log of logs) {
    const isAllCompleted = log.completedCount === 5;
    const isExpectedDate = log.date === expectedDate;

    if (isExpectedDate && isAllCompleted) {
      tempStreak++;
      // Move expected date back one day
      const prev = new Date(expectedDate);
      prev.setDate(prev.getDate() - 1);
      expectedDate = prev.toISOString().split("T")[0];
    } else {
      break;
    }
  }

  currentStreak = tempStreak;

  // Calculate longest streak from all logs
  let streak = 0;
  let prevDate: string | null = null;

  for (const log of [...logs].reverse()) {
    if (log.completedCount === 5) {
      if (prevDate) {
        const prev = new Date(prevDate);
        prev.setDate(prev.getDate() + 1);
        const nextExpected = prev.toISOString().split("T")[0];
        if (log.date === nextExpected) {
          streak++;
        } else {
          streak = 1;
        }
      } else {
        streak = 1;
      }
      longestStreak = Math.max(longestStreak, streak);
      prevDate = log.date;
    } else {
      streak = 0;
      prevDate = null;
    }
  }

  return {
    current: currentStreak,
    longest: longestStreak,
    lastUpdated: new Date(),
  };
};

// ── Export ────────────────────────────────────────────────
const PrayerLog = mongoose.model<IPrayerLog, IPrayerLogModel>(
  "PrayerLog",
  PrayerLogSchema
);

export default PrayerLog;
