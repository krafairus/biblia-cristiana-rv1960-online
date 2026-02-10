const CACHE_NAME = 'biblia-app-v5'; // Versión 5: Force JSON refresh
const ASSETS = [
    './',
    './index.html',
    './bibles_rv1960.json',
    './dictionary.json',
    './libs/lucide.min.js',
    './assets/fonts/Inter-VariableFont_opsz,wght.ttf',
    './assets/fonts/Inter-Italic-VariableFont_opsz,wght.ttf',
    './assets/fonts/PlayfairDisplay-VariableFont_wght.ttf',
    './assets/fonts/PlayfairDisplay-Italic-VariableFont_wght.ttf'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    // Cache-First strategy for local assets
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            return fetch(event.request);
        })
    );
});
