// ============================================
// FinTrack Service Worker
// Offline-first caching strategy
// ============================================

const CACHE_NAME = "fintrack-v1.0.0";
const RUNTIME_CACHE = "fintrack-runtime-v1";

// Assets to cache on install
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"
];

// ============================================
// INSTALL EVENT
// ============================================

self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker...");
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log("[SW] Caching static assets");
        return cache.addAll(STATIC_ASSETS.map(url => {
          return new Request(url, { cache: "reload" });
        })).catch((err) => {
          console.warn("[SW] Failed to cache some assets:", err);
          // Continue even if some assets fail to cache
        });
      })
      .then(() => {
        console.log("[SW] Service worker installed");
        return self.skipWaiting(); // Activate immediately
      })
  );
});

// ============================================
// ACTIVATE EVENT
// ============================================

self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker...");
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete old caches
            if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
              console.log("[SW] Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log("[SW] Service worker activated");
        return self.clients.claim(); // Take control of all pages
      })
  );
});

// ============================================
// FETCH EVENT
// ============================================

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Skip Chrome extension and other protocols
  if (!url.protocol.startsWith("http")) {
    return;
  }

  // Strategy: Cache First for static assets, Network First for API calls
  if (isStaticAsset(request.url)) {
    event.respondWith(cacheFirst(request));
  } else if (isAPIRequest(request.url)) {
    event.respondWith(networkFirst(request));
  } else {
    event.respondWith(networkFirst(request));
  }
});

// ============================================
// CACHING STRATEGIES
// ============================================

// Cache First: Check cache, fallback to network
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error("[SW] Cache first failed:", error);
    
    // Return offline page or fallback
    if (request.destination === "document") {
      const cache = await caches.open(CACHE_NAME);
      return cache.match("./index.html");
    }
    
    throw error;
  }
}

// Network First: Try network, fallback to cache
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful API responses
    if (networkResponse.ok && isAPIRequest(request.url)) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log("[SW] Network failed, trying cache:", request.url);
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // If it's an API request and we're offline, return empty array
    if (isAPIRequest(request.url)) {
      return new Response(JSON.stringify([]), {
        headers: { "Content-Type": "application/json" }
      });
    }

    throw error;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function isStaticAsset(url) {
  return url.includes("index.html") ||
         url.includes("style.css") ||
         url.includes("app.js") ||
         url.includes("manifest.json") ||
         url.includes("chart.js") ||
         url.endsWith(".png") ||
         url.endsWith(".jpg") ||
         url.endsWith(".svg");
}

function isAPIRequest(url) {
  return url.includes("sheetdb.io") || url.includes("/api/");
}

// ============================================
// BACKGROUND SYNC (Optional - for future)
// ============================================

self.addEventListener("sync", (event) => {
  if (event.tag === "sync-transactions") {
    event.waitUntil(syncTransactions());
  }
});

async function syncTransactions() {
  // This would sync pending transactions when back online
  // Implementation depends on your offline queue strategy
  console.log("[SW] Syncing transactions...");
}

// ============================================
// PUSH NOTIFICATIONS (Optional - for future)
// ============================================

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "FinTrack";
  const options = {
    body: data.body || "You have a new notification",
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-72.png",
    tag: data.tag || "default",
    data: data.url || "./"
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data || "./")
  );
});
