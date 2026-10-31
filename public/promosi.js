// ============================================================
// PROMOSI.JS — Data promosi HC MUSIFY (dipakai oleh profile.js)
// Edit file ini aja kalau mau ganti link/teks promosi,
// ga perlu utak-atik tampilan di profile.js.
// ============================================================
var Promosi = {
    website: {
        title: "Kunjungi Website",
        desc: "Akses HC MUSIFY langsung dari browser tanpa install.",
        url: (typeof location !== "undefined" ? location.origin : ""),
        label: (typeof location !== "undefined" ? location.host : "")
    },
    // PWA = install dari browser (tanpa link).
    // APK = file yang DIUNDUH ke daftar Unduhan HP (nggak langsung install), linknya bisa dibagikan.
    // Cara pakai: taruh file APK kamu di folder public/ dengan nama HC-MUSIFY.apk -> link otomatis jadi
    //   https://DOMAIN-KAMU/HC-MUSIFY.apk  (bisa di-share). Atau ganti url di bawah pakai link luar (MediaFire dll).
    pwa: {
        title: "Install Aplikasi (PWA)",
        desc: "Support Mode Offline"
    },
    apk: {
        title: "Install Aplikasi (APK)",
        desc: "Download file APK",
        url: "/HC-MUSIFY.apk"
    },
    social: {
        tiktok: {
            label: "TikTok",
            url: "https://tiktok.com/@cikhub_" // TODO: ganti dengan link TikTok asli
        },
        discord: {
            label: "Discord",
            url: "#" // TODO: ganti dengan link server Discord asli
        },
        whatsapp: {
            label: "Channel",
            url: "https://whatsapp.com/channel/0029Vb5aoKwEwEjpsmaQol3A"
        }
    },

    // Daftar promosi website/apk yang ditampilkan sebagai list di halaman Profil.
    // Tinggal tambah/hapus/urutkan item di sini, tampilan otomatis mengikuti.
    // type: "link"  -> buka url di tab baru
    // type: "share" -> pakai fitur share bawaan HP (Web Share API), fallback copy link
    list: [
        {
            icon: "globe",
            color: "text-sky-400",
            title: "HC-RBX-FINDER",
            desc: "🔎 RBX FINDER — Cari Sumber Aset Roblox Secepat Kilat!",
            label: "hcrbxfinder.vercel.app/",
            url: "https://hcrbxfinder.vercel.app/",
            type: "link"
        },
        {
            icon: "package",
            color: "text-rose-400",
            title: "HC COMIC",
            desc: "Aplikasi baca comic - segera hadir",
            badge: "Coming Soon",
            type: "soon"
        }
    ]
};
