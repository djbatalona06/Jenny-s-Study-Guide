/* MA Study — offline service worker.
   Cache-first for the app shell and static assets (icons, vendored three.js,
   GLB models), with runtime caching + stale-while-revalidate for everything
   else so the app keeps working offline. Bump CACHE when the shell changes. */
"use strict";

var CACHE = "ma-study-v2";
var CORE = [
  "./",
  "index.html",
  "manifest.json",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "vendor/three/three.module.js",
  "vendor/three/GLTFLoader.js",
  "vendor/three/OrbitControls.js",
  "vendor/three/DRACOLoader.js",
  "vendor/three/BufferGeometryUtils.js",
  "vendor/three/draco/draco_wasm_wrapper.js",
  "vendor/three/draco/draco_decoder.wasm"
];

self.addEventListener("install", function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // Best-effort: never fail install if one optional asset 404s.
      return Promise.all(CORE.map(function (url) {
        return c.add(url).catch(function () {});
      }));
    })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first, fall back to cached shell (offline).
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (m) { return m || caches.match("index.html"); });
      })
    );
    return;
  }

  // Static assets: cache-first, then network (and cache the result).
  e.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) {
        // Refresh in the background (stale-while-revalidate).
        fetch(req).then(function (res) {
          if (res && res.ok) caches.open(CACHE).then(function (c) { c.put(req, res.clone()); });
        }).catch(function () {});
        return cached;
      }
      return fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return cached; });
    })
  );
});
