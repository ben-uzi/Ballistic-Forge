/**
 * Ballistic Forge service worker.
 *
 * Goal (BUILD_BRIEF §6.2): once the calculator has been opened, it keeps
 * working with no connection. Written by hand rather than generated so the
 * caching rules are readable and there is no build-time plugin to keep in step
 * with Next's output.
 *
 * Strategy
 *  - Build assets (/_next/static/**) are content-hashed and immutable → cache-first.
 *  - Navigations → network-first with a cached shell fallback, so a deploy is
 *    picked up immediately when online but the app still opens when offline.
 *  - Icons, manifest, brand art → stale-while-revalidate.
 *  - Everything else (API calls, Supabase) → straight to the network, never cached.
 */

const VERSION = 'v1';
const SHELL_CACHE = `bf-shell-${VERSION}`;
const ASSET_CACHE = `bf-assets-${VERSION}`;
const OFFLINE_URL = '/calc';

const PRECACHE = [OFFLINE_URL, '/', '/manifest.webmanifest', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // A failed precache must not block activation; the runtime handlers will fill in.
      .then((cache) => cache.addAll(PRECACHE).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('bf-') && key !== SHELL_CACHE && key !== ASSET_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isImmutableAsset(url) {
  return url.pathname.startsWith('/_next/static/');
}

function isCacheableAsset(url) {
  return (
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/brand/') ||
    url.pathname === '/manifest.webmanifest'
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache data endpoints: a stale waitlist or session response is worse than an error.
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached ?? (await caches.match(OFFLINE_URL)) ?? Response.error();
        }),
    );
    return;
  }

  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
    return;
  }

  if (isCacheableAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            const copy = response.clone();
            caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
            return response;
          })
          .catch(() => cached ?? Response.error());
        return cached ?? network;
      }),
    );
  }
});
