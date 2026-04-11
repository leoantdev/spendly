/* Loaded by the service worker via workbox importScripts. Drops legacy private HTML cache. */
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.delete("pages-cache"))
})
