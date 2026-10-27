// Service worker: membuat aplikasi bisa dipasang dan terbuka cepat.
// Data keuangan TIDAK disimpan di sini; semuanya tetap di Supabase.
const VERSI = "keuangan-v1";
const ASET = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];
const CDN = ["cdn.jsdelivr.net", "unpkg.com", "cdnjs.cloudflare.com"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSI).then(c => c.addAll(ASET)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VERSI).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Halaman utama: ambil dari internet dulu (supaya versi terbaru langsung dipakai), cadangan dari cache.
  if (req.mode === "navigate" && url.origin === location.origin) {
    e.respondWith(
      fetch(req)
        .then(r => { if (r.ok) { const c = r.clone(); caches.open(VERSI).then(ca => ca.put("index.html", c)); } return r; })
        .catch(() => caches.match("index.html").then(r => r || caches.match("./")))
    );
    return;
  }

  // Berkas statis milik sendiri: pakai cache, ambil dari internet kalau belum ada.
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(r => {
        if (r.ok) { const c = r.clone(); caches.open(VERSI).then(ca => ca.put(req, c)); }
        return r;
      }))
    );
    return;
  }

  // Pustaka dari CDN (Supabase JS, Excel): simpan agar aplikasi tetap bisa dibuka saat sinyal buruk.
  if (CDN.includes(url.hostname)) {
    e.respondWith(
      caches.match(req).then(hit => {
        const baru = fetch(req).then(r => {
          if (r.ok || r.type === "opaque") { const c = r.clone(); caches.open(VERSI).then(ca => ca.put(req, c)); }
          return r;
        }).catch(() => hit);
        return hit || baru;
      })
    );
  }
  // Selain itu (termasuk API Supabase): tidak disentuh, selalu langsung ke internet.
});
