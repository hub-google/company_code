const CACHE_NAME = 'job-code-v2';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then(res => res || fetch(e.request).then(fetchRes => {
            // 動態快取 Google Fonts 等外部靜態資源
            if (e.request.url.startsWith('https://fonts.googleapis.com/') || 
                e.request.url.startsWith('https://fonts.gstatic.com/')) {
                const resClone = fetchRes.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(e.request, resClone));
            }
            return fetchRes;
        }))
    );
});
