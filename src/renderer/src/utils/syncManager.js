import localforage from 'localforage';

// Stores exact API responses by URL for offline GETs
export const cacheDB = localforage.createInstance({
  name: 'HisabKitab',
  storeName: 'api_cache'
});

// Stores mutated requests (POST, PUT, DELETE) when offline
export const queueDB = localforage.createInstance({
  name: 'HisabKitab',
  storeName: 'sync_queue'
});

// Event target to notify components of sync status changes
export const syncEvents = new EventTarget();

export async function isOnline() {
  return navigator.onLine; // Basic browser implementation
}

/**
 * Perform a GET request. 
 * If online, fetch and cache the result.
 * If offline, or if fetch fails, return the cached result.
 */
export async function fetchWithCache(url, fetcher) {
  try {
    if (!navigator.onLine) {
      throw new Error('Offline');
    }
    const data = await fetcher();
    // Cache the response asynchronously
    cacheDB.setItem(url, data).catch(console.error);
    return data;
  } catch (err) {
    // Attempt fallback to cache
    const cachedData = await cacheDB.getItem(url);
    if (cachedData) {
      return cachedData;
    }
    throw err; // No cache available
  }
}

/**
 * Queue a mutation request.
 */
export async function queueMutation(url, method, body) {
  const reqId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
  await queueDB.setItem(reqId, { url, method, body, timestamp: Date.now() });
  syncEvents.dispatchEvent(new Event('queueUpdated'));
}

/**
 * Try to run all requests in the queue.
 */
export async function syncQueue(apiBase) {
  if (!navigator.onLine) return; // Cannot sync right now

  const keys = await queueDB.keys();
  if (keys.length === 0) {
    syncEvents.dispatchEvent(new Event('syncComplete'));
    return;
  }

  syncEvents.dispatchEvent(new Event('syncStarted'));
  let hasErrors = false;

  // Process keys in order of timestamp
  const items = [];
  for (const key of keys) {
    const data = await queueDB.getItem(key);
    items.push({ key, ...data });
  }
  items.sort((a, b) => a.timestamp - b.timestamp);

  for (const item of items) {
    try {
      const response = await fetch(`${apiBase}${item.url}`, {
        method: item.method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: item.body ? JSON.stringify(item.body) : undefined
      });
      if (response.ok) {
        await queueDB.removeItem(item.key);
      } else if (response.status === 409) {
        // Conflict! The server record is newer than what we had.
        console.warn('Sync conflict on item:', item);
        await queueDB.setItem(item.key, { ...item, conflict: true, errorMsg: await response.text() });
        hasErrors = true;
      } else {
        hasErrors = true;
        console.error('Failed to sync item:', item, await response.text());
      }
    } catch (err) {
      console.error('Network error syncing item:', item, err);
      hasErrors = true;
      break; // Stop syncing on network error
    }
  }

  syncEvents.dispatchEvent(new Event('queueUpdated'));
  if (!hasErrors && keys.length > 0) {
    syncEvents.dispatchEvent(new Event('syncComplete'));
  }
}

// Global listeners
window.addEventListener('online', () => {
  syncEvents.dispatchEvent(new Event('onlineStatus'));
  syncQueue('/api'); // Assume api wrapper handles baseUrl
});
window.addEventListener('offline', () => {
  syncEvents.dispatchEvent(new Event('onlineStatus'));
});
