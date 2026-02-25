// Qampus Service Worker — handles background notifications
// Runs as long as browser is open (even if tab is minimized/backgrounded)

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(clients.claim()));

// Listen for messages from the main app
self.addEventListener("message", (e) => {
  const { type, payload } = e.data || {};

  if (type === "NOTIFY_CALLED") {
    e.waitUntil(
      self.registration.showNotification("🔔 It's Your Turn!", {
        body: payload?.message || "Please proceed to the cashier window.",
        icon: "./logo192.png",
        badge: "./logo192.png",
        tag: "ticket-called",
        renotify: true,
        requireInteraction: true,
        vibrate: [400, 150, 400, 150, 600],
        data: { url: "/" },
      })
    );
  }

  if (type === "NOTIFY_THIRD") {
    e.waitUntil(
      self.registration.showNotification("⚠️ 3rd in Line!", {
        body: "You are 3rd in line — start getting ready!",
        icon: "./logo192.png",
        badge: "./logo192.png",
        tag: "ticket-third",
        renotify: true,
        vibrate: [200, 100, 200],
        data: { url: "/" },
      })
    );
  }

  if (type === "NOTIFY_WARNING") {
    e.waitUntil(
      self.registration.showNotification("⚠️ Almost Your Turn!", {
        body: "You are next in line — please be ready.",
        icon: "./logo192.png",
        badge: "./logo192.png",
        tag: "ticket-warning",
        renotify: true,
        vibrate: [200, 100, 200],
        data: { url: "/" },
      })
    );
  }
});

// Clicking notification focuses/opens the app
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow("/");
    })
  );
});