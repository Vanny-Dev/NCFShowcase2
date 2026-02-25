// useNotifications.js
// Registers the service worker and provides a function to send background notifications

import { useEffect, useRef } from "react";

const useNotifications = () => {
  const swRef = useRef(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (!("Notification" in window)) return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        swRef.current = reg;
      } catch (err) {
        console.warn("SW registration failed:", err);
      }
    };

    register();
  }, []);

  // Request permission if not yet granted
  const requestPermission = async () => {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    const result = await Notification.requestPermission();
    return result === "granted";
  };

  // Send notification via service worker (works when tab is backgrounded)
  const sendNotification = (type, payload = {}) => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready.then((reg) => {
      reg.active?.postMessage({ type, payload });
    });
  };

  return { requestPermission, sendNotification };
};

export default useNotifications;