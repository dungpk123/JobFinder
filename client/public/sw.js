const SHELL_CACHE = "jobfinder-shell-v1";
const STATIC_CACHE = "jobfinder-static-v1";

const APP_SHELL_FILES = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon-32x32.png",
  "/apple-touch-icon.png",
  "/pwa-192x192.png",
  "/pwa-512x512.png",
  "/pwa-maskable-512x512.png",
];

const API_PREFIXES = [
  "/api",
  "/auth",
  "/users",
  "/applications",
  "/cvs",
  "/jobs",
];

const STATIC_FILE_RE = /\.(?:js|css|png|jpg|jpeg|svg|webp|ico|json|woff2?|ttf)$/i;

const FIREBASE_MESSAGING_CONFIG = {
  apiKey: 'AIzaSyB4-ASQPmNbDMVuSxwp33WXqsX0vNlOgto',
  authDomain: 'jobfinder-fc89f.firebaseapp.com',
  projectId: 'jobfinder-fc89f',
  storageBucket: 'jobfinder-fc89f.firebasestorage.app',
  messagingSenderId: '470606415903',
  appId: '1:470606415903:web:e8f84eecf9a3844df06d2a',
  measurementId: 'G-WZGNZ52YHK'
};

try {
  importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

  if (self.firebase?.apps?.length === 0) {
    self.firebase.initializeApp(FIREBASE_MESSAGING_CONFIG);
  }

  if (self.firebase?.messaging) {
    const messaging = self.firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      const title = String(
        payload?.notification?.title
        || payload?.data?.title
        || 'Thong bao JobFinder'
      ).trim();

      const body = String(
        payload?.notification?.body
        || payload?.data?.body
        || payload?.data?.message
        || 'Ban co thong bao moi.'
      ).trim();

      const targetUrl = String(
        payload?.fcmOptions?.link
        || payload?.data?.url
        || payload?.data?.link
        || '/messages'
      ).trim() || '/messages';

      const icon = String(payload?.notification?.icon || '/pwa-192x192.png').trim() || '/pwa-192x192.png';
      const badge = String(payload?.notification?.badge || '/favicon-32x32.png').trim() || '/favicon-32x32.png';

      self.registration.showNotification(title, {
        body,
        icon,
        badge,
        tag: String(payload?.messageId || 'jobfinder-fcm'),
        renotify: true,
        data: { url: targetUrl }
      });
    });
  }
} catch (error) {
  console.warn('Firebase Messaging unavailable in service worker:', error);
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_FILES)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => ![SHELL_CACHE, STATIC_CACHE].includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url || "/messages";
  const absoluteUrl = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url && client.url.includes(targetUrl)) {
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(absoluteUrl);
      }

      return undefined;
    })
  );
});

const isApiRequest = (pathname) => API_PREFIXES.some((prefix) => pathname.startsWith(prefix));

const staleWhileRevalidate = async (request) => {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.status === 200) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  return cached || networkPromise;
};

const handleNavigationRequest = async (request) => {
  const shellCache = await caches.open(SHELL_CACHE);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      shellCache.put("/index.html", networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const cachedIndex = await shellCache.match("/index.html");
    if (cachedIndex) {
      return cachedIndex;
    }

    const cachedRoot = await shellCache.match("/");
    if (cachedRoot) {
      return cachedRoot;
    }

    return Response.error();
  }
};

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(event.request));
    return;
  }

  if (isApiRequest(url.pathname)) {
    return;
  }

  if (STATIC_FILE_RE.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event.request));
  }
});
