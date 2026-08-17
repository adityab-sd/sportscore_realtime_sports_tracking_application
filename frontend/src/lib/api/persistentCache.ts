const DB_NAME = "sportscore-api-cache";
const STORE_NAME = "responses";
const DB_VERSION = 1;
const MAX_STALE_MS = 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

interface CacheRecord {
  key: string;
  data: unknown;
  storedAt: number;
  expiresAt: number;
}

const inFlight = new Map<string, Promise<unknown>>();
let dbPromise: Promise<IDBDatabase> | null = null;
let lastCleanupAt = 0;

function openCache(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
      store.createIndex("expiresAt", "expiresAt");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

async function readCached(key: string): Promise<CacheRecord | null> {
  try {
    const db = await openCache();
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readonly")
        .objectStore(STORE_NAME)
        .get(key);
      request.onsuccess = () => resolve((request.result as CacheRecord | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

async function writeCached(record: CacheRecord): Promise<void> {
  try {
    const db = await openCache();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    void cleanupExpired(db);
  } catch {
    // Browser storage can be disabled or full; network data is still returned.
  }
}

async function cleanupExpired(db: IDBDatabase): Promise<void> {
  const now = Date.now();
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;

  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const index = transaction.objectStore(STORE_NAME).index("expiresAt");
      const request = index.openKeyCursor(IDBKeyRange.upperBound(now - MAX_STALE_MS));
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        transaction.objectStore(STORE_NAME).delete(cursor.primaryKey);
        cursor.continue();
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch {
    // Cleanup is best-effort and must not affect API requests.
  }
}

async function fetchFromNetwork<T>(url: string, revalidateSeconds: number): Promise<T> {
  const existing = inFlight.get(url);
  if (existing) return existing as Promise<T>;

  const request = (async () => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    const data = await response.json() as T;
    const now = Date.now();
    await writeCached({
      key: url,
      data,
      storedAt: now,
      expiresAt: now + Math.max(0, revalidateSeconds) * 1000,
    });
    return data;
  })();

  inFlight.set(url, request);
  try {
    return await request;
  } finally {
    inFlight.delete(url);
  }
}

/**
 * Uses Next.js' data cache on the server and IndexedDB in the browser.
 * Expired browser entries are retained briefly as an offline/error fallback.
 */
export async function cachedApiGet<T>(
  url: string,
  fallback: T,
  revalidateSeconds: number,
  source: string,
): Promise<T> {
  if (typeof window === "undefined") {
    try {
      const response = await fetch(url, { next: { revalidate: revalidateSeconds } });
      if (!response.ok) {
        console.error(`[${source}] Fetch failed: ${response.status} ${response.statusText} for ${url}`);
        return fallback;
      }
      return await response.json() as T;
    } catch (error) {
      console.error(`[${source}] Network/parse error for ${url}:`, error);
      return fallback;
    }
  }

  const cached = await readCached(url);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.data as T;
  }

  try {
    return await fetchFromNetwork<T>(url, revalidateSeconds);
  } catch (error) {
    if (cached && now - cached.expiresAt <= MAX_STALE_MS) {
      return cached.data as T;
    }
    console.error(`[${source}] Network/parse error for ${url}:`, error);
    return fallback;
  }
}
