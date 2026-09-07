import crypto from "crypto";
import { importJWK, SignJWT } from "jose";
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

function fromBase64Url(value: string): Buffer {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function hmac(key: Buffer, data: Buffer): Buffer {
  return crypto.createHmac("sha256", key).update(data).digest();
}

function hkdfExtract(salt: Buffer, ikm: Buffer): Buffer {
  return hmac(salt, ikm);
}

function hkdfExpand(prk: Buffer, info: Buffer, length: number): Buffer {
  const chunks: Buffer[] = [];
  let previous: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  for (let counter = 1; Buffer.concat(chunks).length < length; counter += 1) {
    previous = hmac(prk, Buffer.concat([previous, info, Buffer.from([counter])]));
    chunks.push(previous);
  }
  return Buffer.concat(chunks).subarray(0, length);
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
    privateJwk: {
      kty: "EC" as const,
      crv: "P-256" as const,
      x: toBase64Url(publicKey.subarray(1, 33)),
      y: toBase64Url(publicKey.subarray(33, 65)),
      d: toBase64Url(privateKey),
    },
  };
}

export function getVapidPublicKey(): string | null {
  const keys = getVapidKeys();
  return keys ? toBase64Url(keys.publicKey) : null;
}

async function createVapidToken(audience: string, keys: NonNullable<ReturnType<typeof getVapidKeys>>) {
  const signingKey = await importJWK(keys.privateJwk, "ES256");
  return new SignJWT({})
    .setProtectedHeader({ typ: "JWT", alg: "ES256" })
    .setAudience(audience)
    .setSubject(VAPID_SUBJECT)
    .setExpirationTime("12h")
    .sign(signingKey);
}

function encryptPayload(subscription: PushSubscriptionRecord, payload: string): Buffer {
  const clientPublicKey = fromBase64Url(subscription.keys.p256dh);
  const authSecret = fromBase64Url(subscription.keys.auth);
  const serverKeys = crypto.createECDH("prime256v1");
  serverKeys.generateKeys();
  const serverPublicKey = serverKeys.getPublicKey(undefined, "uncompressed");
  const sharedSecret = serverKeys.computeSecret(clientPublicKey);

  const authInfo = Buffer.concat([
    Buffer.from("WebPush: info\0", "utf8"),
    clientPublicKey,
    serverPublicKey,
  ]);
  const initialPrk = hkdfExtract(authSecret, sharedSecret);
  const ikm = hkdfExpand(initialPrk, authInfo, 32);
  const salt = crypto.randomBytes(16);
  const contentPrk = hkdfExtract(salt, ikm);
  const cek = hkdfExpand(contentPrk, Buffer.from("Content-Encoding: aes128gcm\0", "utf8"), 16);
  const nonce = hkdfExpand(contentPrk, Buffer.from("Content-Encoding: nonce\0", "utf8"), 12);

  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const plaintext = Buffer.concat([Buffer.from(payload, "utf8"), Buffer.from([2])]);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(RECORD_SIZE, 0);

  return Buffer.concat([
    salt,
    recordSize,
    Buffer.from([serverPublicKey.length]),
    serverPublicKey,
    ciphertext,
  ]);
}

export async function sendWebPushNotification(
  userId: number,
  notification: {
    type: string;
    title?: string;
    message?: string;
    fromName?: string;
    fromAvatar?: string;
    fromUserId?: number;
    targetUrl?: string;
  },
) {
  try {
    const keys = getVapidKeys();
    if (!keys) {
      console.warn("[WebPush] VAPID keys unavailable; SESSION_SECRET/JWT_SECRET must be at least 32 characters");
      return;
    }

    const subscriptions = await getPushSubscriptions(userId);
    if (subscriptions.length === 0) {
      console.info(`[WebPush] No registered device for user ${userId}`);
      return;
    }
    await Promise.all(subscriptions.map(async (subscription) => {
      try {
      const endpoint = new URL(subscription.endpoint);
      const token = await createVapidToken(endpoint.origin, keys);
      const icon = notification.fromAvatar && notification.fromAvatar.length < 2048
        ? notification.fromAvatar
        : "/favicon.ico";
      const tag = `ton-${notification.type}-${notification.fromUserId ?? userId}`;
      const body = encryptPayload(subscription, JSON.stringify({
        title: notification.title || "إشعار جديد",
        body: notification.message || (notification.fromName ? `من ${notification.fromName}` : ""),
        icon,
        image: icon === "/favicon.ico" ? undefined : icon,
        badge: "/favicon.ico",
        tag,
        timestamp: Date.now(),
        data: {
          url: notification.targetUrl || (notification.fromUserId
            ? `/profile?userId=${notification.fromUserId}`
            : "/"),
          tag,
        },
      }));

      const response = await fetch(subscription.endpoint, {
        method: "POST",
        headers: {
          Authorization: `vapid t=${token}, k=${toBase64Url(keys.publicKey)}`,
          "Content-Type": "application/octet-stream",
          "Content-Encoding": "aes128gcm",
          TTL: String(PUSH_TTL_SECONDS),
        },
        body: body as unknown as BodyInit,
        signal: AbortSignal.timeout(10_000),
      });

      if (response.status === 404 || response.status === 410) {
        await deletePushSubscription(subscription.endpoint);
        console.warn(`[WebPush] Removed expired device subscription for user ${userId}`);
      } else if (!response.ok) {
        const providerMessage = await response.text().catch(() => "");
        console.warn(
          `[WebPush] Provider rejected notification for user ${userId}: HTTP ${response.status}${providerMessage ? ` (${providerMessage.slice(0, 160)})` : ""}`,
        );
      } else {
        console.info(`[WebPush] Notification accepted for user ${userId}`);
      }
      } catch (error) {
        console.warn("[WebPush] Failed to deliver notification:", error);
      }
    }));
  } catch (error) {
    console.warn("[WebPush] Could not load subscriptions:", error);
  }
}