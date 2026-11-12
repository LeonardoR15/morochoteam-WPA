/* MorochoTeam · Service Worker
   Estrategias:
   - App shell (HTML/CSS/JS/iconos): cache-first con actualización en segundo plano.
   - Navegación: network-first con fallback al shell cacheado y a offline.html.
   - API PHP: network-only. Nunca se cachean respuestas con datos de alumnos,
     cuentas corrientes, pagos o sesiones.
   - CDN (Bootstrap, iconos, fuentes): stale-while-revalidate.
*/

var CACHE_VERSION = 'morochoteam-v4';
var SHELL_CACHE = CACHE_VERSION + '-shell';
var RUNTIME_CACHE = CACHE_VERSION + '-runtime';

var SHELL_ASSETS = [
  './',
  './index.html',
  './trainer.html',
  './alumno.html',
  './offline.html',
  './manifest.json',
  './assets/css/variables.css',
  './assets/css/styles.css',
  './assets/js/app.js',
  './assets/js/theme.js',
  './assets/js/login.js',
  './assets/js/trainer.js',
  './assets/js/alumno.js',
  './assets/img/icon.svg',
  './assets/img/icon-192.png',
  './assets/img/icon-512.png',
  './assets/img/icon-maskable-512.png',
  './assets/img/apple-touch-icon.png',
  './assets/img/logo-mark.png',
  './assets/img/ejercicio-placeholder.svg'
];

var OFFLINE_URL = './offline.html';

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) {
      // Se precargan los recursos uno por uno para que un archivo faltante
      // no invalide toda la instalación del Service Worker.
      return Promise.all(
        SHELL_ASSETS.map(function (url) {
          return cache.add(new Request(url, { cache: 'reload' })).catch(function () {
            return null;
          });
        })
      );
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          if (key !== SHELL_CACHE && key !== RUNTIME_CACHE) {
            return caches.delete(key);
          }
          return null;
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function isApiRequest(url) {
  return url.pathname.indexOf('/api/') !== -1 || /\.php$/i.test(url.pathname);
}

function isSameOriginStatic(url) {
  return url.origin === self.location.origin && /\.(?:css|js|mjs|svg|png|jpe?g|webp|gif|ico|woff2?|ttf)$/i.test(url.pathname);
}

function isCdnAsset(url) {
  return url.origin !== self.location.origin && /(?:cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com|raw\.githubusercontent\.com)$/i.test(url.hostname);
}

function cacheFirst(request, cacheName) {
  return caches.open(cacheName).then(function (cache) {
    return cache.match(request).then(function (cached) {
      if (cached) {
        // Actualización silenciosa en segundo plano.
        fetch(request).then(function (response) {
          if (response && response.ok) cache.put(request, response.clone());
        }).catch(function () { /* offline */ });
        return cached;
      }

      return fetch(request).then(function (response) {
        if (response && response.ok) cache.put(request, response.clone());
        return response;
      });
    });
  });
}

function staleWhileRevalidate(request) {
  return caches.open(RUNTIME_CACHE).then(function (cache) {
    return cache.match(request).then(function (cached) {
      var network = fetch(request).then(function (response) {
        if (response && (response.ok || response.type === 'opaque')) {
          cache.put(request, response.clone());
        }
        return response;
      }).catch(function () {
        return cached;
      });

      return cached || network;
    });
  });
}

function networkFirstNavigation(request) {
  return fetch(request).then(function (response) {
    if (response && response.ok) {
      var copy = response.clone();
      caches.open(SHELL_CACHE).then(function (cache) {
        cache.put(request, copy);
      });
    }
    return response;
  }).catch(function () {
    return caches.match(request).then(function (cached) {
      if (cached) return cached;

      return caches.match(OFFLINE_URL).then(function (offline) {
        return offline || new Response(
          '<!DOCTYPE html><html lang="es"><meta charset="utf-8"><title>Sin conexión</title><body style="font-family:system-ui;background:#0A0B08;color:#F5F7EF;display:grid;place-items:center;min-height:100vh;margin:0"><div style="text-align:center"><h1>Sin conexión</h1><p>MorochoTeam necesita conexión para sincronizar tus datos.</p><a href="./index.html" style="color:#CCFF00">Reintentar</a></div></body></html>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      });
    });
  });
}

self.addEventListener('fetch', function (event) {
  var request = event.request;

  if (request.method !== 'GET') return;

  var url = new URL(request.url);

  // Datos sensibles: siempre a la red, jamás a la caché.
  if (isApiRequest(url)) {
    event.respondWith(
      fetch(request).catch(function () {
        return new Response(
          JSON.stringify({
            ok: false,
            error: 'Sin conexión. MorochoTeam necesita internet para sincronizar los datos.'
          }),
          {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'application/json; charset=utf-8' }
          }
        );
      })
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isSameOriginStatic(url)) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  if (isCdnAsset(url)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
