import { openDB } from 'idb';

const DB_NAME = 'myschoolhub-offline';
const DB_VERSION = 1;

// TTL in milliseconds per endpoint prefix
const TTL_MAP = [
  ['/auth/profile', 24 * 60 * 60 * 1000],
  ['/auth/school/settings', 24 * 60 * 60 * 1000],
  ['/auth/school/customization', 24 * 60 * 60 * 1000],
  ['/auth/school/current-period', 24 * 60 * 60 * 1000],
  ['/academics/timetables', 6 * 60 * 60 * 1000],
  ['/students/timetable', 6 * 60 * 60 * 1000],
  ['/teachers/classes', 6 * 60 * 60 * 1000],
  ['/academics/subjects', 6 * 60 * 60 * 1000],
  ['/academics/classes', 6 * 60 * 60 * 1000],
  ['/academics/results', 60 * 60 * 1000],
  ['/students/marks', 60 * 60 * 1000],
  ['/students/dashboard', 15 * 60 * 1000],
  ['/auth/dashboard', 15 * 60 * 1000],
  ['/finances/', 60 * 60 * 1000],
  ['/library/', 60 * 60 * 1000],
  ['/parents/children', 60 * 60 * 1000],
  ['/academics/announcements', 30 * 60 * 1000],
  ['/students/announcements', 30 * 60 * 1000],
  ['/teachers/homework', 30 * 60 * 1000],
  ['/students/homework', 30 * 60 * 1000],
  ['/parents/homework', 30 * 60 * 1000],
  ['/auth/notifications', 5 * 60 * 1000],
];

const DEFAULT_TTL = 30 * 60 * 1000;

function getTtl(endpoint) {
  for (const [prefix, ttl] of TTL_MAP) {
    if (endpoint.startsWith(prefix)) return ttl;
  }
  return DEFAULT_TTL;
}

let dbPromise = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('api-cache')) {
          db.createObjectStore('api-cache');
        }
        if (!db.objectStoreNames.contains('sync-queue')) {
          const store = db.createObjectStore('sync-queue', {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('by-timestamp', 'timestamp');
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta');
        }
      },
    });
  }
  return dbPromise;
}

export async function getCachedResponse(userId, endpoint) {
  try {
    const db = await getDb();
    return db.get('api-cache', `${userId}:${endpoint}`);
  } catch {
    return null;
  }
}

export async function setCachedResponse(userId, endpoint, data) {
  try {
    const db = await getDb();
    await db.put(
      'api-cache',
      { data, timestamp: Date.now(), ttl: getTtl(endpoint) },
      `${userId}:${endpoint}`
    );
  } catch {
    // Non-fatal — cache is best-effort
  }
}

export function isStale(entry) {
  if (!entry) return true;
  return Date.now() - entry.timestamp > entry.ttl;
}

export async function addToSyncQueue(endpoint, method, body) {
  try {
    const db = await getDb();
    await db.add('sync-queue', {
      endpoint,
      method,
      body,
      timestamp: Date.now(),
      retries: 0,
    });
  } catch {
    // Non-fatal
  }
}

export async function getSyncQueue() {
  try {
    const db = await getDb();
    return db.getAll('sync-queue');
  } catch {
    return [];
  }
}

export async function removeFromSyncQueue(id) {
  try {
    const db = await getDb();
    await db.delete('sync-queue', id);
  } catch {
    // Non-fatal
  }
}

export async function pendingSyncCount() {
  try {
    const db = await getDb();
    return db.count('sync-queue');
  } catch {
    return 0;
  }
}

export async function clearUserCache(userId) {
  try {
    const db = await getDb();
    const tx = db.transaction('api-cache', 'readwrite');
    const store = tx.objectStore('api-cache');
    const keys = await store.getAllKeys();
    await Promise.all(
      keys
        .filter((k) => String(k).startsWith(`${userId}:`))
        .map((k) => store.delete(k))
    );
    await tx.done;
  } catch {
    // Non-fatal
  }
}

export async function setMetaToken(token) {
  try {
    const db = await getDb();
    await db.put('meta', { value: token }, 'auth_token');
  } catch {
    // Non-fatal
  }
}

export async function clearMetaToken() {
  try {
    const db = await getDb();
    await db.delete('meta', 'auth_token');
    await db.delete('meta', 'user_id');
  } catch {
    // Non-fatal
  }
}

export async function setMetaUserId(userId) {
  try {
    const db = await getDb();
    await db.put('meta', { value: userId }, 'user_id');
  } catch {
    // Non-fatal
  }
}
