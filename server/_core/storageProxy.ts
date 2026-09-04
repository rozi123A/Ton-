import type { Express } from "express";
import { Readable } from "node:stream";
import { ENV } from "./env";

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (
      key.length > 512 ||
      key.includes("\0") ||
      key.split("/").some(segment => segment === "..")
    ) {
      res.status(400).send("Invalid storage key");
      return;
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }

    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });

      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await forgeResp.json()) as { url?: unknown };
      if (typeof url !== "string" || url.length > 4096) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      let signedUrl: URL;
      try {
        signedUrl = new URL(url);
      } catch {
        res.status(502).send("Invalid signed URL from backend");
        return;
      }

      const hostname = signedUrl.hostname.toLowerCase();
      const isBlockedHost =
        hostname === "localhost" ||
        hostname === "::1" ||
        hostname === "0.0.0.0" ||
        hostname.endsWith(".localhost") ||
        hostname.endsWith(".internal") ||
        hostname.startsWith("127.") ||
        hostname.startsWith("10.") ||
        hostname.startsWith("192.168.") ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);

      if (
        signedUrl.protocol !== "https:" ||
        signedUrl.username ||
        signedUrl.password ||
        isBlockedHost
      ) {
        res.status(502).send("Invalid signed URL from backend");
        return;
      }

      const objectResp = await fetch(signedUrl, { redirect: "error" });
      if (!objectResp.ok) {
        console.error(`[StorageProxy] signed URL error: ${objectResp.status}`);
        res.status(502).send("Storage object error");
        return;
      }

      res.set("Cache-Control", "private, no-store");
      const contentType = objectResp.headers.get("content-type");
      const contentLength = objectResp.headers.get("content-length");
      if (contentType) res.set("Content-Type", contentType);
      if (contentLength && /^\d+$/.test(contentLength)) {
        res.set("Content-Length", contentLength);
      }

      if (!objectResp.body) {
        res.end(Buffer.from(await objectResp.arrayBuffer()));
        return;
      }

      Readable.fromWeb(objectResp.body as import("node:stream/web").ReadableStream).pipe(res);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
