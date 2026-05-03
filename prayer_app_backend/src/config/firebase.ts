
import * as admin from "firebase-admin";

const initializeFirebase = (): void => {
  try {
    // Check if Firebase is already initialized
    if (admin.apps.length > 0) {
      console.log("Firebase already initialized");
      return;
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

    if (!projectId || !privateKey || !clientEmail) {
      throw new Error(
        "Firebase credentials are missing in environment variables"
      );
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        privateKey: privateKey.replace(/\\n/g, "\n"),
        clientEmail,
      }),
    });

    console.log("Firebase Admin SDK initialized successfully");
  } catch (error) {
    console.error(`Firebase initialization error: ${error}`);
    process.exit(1);
  }
};

// Send notification to a single device
export const sendPushNotification = async (
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> => {
  try {
    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: {
        title,
        body,
      },
      data: data || {},
      android: {
        priority: "high",
        notification: {
          sound: "adhan",
          channelId: "prayer_times",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "adhan.caf",
            badge: 1,
          },
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log(`Push notification sent successfully: ${response}`);
    return true;
  } catch (error) {
    console.error(`Error sending push notification: ${error}`);
    return false;
  }
};

// Send notification to multiple devices
export const sendMulticastNotification = async (
  fcmTokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> => {
  try {
    if (fcmTokens.length === 0) return;

    const message: admin.messaging.MulticastMessage = {
      tokens: fcmTokens,
      notification: {
        title,
        body,
      },
      data: data || {},
      android: {
        priority: "high",
        notification: {
          sound: "adhan",
          channelId: "prayer_times",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "adhan.caf",
            badge: 1,
          },
        },
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(
      `Multicast sent — Success: ${response.successCount}, Failed: ${response.failureCount}`
    );

    // Log failed tokens
    response.responses.forEach((resp, index) => {
      if (!resp.success) {
        console.error(
          `Failed token at index ${index}: ${fcmTokens[index]} — ${resp.error}`
        );
      }
    });
  } catch (error) {
    console.error(`Error sending multicast notification: ${error}`);
  }
};

export default initializeFirebase;