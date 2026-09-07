self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || "إشعار جديد";
  const notificationData = data.data || {};
  const options = {
    body: data.body || "لديك إشعار جديد من الموقع",
    icon: data.icon || "/superlive-icon.svg",
    image: data.image || data.icon || undefined,
    badge: data.badge || "/superlive-icon.svg",
    dir: "rtl",
    lang: "ar",
    tag: data.tag || notificationData.tag || `ton-push-${Date.now()}`,
    renotify: true,
    timestamp: data.timestamp || Date.now(),
    vibrate: [200, 100, 200],
    data: notificationData,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => "focus" in client);
      if (existing) {
        if ("navigate" in existing && existing.url !== targetUrl) {
          return existing.navigate(targetUrl).then(() => existing.focus());
        }
        return existing.focus();
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});