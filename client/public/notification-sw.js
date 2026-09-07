self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || "إشعار جديد";
  const options = {
    body: data.body || "لديك إشعار جديد من الموقع",
    icon: data.icon || "/favicon.ico",
    image: data.image || data.icon || undefined,
    badge: data.badge || "/favicon.ico",
    dir: "rtl",
    lang: "ar",
    tag: `ton-push-${Date.now()}`,
    renotify: true,
    data: data.data || { url: "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => "focus" in client);
      if (existing) return existing.focus();
      return self.clients.openWindow(targetUrl);
    }),
  );
});