/* ============================================================
   ANTI LAG — HC MUSIFY
   Mode: auto (default) | on | off   (disimpan di localStorage "hc_antilag")
   - auto: aktif otomatis di HP RAM kecil / CPU sedikit / hemat data /
     reduced-motion, atau kalau FPS terukur rendah setelah app kebuka.
   - Saat aktif: blur kaca, shadow blur, animasi masuk & efek berat dimatikan,
     daftar panjang pakai content-visibility, animasi dijeda saat tab/app di background.
   - Semua gambar otomatis lazy-load + decode async (aktif di semua mode).
   ============================================================ */
(function () {
    var KEY = 'hc_antilag', root = document.documentElement;
    var LABELS = { auto: ['Otomatis', 'Deteksi HP & FPS, hidup sendiri kalau perlu', 'wand-2'],
                   on:   ['Aktif', 'Efek berat dimatikan, paling ringan', 'zap'],
                   off:  ['Mati', 'Tampilan penuh dengan semua efek', 'sparkles'] };
    var ORDER = ['auto', 'on', 'off'];
    function read() { try { var v = localStorage.getItem(KEY); if (LABELS[v]) return v; } catch (e) {} return 'auto'; }
    function write(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
    var mode = read(), slowFps = false;

    function weakDevice() {
        var n = navigator, c = n.connection || {};
        try {
            if (n.deviceMemory && n.deviceMemory <= 4) return true;
            if (n.hardwareConcurrency && n.hardwareConcurrency <= 4) return true;
            if (c.saveData || /(^|-)2g|3g/.test(c.effectiveType || '')) return true;
            if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
        } catch (e) {}
        return false;
    }
    function isOn() { return mode === 'on' || (mode === 'auto' && (slowFps || weakDevice())); }
    function apply() {
        var on = isOn();
        root.classList.toggle('perf-lite', on);
        root.setAttribute('data-antilag', on ? 'on' : 'off');
        window.HC_LITE = on;
    }

    // ---- CSS ----
    var st = document.createElement('style');
    st.id = 'antilag-css';
    st.textContent =
    'html.perf-lite *,html.perf-lite *::before,html.perf-lite *::after{-webkit-backdrop-filter:none!important;backdrop-filter:none!important;text-shadow:none!important}' +
    'html.perf-lite{scroll-behavior:auto!important}' +
    'html.perf-lite .hcn-bg{filter:none!important}' +
    'html.perf-lite .glass-dock,html.perf-lite #mini-player-inner,html.perf-lite .shadow-sm,html.perf-lite .shadow,html.perf-lite .shadow-md,html.perf-lite .shadow-lg,html.perf-lite .shadow-xl,html.perf-lite .shadow-2xl{box-shadow:none!important}' +
    'html.perf-lite .player-bg-blur-img{filter:blur(20px) brightness(.62) contrast(1.1)!important;-webkit-filter:blur(20px) brightness(.62) contrast(1.1)!important}' +
    'html.perf-lite #lyrics-overlay .player-bg-blur-img{filter:blur(36px) brightness(.18)!important;-webkit-filter:blur(36px) brightness(.18)!important}' +
    'html.perf-lite .player-bg-glow{display:none!important}' +
    'html.perf-lite .animate-slide-right,html.perf-lite .animate-slide-left,html.perf-lite .animate-card-up,html.perf-lite .animate-card-left,html.perf-lite .animate-slide-up{animation:none!important;opacity:1!important;transform:none!important}' +
    'html.perf-lite .transition-all,html.perf-lite .transition,html.perf-lite .transition-colors,html.perf-lite .transition-opacity,html.perf-lite .transition-transform{transition-duration:.12s!important}' +
    'html.perf-lite .hcn-bg-l,html.perf-lite .hcn-bg-r,html.perf-lite .hcn-bg-notch,html.perf-lite .hcn-bubble{transition-duration:.25s!important}' +
    'html.perf-lite #main-area [class*="space-y"]>*{content-visibility:auto;contain-intrinsic-size:auto 68px}' +
    'html.perf-lite img{image-rendering:auto}' +
    'html.hc-hidden *,html.hc-hidden *::before,html.hc-hidden *::after{animation-play-state:paused!important}';
    (document.head || root).appendChild(st);

    apply();

    // ---- jeda animasi saat di background ----
    document.addEventListener('visibilitychange', function () {
        root.classList.toggle('hc-hidden', document.hidden);
    });

    // ---- gambar: lazy + async decode (semua mode) ----
    function tune(img) {
        if (img.nodeType !== 1 || img.tagName !== 'IMG') return;
        if (!img.hasAttribute('loading') && !img.closest('#full-player,#splash-screen,#mini-player')) img.loading = 'lazy';
        if (!img.hasAttribute('decoding')) img.decoding = 'async';
    }
    function tuneTree(node) {
        if (node.nodeType !== 1) return;
        if (node.tagName === 'IMG') { tune(node); return; }
        var imgs = node.getElementsByTagName ? node.getElementsByTagName('img') : [];
        for (var i = 0; i < imgs.length; i++) tune(imgs[i]);
    }
    function startObserver() {
        try {
            tuneTree(document.body);
            new MutationObserver(function (list) {
                for (var i = 0; i < list.length; i++) {
                    var a = list[i].addedNodes;
                    for (var j = 0; j < a.length; j++) tuneTree(a[j]);
                }
            }).observe(document.body, { childList: true, subtree: true });
        } catch (e) {}
    }
    if (document.body) startObserver(); else document.addEventListener('DOMContentLoaded', startObserver);

    // ---- ukur FPS (mode auto saja): kalau < 40 fps -> aktifkan lite ----
    function probe() {
        if (mode !== 'auto' || slowFps || document.hidden) return;
        var frames = 0, t0 = 0, dead = false;
        function tick(t) {
            if (dead) return;
            if (!t0) t0 = t;
            frames++;
            if (t - t0 < 2500) { requestAnimationFrame(tick); return; }
            var fps = frames * 1000 / (t - t0);
            if (fps < 40 && !document.hidden) {
                slowFps = true; apply(); refreshUi();
                try { window.dispatchEvent(new CustomEvent('hc:lag-detected', { detail: { fps: fps } })); } catch (e) {}
            }
        }
        document.addEventListener('visibilitychange', function once() { dead = true; document.removeEventListener('visibilitychange', once); });
        requestAnimationFrame(tick);
    }
    window.addEventListener('load', function () { setTimeout(probe, 3500); });

    // ---- UI kartu di Profil ----
    function optClass(on) { return 'pro-opt' + (on ? ' is-on' : ''); }
    function statusText() { return isOn() ? 'AKTIF' : 'MATI'; }
    function refreshUi() {
        try {
            var opts = document.querySelectorAll('[data-antilag-opt]');
            for (var i = 0; i < opts.length; i++) {
                var on = opts[i].getAttribute('data-antilag-opt') === mode;
                opts[i].className = optClass(on);
                var chk = opts[i].querySelector('.al-check');
                if (chk) chk.style.visibility = on ? 'visible' : 'hidden';
            }
            var lbl = document.getElementById('antilag-status');
            if (lbl) lbl.textContent = statusText();
        } catch (e) {}
    }
    function set(m) {
        if (!LABELS[m]) return;
        mode = m; write(m); if (m !== 'auto') slowFps = false;
        apply(); refreshUi();
        if (m === 'auto') probe();
        try { if (typeof showToast === 'function') showToast('Anti Lag: ' + LABELS[m][0]); } catch (e) {}
    }
    function cardHtml() {
        var rows = ORDER.map(function (k) {
            var L = LABELS[k], on = k === mode;
            return '<button type="button" data-antilag-opt="' + k + '" onclick="AntiLag.set(\'' + k + '\')" class="' + optClass(on) + '">' +
                '<span class="pro-opt-ico"><i data-lucide="' + L[2] + '"></i></span>' +
                '<span class="pro-opt-txt"><b>' + L[0] + '</b><small>' + L[1] + '</small></span>' +
                '<i data-lucide="check" class="al-check pro-opt-check" style="visibility:' + (on ? 'visible' : 'hidden') + '"></i></button>';
        }).join('');
        return '<div class="pro-card">' +
            '<div class="pro-card-head"><i data-lucide="gauge"></i><span>Anti Lag</span><em id="antilag-status" class="hc-badge">' + statusText() + '</em></div>' +
            '<div class="pro-opt-list">' + rows + '</div>' +
            '<p class="pro-card-note" style="margin:10px 0 0">Buat HP kentang: matiin blur, bayangan &amp; animasi berat biar scroll dan buka app lebih lancar.</p></div>';
    }
    window.AntiLag = { set: set, get: function () { return mode; }, active: isOn, cardHtml: cardHtml };
})();
