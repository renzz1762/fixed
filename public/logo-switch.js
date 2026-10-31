/* ============================================================
   GANTI LOGO APLIKASI (APK/PWA) — HC MUSIFY
   Pilihan foto PRESET (bukan upload dari galeri). Logo yang dimaksud
   di sini = logo aplikasi/ikon APK-PWA (favicon, logo splash screen,
   ikon shortcut) — BUKAN foto profil developer (/avatar.png), itu
   nggak disentuh sama fitur ini.
   Begitu ganti preset: favicon tab, logo splash, sama preview kartu
   ini ke-update otomatis (nggak perlu reload).
   Ikon buat file APK/PWA aslinya (icon-192.png, icon-512.png, dst)
   sudah di-generate dari preset ini pas build — jadi instalan
   baru/update APK-nya otomatis kebawa logo yang sama. Catatan: HP
   yang APK-nya udah ke-install duluan baru kebawa ikon baru kalau
   update/install ulang (itu emang cara kerja ikon PWA di OS, bukan
   bug dari fitur ini).
   ============================================================ */
(function () {
    var KEY = 'hc_logo_choice';
    var DEFAULT = 'preset1';
    var PRESETS = {
        preset1: { label: 'HC Musify', desc: 'Logo resmi aplikasi (foto)', url: '/logo-preset-1.png' }
    };
    var ORDER = ['preset1'];

    function read() { try { var v = localStorage.getItem(KEY); if (v && PRESETS[v]) return v; } catch (e) {} return DEFAULT; }
    function write(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
    var current = read();

    function url() { return PRESETS[current].url; }

    function applyToDom() {
        var u = url();
        var fav = document.getElementById('hc-favicon-link'); if (fav) fav.href = u;
        var apple = document.getElementById('hc-apple-icon-link'); if (apple) apple.href = u;
        var splash = document.getElementById('hc-splash-logo-img'); if (splash) splash.src = u;
        // foto profil + semua gambar logo yang bertanda data-hc-logo ikut berubah langsung (real time)
        try {
            var imgs = document.querySelectorAll('[data-hc-logo]');
            for (var i = 0; i < imgs.length; i++) { imgs[i].style.display = ''; imgs[i].src = u; }
        } catch (e) {}
        applyManifest();
    }

    // Manifest PWA ikut logo pilihan (ikon waktu install / "Tambah ke layar utama").
    // Logo default tetap pakai /manifest.json asli (paling aman buat install).
    var blobUrl = null;
    function applyManifest() {
        try {
            var link = document.querySelector('link[rel="manifest"]'); if (!link) return;
            var P = PRESETS[current];
            if (!P.icons) {
                if (blobUrl) { link.href = '/manifest.json'; try { URL.revokeObjectURL(blobUrl); } catch (e) {} blobUrl = null; }
                return;
            }
            fetch('/manifest.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (m) {
                var o = location.origin;
                m.start_url = o + '/'; m.scope = o + '/';
                if (m.id && !/^https?:/.test(m.id)) m.id = o + '/' + String(m.id).replace(/^\//, '');
                m.icons = P.icons.map(function (ic) { return { src: o + ic.src, sizes: ic.sizes, type: 'image/png', purpose: ic.purpose }; });
                var old = blobUrl;
                blobUrl = URL.createObjectURL(new Blob([JSON.stringify(m)], { type: 'application/manifest+json' }));
                link.href = blobUrl;
                if (old) { try { URL.revokeObjectURL(old); } catch (e) {} }
            }).catch(function () {});
        } catch (e) {}
    }

    function set(name) {
        if (!PRESETS[name]) return;
        current = name; write(current);
        applyToDom(); refreshUi();
        try { if (typeof showToast === 'function') showToast('Logo aplikasi: ' + PRESETS[current].label); } catch (e) {}
    }

    function optClass(on) { return 'pro-opt' + (on ? ' is-on' : ''); }
    function refreshUi() {
        try {
            var opts = document.querySelectorAll('[data-logo-opt]');
            for (var i = 0; i < opts.length; i++) {
                var on = opts[i].getAttribute('data-logo-opt') === current;
                opts[i].className = optClass(on);
                var chk = opts[i].querySelector('.logo-check');
                if (chk) chk.style.visibility = on ? 'visible' : 'hidden';
            }
            var lbl = document.getElementById('logo-current-label');
            if (lbl) lbl.textContent = PRESETS[current].label;
        } catch (e) {}
    }

    function cardHtml() {
        var rows = ORDER.map(function (n) {
            var t = PRESETS[n], on = n === current;
            return '<button type="button" data-logo-opt="' + n + '" onclick="LogoSwitch.set(\'' + n + '\')" class="' + optClass(on) + '">' +
                '<span class="pro-opt-thumb is-round" style="background-image:url(\'' + t.url + '\')"></span>' +
                '<span class="pro-opt-txt"><b>' + t.label + '</b><small>' + t.desc + '</small></span>' +
                '<i data-lucide="check" class="logo-check pro-opt-check" style="visibility:' + (on ? 'visible' : 'hidden') + '"></i>' +
                '</button>';
        }).join('');
        return '<div class="pro-card">' +
            '<div class="pro-card-head"><i data-lucide="app-window"></i><span>Ganti Logo Aplikasi</span><em id="logo-current-label" class="hc-badge">' + PRESETS[current].label + '</em></div>' +
            '<p class="pro-card-note">Logo APK/PWA. Favicon, splash, dan foto profil berubah langsung. Ikon PWA ikut logo ini saat diinstall.</p>' +
            '<div class="pro-opt-list">' + rows + '</div></div>';
    }

    document.addEventListener('DOMContentLoaded', applyToDom);
    window.LogoSwitch = { get: function () { return current; }, url: url, set: set, cardHtml: cardHtml };
})();
