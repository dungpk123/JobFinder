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
