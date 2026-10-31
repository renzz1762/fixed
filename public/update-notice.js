/* ============================================================
   OVERLAY PEMBERITAHUAN UPDATE (info dari Saluran WhatsApp)
   Cara pakai (tanpa ngoding):
   1. Edit file /update.json -> ganti "version" (angka/teks apa aja, yang penting
      beda dari sebelumnya), "title", "message", dan "items".
   2. Deploy. Semua pengguna bakal lihat overlay ini SEKALI sampai kamu ganti
      "version" lagi. "enabled": false -> overlay dimatikan.
   Tombol di overlay: Buka Saluran (link "channelUrl"), Perbarui Sekarang
   (hapus cache + muat ulang), Nanti.
   ============================================================ */
(function () {
    var SEEN_KEY = 'hc_update_seen';
    var shown = false;

    function esc(t) {
        var d = document.createElement('div');
        d.textContent = t == null ? '' : String(t);
        return d.innerHTML;
    }
    function seenVersion() { try { return localStorage.getItem(SEEN_KEY) || ''; } catch (e) { return ''; } }
    function markSeen(v) { try { localStorage.setItem(SEEN_KEY, String(v)); } catch (e) {} }
    function channelFallback() {
        try { if (window.Promosi && Promosi.social && Promosi.social.whatsapp) return Promosi.social.whatsapp.url; } catch (e) {}
        return '';
    }

    function close(v) {
        markSeen(v);
        var el = document.getElementById('hc-update-overlay');
        if (el) { el.classList.add('hc-upd-out'); setTimeout(function () { el.remove(); }, 180); }
        document.removeEventListener('keydown', onKey);
    }
    var currentVersion = '';
    function onKey(e) { if (e.key === 'Escape') close(currentVersion); }

    function hardRefresh() {
        var done = function () { location.reload(); };
        try {
            var jobs = [];
            if (window.caches && caches.keys) jobs.push(caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); }));
            if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) jobs.push(navigator.serviceWorker.getRegistrations().then(function (rs) { return Promise.all(rs.map(function (r) { return r.unregister(); })); }));
            Promise.all(jobs).then(done, done);
        } catch (e) { done(); }
    }

    function show(info) {
        if (document.getElementById('hc-update-overlay')) return;
        shown = true;
        currentVersion = info.version;
        var url = info.channelUrl || channelFallback();
        var items = (info.items || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
        var wrap = document.createElement('div');
        wrap.id = 'hc-update-overlay';
        wrap.setAttribute('role', 'dialog');
        wrap.setAttribute('aria-modal', 'true');
        wrap.setAttribute('aria-labelledby', 'hc-upd-title');
        wrap.innerHTML =
            '<div class="hc-upd-card">' +
                '<div class="hc-upd-top"><span class="hc-upd-tag">UPDATE</span><span class="hc-upd-ver">v ' + esc(info.version) + '</span></div>' +
                '<h2 id="hc-upd-title" class="hc-upd-title">' + esc(info.title || 'Ada update baru') + '</h2>' +
                (info.message ? '<p class="hc-upd-msg">' + esc(info.message) + '</p>' : '') +
                (items ? '<ul class="hc-upd-list">' + items + '</ul>' : '') +
                '<div class="hc-upd-actions">' +
                    (url ? '<a id="hc-upd-channel" class="hc-upd-btn hc-upd-primary" href="' + esc(url) + '" target="_blank" rel="noopener">Buka Saluran</a>' : '') +
                    '<button id="hc-upd-refresh" class="hc-upd-btn hc-upd-secondary" type="button">Perbarui Sekarang</button>' +
                    '<button id="hc-upd-later" class="hc-upd-btn hc-upd-ghost" type="button">Nanti</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(wrap);
        var ch = document.getElementById('hc-upd-channel');
        if (ch) ch.addEventListener('click', function () { markSeen(info.version); });
        document.getElementById('hc-upd-refresh').addEventListener('click', function () { markSeen(info.version); hardRefresh(); });
        document.getElementById('hc-upd-later').addEventListener('click', function () { close(info.version); });
        wrap.addEventListener('click', function (e) { if (e.target === wrap) close(info.version); });
        document.addEventListener('keydown', onKey);
        try { (ch || document.getElementById('hc-upd-refresh')).focus(); } catch (e) {}
    }

    function check(force) {
        fetch('/update.json?_=' + Date.now(), { cache: 'no-store' })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (info) {
                if (!info || info.enabled === false || !info.version) return;
                if (!force && String(info.version) === seenVersion()) return;
                waitReady(function () { show(info); });
            })
            .catch(function () {});
    }

    // tunggu splash hilang & popup lain (v2-popup) ketutup biar nggak numpuk
    function waitReady(cb) {
        var tries = 0;
        (function loop() {
            var splash = document.getElementById('splash-screen');
            var splashGone = !splash || splash.classList.contains('hidden') || getComputedStyle(splash).display === 'none' || getComputedStyle(splash).opacity === '0';
            var otherPopup = document.getElementById('v2-popup');
            if ((splashGone && !otherPopup) || tries > 40) return cb();
            tries++;
            setTimeout(loop, 500);
        })();
    }

    window.HCUpdate = { check: check, show: show, reset: function () { try { localStorage.removeItem(SEEN_KEY); } catch (e) {} } };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(check, 1200); });
    else setTimeout(check, 1200);
})();
