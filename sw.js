/* הַסֵּפֶר — service worker
   האפליקציה עצמה: רשת קודם, מטמון כגיבוי (כדי שעדכונים יגיעו מיד).
   נכסים ופונטים: מטמון קודם.
   בקשות לגיטהאב: אף פעם לא נכנסות למטמון. */

const VERSION = "hasefer-v3";
const SHELL = [
  "./hasefer-v2.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-180.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isFont(url){
  return url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }

  /* נתונים חיים — תמיד מהרשת, בלי מטמון */
  if (url.hostname === "api.github.com" || url.hostname === "raw.githubusercontent.com") return;

  /* פונטים — מטמון קודם, ורענון ברקע */
  if (isFont(url)) {
    e.respondWith(
      caches.open(VERSION).then(c =>
        c.match(req).then(hit => {
          const net = fetch(req).then(res => {
            if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone());
            return res;
          }).catch(() => hit);
          return hit || net;
        })
      )
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  const isDoc = req.mode === "navigate" || url.pathname.endsWith(".html");

  if (isDoc) {
    /* רשת קודם — כך עדכון של האפליקציה מגיע מיד כשיש אינטרנט */
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then(hit => hit || caches.match("./hasefer-v2.html")))
    );
    return;
  }

  /* שאר הנכסים — מטמון קודם */
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy));
      }
      return res;
    }))
  );
});

self.addEventListener("message", e => {
  if (e.data === "skipWaiting") self.skipWaiting();
});
