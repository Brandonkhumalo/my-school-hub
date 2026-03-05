// Service Worker Registration
// Called from main.jsx to enable PWA offline support.

export function registerSW() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('[SW] Registered, scope:', registration.scope);

          // Check for updates every hour
          setInterval(() => registration.update(), 60 * 60 * 1000);

          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (!newWorker) return;

            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New content available — notify the user
                console.log('[SW] New version available. Refresh to update.');
                if (window.confirm('A new version of My School Hub is available. Refresh now?')) {
                  window.location.reload();
                }
              }
            });
          });
        })
        .catch((err) => console.error('[SW] Registration failed:', err));
    });
  }
}
