# HC MUSIFY

Web music player (YouTube Music search + streaming).

## Tema
Default: **Glass hitam transparan** (`public/theme-glass.css`). Tampilan **Comic** (`public/theme.css`) bisa dipilih lewat tombol *Ganti Tema* di Home / Profile (`public/theme-switch.js`). Dulu: neo-brutalist light (krem + merah, border hitam, bayangan keras) mengikuti WEBSITE_STORE.
Semua warna diatur di `public/theme.css` (palet di `:root` paling atas). Full player & lirik sengaja tetap gelap.

## Struktur
```
public/        -> website statis (HTML/CSS/JS)
api/           -> Vercel Serverless/Edge Functions (search, lyrics, ytplay, proxy-audio, dll)
vercel.json    -> routing + rewrite
```

## Deploy ke Netlify atau Vercel
Project ini jalan di dua-duanya (`netlify.toml` + `netlify/` untuk Netlify, `vercel.json` + `api/` untuk Vercel).
Di Netlify: kalau pengunjung disuruh login Netlify, itu bukan dari kode, tapi setting
Project configuration -> General -> Visitor access (Project visibility / Site Protection) di dashboard.
Pakai URL production (bukan URL deploy preview / branch deploy) dan set visibility ke publik.

### Vercel
1. Upload project ini ke GitHub.
2. Buka vercel.com -> Add New -> Project -> pilih repo -> Deploy.
3. Selesai. Link `xxx.vercel.app` bisa dibuka siapa aja.

Kalau link malah minta login Vercel: Project -> Settings -> Deployment Protection -> set ke **Disabled**.

Tidak butuh environment variable.

## Lokal
Tidak ada server lokal (sudah dihapus supaya Vercel tidak salah deteksi sebagai Express). Test langsung lewat deploy.

## Anti-crash pemutar (v2.2.0)
- `public/sw.js`: stream audio TIDAK lagi lewat service worker (SW yang dimatikan browser memutus stream -> musik berhenti kalau lama).
- `public/player.js`: preload `new Audio()` yang bocor dihapus; recovery pakai backoff 8x + watchdog "beku"; stream terpotong tidak dianggap lagu selesai; antrean auto-next dibatasi; UI tidak digambar saat layar mati.
- `public/player-guard.js`: simpan sesi tiap 5 dtk, pulihkan lagu terakhir setelah crash, anti crash-loop, jaga memori.
- `api/proxy-audio.js` & `netlify/edge-functions/proxy-audio.js`: putus upstream saat klien putus, retry 1x.
- Sisi APK: lihat `APK_CRASH_FIX.md`.

## Notifikasi Push dari bot WhatsApp (v2.3.0)
Command `.notif <teks>` di bot Anya MD -> notifikasi muncul di HP semua pengguna yang sudah klik "Aktifkan notifikasi" (walau web/app ditutup).
- `public/notif.js` : prompt aktifkan notifikasi + tombol di Profile. `public/sw.js` : handler `push` + `notificationclick`.
- `api/notif-key.js`, `api/notif-subscribe.js`, `api/notif-send.js` (+ `api/_push.js`), wrapper Netlify di `netlify/functions/notif-*.js`.
- Penyimpanan langganan: Netlify Blobs (otomatis di Netlify) / Upstash Redis (Vercel) / file lokal (dev).
- WAJIB set 1 environment variable di hosting: `NOTIF_SECRET` (kata sandi bebas, harus sama dengan yang di plugin bot). Kunci VAPID dibuat otomatis (opsional set `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` sendiri).
- Tidak jalan di WebView APK; jalan di Chrome/PWA. iPhone: harus Install PWA dulu.

## Tampilan Pro + Banner 16:9 (v9_12)
- `public/pro.css` + `public/hc-ui.js`: komponen halaman Search/Library/Offline/Liked/Profile (ikut tema Glass & Comic).
- `.hc-hero` = banner 16:9 semua halaman. Gambar banner punya ruang langit di atas kepala (judul+tombol nempel di atas, wajah tetap kelihatan). Dipilih lewat `banner-switch.js` (`--hc-banner`, `--hc-banner-pos`).

## APK (v9_13)
Taruh file APK di `public/HC-MUSIFY.apk` -> tombol Install APK mengunduh ke daftar Unduhan HP (tidak langsung install) dan linknya bisa dibagikan (`https://domain-kamu/HC-MUSIFY.apk`). Atau ganti `Promosi.apk.url` di `public/promosi.js` pakai link luar.
