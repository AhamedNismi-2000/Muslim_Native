import { Coordinates, CalculationMethod, PrayerTimes, Madhab, HighLatitudeRule, Prayer, Qibla } from "adhan";
import { IUser } from "../models/User";
import { IPrayerLog, PrayerName } from "../models/PrayerLog";
import PrayerLog from "../models/PrayerLog";
import mongoose from "mongoose";

// ── Interfaces ───────────────────────────────────────────
export interface IPrayerTime {
  name: PrayerName;
  time: Date;
  timeString: string;   // "05:30 AM"
  isNext: boolean;
  isPassed: boolean;
}

export interface IDailyPrayerTimes {
  date: string;
  hijriDate?: string;
  location: {
    city: string;
    country: string;
    latitude: number;
    longitude: number;
  };
  prayers: IPrayerTime[];
  nextPrayer: IPrayerTime | null;
  qiblaDirection: number;
  calculationMethod: string;
  madhab: string;
}

export interface IWeeklyPrayerTimes {
  startDate: string;
  endDate: string;
  days: IDailyPrayerTimes[];
}

// ── Calculation Method Map ───────────────────────────────
const getCalculationMethod = (method: string) => {
  const methodMap: Record<string, () => any> = {
    MuslimWorldLeague:      () => CalculationMethod.MuslimWorldLeague(),
    Egyptian:               () => CalculationMethod.Egyptian(),
    Karachi:                () => CalculationMethod.Karachi(),
    UmmAlQura:              () => CalculationMethod.UmmAlQura(),
    Dubai:                  () => CalculationMethod.Dubai(),
    MoonsightingCommittee:  () => CalculationMethod.MoonsightingCommittee(),
    NorthAmerica:           () => CalculationMethod.NorthAmerica(),
    Kuwait:                 () => CalculationMethod.Kuwait(),
    Qatar:                  () => CalculationMethod.Qatar(),
    Singapore:              () => CalculationMethod.Singapore(),
    Turkey:                 () => CalculationMethod.Turkey(),
    Tehran:                 () => CalculationMethod.Tehran(),
  };

  return methodMap[method]
    ? methodMap[method]()
    : CalculationMethod.MuslimWorldLeague();
};

// ── Format Time to String ────────────────────────────────
const formatTime = (date: Date, timezone: string): string => {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: timezone,
  });
};

// ── Format Date to YYYY-MM-DD ────────────────────────────
const formatDate = (date: Date): string => {
  return date.toISOString().split("T")[0];
};

// ── Get Today's Date String ──────────────────────────────
export const getTodayString = (): string => {
  return formatDate(new Date());
};

// ── Calculate Prayer Times for a Single Day ──────────────
export const calculatePrayerTimes = (
  latitude: number,
  longitude: number,
  date: Date,
  calculationMethod: string,
  madhabString: string,
  timezone: string = "UTC"
): IDailyPrayerTimes => {
  // 1. Set coordinates
  const coordinates = new Coordinates(latitude, longitude);

  // 2. Set calculation parameters
  const params = getCalculationMethod(calculationMethod);
  params.madhab = madhabString === "Hanafi" ? Madhab.Hanafi : Madhab.Shafi;
  params.highLatitudeRule = HighLatitudeRule.MiddleOfTheNight;

  // 3. Calculate prayer times
  const prayerTimes = new PrayerTimes(coordinates, date, params);

  // 4. Get current time for next/passed calculation
  const now = new Date();

  // 5. Build prayer times array
  const prayerNames: PrayerName[] = [
    "fajr",
    "dhuhr",
    "asr",
    "maghrib",
    "isha",
  ];

  const prayers: IPrayerTime[] = prayerNames.map((name) => {
    const prayerTime = prayerTimes[name] as Date;
    const isPassed = prayerTime < now;

    return {
      name,
      time: prayerTime,
      timeString: formatTime(prayerTime, timezone),
      isNext: false,    // Will be set below
      isPassed,
    };
  });