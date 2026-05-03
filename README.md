# Muslim_Native
This is for Developing Ad Free Prayer App 


prayer-app-mobile/
├── app/                          # Expo Router (file-based routing)
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (tabs)/
│   │   ├── index.tsx             # Prayer times home
│   │   ├── qibla.tsx             # Qibla compass
│   │   ├── quran.tsx             # Quran reader
│   │   └── profile.tsx
│   └── _layout.tsx
├── components/
│   ├── PrayerCard.tsx
│   ├── CountdownTimer.tsx
│   ├── QiblaCompass.tsx
│   └── PrayerTracker.tsx
├── hooks/
│   ├── usePrayerTimes.ts         # adhan-js calculations
│   ├── useLocation.ts
│   └── useNotifications.ts
├── store/
│   ├── index.ts                  # Redux or Zustand store
│   ├── authSlice.ts
│   └── prayerSlice.ts
├── services/
│   ├── api.ts                    # Axios instance + interceptors
│   ├── prayerService.ts
│   └── notificationService.ts
├── utils/
│   ├── prayerCalculator.ts       # adhan-js wrapper
│   └── qiblaCalculator.ts
├── constants/
│   └── calculationMethods.ts     # ISNA, MWL, Egypt, etc.
└── app.json
