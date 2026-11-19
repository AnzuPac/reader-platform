/*
 * Service worker: без него «офлайн-глава» открывается только при живом
 * интернете — сам shell приложения всё равно не загрузится.
 *
 * Стратегия:
 *  - навигация (HTML): network-first, при падении сети — из кеша;
 *  - статика (/_next/static, шрифты, картинки): cache-first;
 *  - /api/* — не кешируем вовсе (там приватные данные и свежесть).
 */
const CACHE = 'rd-shell-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  const isStatic = url.pathname.startsWith('/_next/static') || /\.(css|js|woff2?|ttf|otf|png|jpg|jpeg|webp|svg|ico)$/.test(url.pathname);

  if (isStatic) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      const res = await fetch(req);
      if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    })());
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
        return res;
      } catch {
        const cached = await caches.match(req);
        if (cached) return cached;
        const fallback = await caches.match('/offline-fallback');
        if (fallback) return fallback;
        return new Response(
          '<!doctype html><meta charset="utf-8"><title>Offline</title><p style="font-family:system-ui;padding:24px">Нет сети, и эта страница не сохранена. Откройте «Для офлайна» в библиотеке.</p>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 },
        );
      }
    })());
  }
});
