import mongoose, { Document, Schema, Model } from "mongoose";
import bcrypt from "bcryptjs";

// ── Interfaces ──────────────────────────────────────────
export interface ILocation {
  latitude: number;
  longitude: number;
  city: string;
  country: string;
  timezone: string;
}

export interface INotificationSettings {
  fajr: boolean;
  dhuhr: boolean;
  asr: boolean;
  maghrib: boolean;
  isha: boolean;
  reminderMinutesBefore: number;
}

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password: string;
  location: ILocation;
  calculationMethod: string;
  madhab: string;
  fcmTokens: string[];
  notificationSettings: INotificationSettings;
  isEmailVerified: boolean;
  isActive: boolean;
  lastLogin: Date;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  addFcmToken(token: string): Promise<void>;
  removeFcmToken(token: string): Promise<void>;
}

export interface IUserModel extends Model<IUser> {
  findByEmail(email: string): Promise<IUser | null>;
}

// ── Schema ──────────────────────────────────────────────
const LocationSchema = new Schema<ILocation>(
  {
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    country: {
      type: String,
      required: true,
      trim: true,
    },
    timezone: {
      type: String,
      required: true,
      default: "UTC",
    },
  },
  { _id: false }
);

const NotificationSettingsSchema = new Schema<INotificationSettings>(
  {
    fajr: { type: Boolean, default: true },
    dhuhr: { type: Boolean, default: true },
    asr: { type: Boolean, default: true },
    maghrib: { type: Boolean, default: true },
    isha: { type: Boolean, default: true },
    reminderMinutesBefore: {
      type: Number,
      default: 10,
      min: 0,
      max: 60,
    },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser, IUserModel>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // Never return password in queries
    },
    location: {
      type: LocationSchema,
      required: [true, "Location is required"],
    },
    calculationMethod: {
      type: String,
      enum: [
        "MuslimWorldLeague",
        "Egyptian",
        "Karachi",
        "UmmAlQura",
        "Dubai",
        "MoonsightingCommittee",
        "NorthAmerica",
        "Kuwait",
        "Qatar",
        "Singapore",
        "Turkey",
        "Tehran",
      ],
      default: "MuslimWorldLeague",
    },
    madhab: {
      type: String,
      enum: ["Shafi", "Hanafi"],
      default: "Shafi",
    },
    fcmTokens: {
      type: [String],
      default: [],
    },
    notificationSettings: {
      type: NotificationSettingsSchema,
      default: () => ({}),
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ── Indexes ─────────────────────────────────────────────
UserSchema.index({ email: 1 });
UserSchema.index({ "location.city": 1 });
UserSchema.index({ createdAt: -1 });

// ── Pre-save Hook (hash password) ───────────────────────
UserSchema.pre("save", async function (next) {
  // Only hash if password is new or modified
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// ── Instance Methods ────────────────────────────────────
UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.addFcmToken = async function (
  token: string
): Promise<void> {
  if (!this.fcmTokens.includes(token)) {
    this.fcmTokens.push(token);
    await this.save();
  }
};

UserSchema.methods.removeFcmToken = async function (
  token: string
): Promise<void> {
  this.fcmTokens = this.fcmTokens.filter((t: string) => t !== token);
  await this.save();
};

// ── Static Methods ──────────────────────────────────────
UserSchema.statics.findByEmail = function (
  email: string
): Promise<IUser | null> {
  return this.findOne({ email: email.toLowerCase() }).select("+password");
};

// ── Export ───────────────────────────────────────────────
const User = mongoose.model<IUser, IUserModel>("User", UserSchema);

export default User;