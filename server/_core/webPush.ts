import crypto from "crypto";
import webpush from "web-push";
import { ENV } from "./env";
import {
  deletePushSubscription,
  getPushSubscriptions,
  type PushSubscriptionRecord,
} from "../db";

const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:notifications@ton.app";
const PUSH_TTL_SECONDS = 60;
const RECORD_SIZE = 4096;

function toBase64Url(value: Buffer): string {
  return value.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function getVapidKeys() {
  if (!ENV.cookieSecret || ENV.cookieSecret.length < 32) return null;

  // Derive a stable P-256 key from the existing server secret so deployments
  // do not need a second private key copied into source code or chat.
  let privateKey = crypto
    .createHmac("sha256", ENV.cookieSecret)
    .update("ton-web-push-v1")
    .digest();
  const ecdh = crypto.createECDH("prime256v1");
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      ecdh.setPrivateKey(privateKey);
      break;
    } catch {
      privateKey = crypto.createHash("sha256").update(privateKey).digest();
    }
  }

  const publicKey = ecdh.getPublicKey(undefined, "uncompressed");
  return {
    privateKey,
    publicKey,
  };
}

export function getVapidPublicKey(): string | null {
  const keys = getVapidKeys();
  return keys ? toBase64Url(keys.publicKey) : null;
}

export async function sendWebPushNotification(
  userId: number,
  notification: { type: string; title?: string; message?: string; fromName?: string; fromAvatar?: string },
) {
  try {
    const keys = getVapidKeys();
    if (!keys) return;

    // Use the maintained Web Push implementation for payload encryption and
    // provider headers. This is more reliable across Chrome/Android push
    // services than duplicating the aes128gcm protocol here.
    webpush.setVapidDetails(
      VAPID_SUBJECT,
      toBase64Url(keys.publicKey),
      toBase64Url(keys.privateKey),
    );

    const subscriptions = await getPushSubscriptions(userId);
    await Promise.all(subscriptions.map(async (subscription) => {
      try {
        // Keep the sender's avatar in the OS notification when it is a normal
        // URL or a compact data URL. Large inline avatars make Web Push
        // payloads exceed provider limits, so the service worker falls back
        // to the app icon.
        const icon = notification.fromAvatar && notification.fromAvatar.length < 2048
          ? notification.fromAvatar
          : "/favicon.ico";
        await webpush.sendNotification(
          subscription,
          JSON.stringify({
            title: notification.title || "إشعار جديد",
            body: notification.message || (notification.fromName ? `من ${notification.fromName}` : ""),
            icon,
            image: icon,
            data: { url: "/" },
          }),
          { TTL: PUSH_TTL_SECONDS, urgency: "normal" },
        );
      } catch (error) {
        const statusCode = typeof error === "object" && error !== null && "statusCode" in error
          ? (error as { statusCode?: number }).statusCode
          : undefined;
        if (statusCode === 404 || statusCode === 410) {
          await deletePushSubscription(subscription.endpoint);
        }
        console.warn("[WebPush] Failed to deliver notification:", error);
      }
    }));
  } catch (error) {
    console.warn("[WebPush] Could not load subscriptions:", error);
  }
}