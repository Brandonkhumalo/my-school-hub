// My School Hub — Service Worker
// Uses:
// - Network-first for API + navigation requests
// - Stale-while-revalidate for static assets
// This avoids serving synthetic 503 responses for page/assets fetches.

const CACHE_NAME = "myschoolhub-v4";
const APP_SHELL = ["/", "/index.html", "/manifest.json"];

async function putInCache(request, response) {
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response);
}

function isStaticAssetRequest(request, url) {
  return (
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "image" ||
    request.destination === "font" ||
    url.pathname.startsWith("/assets/")
  );
}

// ── Install: pre-cache app shell ───────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(
        APP_SHELL.map(async (asset) => {
          try {
            await cache.add(asset);
          } catch (_) {
            // Ignore failed pre-cache for now; runtime fetch can recover.
          }
        })
      );
      self.skipWaiting();
    })()
  );
});

// ── Activate: remove old caches ───────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch ──────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and browser-extension requests.
  if (request.method !== "GET" || !url.protocol.startsWith("http")) return;

  // API requests → Network first. On offline fallback, return JSON 503.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch (_) {
          const cached = await caches.match(request);
          if (cached) return cached;
          return new Response(
            JSON.stringify({ error: "You are offline. Please check your connection." }),
            {
              status: 503,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      })()
    );
    return;
  }

  // Navigation requests → Network first, fallback to cached app shell.
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            await putInCache("/index.html", response.clone());
          }
          return response;
        } catch (_) {
          const cachedIndex = await caches.match("/index.html");
          if (cachedIndex) return cachedIndex;
          return new Response("<h1>Offline</h1>", {
            headers: { "Content-Type": "text/html" },
          });
        }
      })()
    );
    return;
  }

  // Static assets → Stale-while-revalidate.
  if (isStaticAssetRequest(request, url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        const networkFetch = fetch(request)
          .then(async (response) => {
            if (response.ok) {
              await cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => null);

        return cached || (await networkFetch) || Response.error();
      })()
    );
    return;
  }

  // Everything else → network with cache fallback.
  event.respondWith(
    fetch(request).catch(async () => {
      const cached = await caches.match(request);
      return cached || Response.error();
    })
  );
});

// ── Background sync placeholder ───────────────────────────────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-submissions") {
    // Future: replay queued assignment submissions when back online.
    console.log("[SW] Background sync triggered:", event.tag);
  }
});
