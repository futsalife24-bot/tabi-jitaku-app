const CACHE = 'tabi-jitaku-assets-v4';
const ASSETS = ['./', './index.html', './styles.css', './app.mjs', './core.mjs', './manifest.webmanifest', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png', './assets/coastal-journey.webp'];
const allowed = new Set(ASSETS.map(path => new URL(path, self.registration.scope).href));
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('tabi-jitaku-assets-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  url.search = ''; url.hash = '';
  if (event.request.method !== 'GET' || !allowed.has(url.href)) return;
  // 保存するのは配信済みのアプリ本体だけ。家族情報や入力内容は扱わない。
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(event.request);
      if (response.ok) { await cache.put(url.href, response.clone()); return response; }
      return (await cache.match(url.href)) || response;
    } catch {
      const cached = await cache.match(url.href);
      return cached || new Response('初回はインターネットに接続してアプリを開いてください。', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
