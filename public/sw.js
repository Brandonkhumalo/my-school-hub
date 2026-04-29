// My School Hub — Service Worker v5
// Strategies:
//   API requests      → Network-first; offline falls through to main-thread IndexedDB layer
//   Navigation        → Network-first; fallback cached index.html → offline.html
//   Static assets     → Stale-while-revalidate
//   Background sync   → Drain IndexedDB sync-queue when back online

const CACHE_NAME = "myschoolhub-v5";
const APP_SHELL = ["/", "/index.html", "/manifest.json", "/offline.html"];
const DB_NAME = "myschoolhub-offline";
const API_BASE = "/api/v1";

// ── Vanilla IDB helpers (SW can't use the idb npm package) ───────────────────

function openSWDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    // If the main thread hasn't created the DB yet, create it with same schema
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("api-cache")) {
        db.createObjectStore("api-cache");
      }
      if (!db.objectStoreNames.contains("sync-queue")) {
        const store = db.createObjectStore("sync-queue", {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("by-timestamp", "timestamp");
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta");
      }
    };
  });
}

function dbGetAll(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbDelete(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

function dbGet(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Sync queue drain ──────────────────────────────────────────────────────────

async function drainSyncQueue() {
  let db;
  try {
    db = await openSWDb();
  } catch {
    return; // DB not ready yet — nothing to drain
  }

  const tokenRecord = await dbGet(db, "meta", "auth_token").catch(() => null);
  const token = tokenRecord?.value;

  const items = await dbGetAll(db, "sync-queue").catch(() => []);
  if (!items.length) return;

  // Replay in chronological order
  const sorted = items.slice().sort((a, b) => a.timestamp - b.timestamp);

  const notifyClients = async (count) => {
    const clients = await self.clients.matchAll({ type: "window" });
    clients.forEach((c) =>
      c.postMessage({ type: "SYNC_COMPLETE", count })
    );
  };

  let synced = 0;
  for (const item of sorted) {
    try {
      const res = await fetch(`${API_BASE}${item.endpoint}`, {
        method: item.method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: item.body ? JSON.stringify(item.body) : undefined,
      });

      // 2xx or 409 (idempotency duplicate) — remove from queue
      if (res.ok || res.status === 409) {
        await dbDelete(db, "sync-queue", item.id);
        synced++;
      }
    } catch {
      // Network still down — leave item in queue and stop trying
      break;
    }
  }

  if (synced > 0) {
    await notifyClients(synced);
  }
}

// ── Install: pre-cache app shell ──────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(
        APP_SHELL.map(async (asset) => {
          try {
            await cache.add(asset);
          } catch (_) {
            // Non-fatal — runtime fetch can recover
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
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Static asset helper ───────────────────────────────────────────────────────

function isStaticAssetRequest(request, url) {
  return (
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "image" ||
    request.destination === "font" ||
    url.pathname.startsWith("/assets/")
  );
}

async function putInCache(key, response) {
  const cache = await caches.open(CACHE_NAME);
  await cache.put(key, response);
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || !url.protocol.startsWith("http")) return;

  // API requests → network-first; offline: return JSON sentinel so the main
  // thread's apiService can fall through to IndexedDB cache.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(
          JSON.stringify({ error: "offline", offline: true }),
          {
            status: 503,
            headers: { "Content-Type": "application/json", "X-Offline": "true" },
          }
        )
      )
    );
    return;
  }

  // Navigation requests → network-first, fallback index.html → offline.html
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
          const offlinePage = await caches.match("/offline.html");
          if (offlinePage) return offlinePage;
          return new Response(
            "<h1>You are offline</h1><p>Please check your connection.</p>",
            { headers: { "Content-Type": "text/html" } }
          );
        }
      })()
    );
    return;
  }

  // Static assets → stale-while-revalidate
  if (isStaticAssetRequest(request, url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        const networkFetch = fetch(request)
          .then(async (response) => {
            if (response.ok) await cache.put(request, response.clone());
            return response;
          })
          .catch(() => null);
        return cached || (await networkFetch) || Response.error();
      })()
    );
    return;
  }

  // Everything else → network with cache fallback
  event.respondWith(
    fetch(request).catch(async () => {
      const cached = await caches.match(request);
      return cached || Response.error();
    })
  );
});

// ── Background sync ───────────────────────────────────────────────────────────

self.addEventListener("sync", (event) => {
  if (event.tag === "sync-queue") {
    event.waitUntil(drainSyncQueue());
  }
});

// ── Online recovery: drain queue when the SW detects connectivity ─────────────
// This fires when a fetch succeeds after a period of failure (browsers vary).
// The primary trigger is the Background Sync API above; this is a safety net.

self.addEventListener("message", (event) => {
  if (event.data?.type === "DRAIN_SYNC_QUEUE") {
    drainSyncQueue();
  }
});
