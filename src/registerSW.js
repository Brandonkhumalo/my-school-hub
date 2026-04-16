// Service Worker Registration
// Called from main.jsx to enable (or disable) PWA offline support.

const SW_ENABLED = import.meta.env.VITE_ENABLE_SW === "true";

async function unregisterExistingSW() {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch (err) {
    console.warn("[SW] Failed to unregister existing service workers:", err);
  }

  if ("caches" in window) {
    try {
      const keys = await caches.keys();
      const schoolHubKeys = keys.filter((k) => k.startsWith("myschoolhub-"));
      await Promise.all(schoolHubKeys.map((k) => caches.delete(k)));
    } catch (err) {
      console.warn("[SW] Failed to clear old caches:", err);
    }
  }
}

export function registerSW() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    if (!SW_ENABLED) {
      await unregisterExistingSW();
      console.log("[SW] Disabled by VITE_ENABLE_SW=false. Existing service workers removed.");
      return;
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("[SW] Registered, scope:", registration.scope);

        // Check for updates every hour
        setInterval(() => registration.update(), 60 * 60 * 1000);

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // New content available — notify the user
              console.log("[SW] New version available. Refresh to update.");
              if (window.confirm("A new version of My School Hub is available. Refresh now?")) {
                window.location.reload();
              }
            }
          });
        });
      })
      .catch((err) => console.error("[SW] Registration failed:", err));
  });
}
