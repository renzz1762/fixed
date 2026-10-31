/* ============================================================
   GANTI TEMA — HC MUSIFY
   Tema tersedia:
     glass  = kaca hitam transparan (DEFAULT)  -> /theme-glass.css
     comic  = tampilan comic hitam + merah       -> /theme.css
   Pilihan disimpan di localStorage key "hc_theme".
   Cara kerjanya: dua <link> stylesheet di index.html (id css-glass &
   css-comic), yang nggak aktif di-disable. Jadi nggak ada CSS yang
   perlu ditulis ulang dan nggak ada kedip saat ganti.
   Tambah tema baru: bikin file css + <link id="css-xxx"> + isi THEMES.
   ============================================================ */
(function () {
    var KEY = 'hc_theme';
    var DEFAULT = 'glass';
    var THEMES = {
        glass: { label: 'Glass Hitam', desc: 'Kaca hitam transparan', link: 'css-glass', color: '#050507', icon: 'moon' },
        comic: { label: 'Comic',       desc: 'Hitam + merah, border tebal ala komik', link: 'css-comic', color: '#0d1117', icon: 'zap' }
    };
    var ORDER = ['glass', 'comic'];

    function read() {
        try { var v = localStorage.getItem(KEY); if (v && THEMES[v]) return v; } catch (e) {}
        return DEFAULT;
    }
    function write(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

    function apply(name) {
        if (!THEMES[name]) name = DEFAULT;
        ORDER.forEach(function (n) {
            var el = document.getElementById(THEMES[n].link);
            if (el) el.disabled = (n !== name);
        });
        document.documentElement.setAttribute('data-theme', name);
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', THEMES[name].color);
        return name;
    }

    var current = apply(read());

    function set(name) {
        if (!THEMES[name]) return;
        current = apply(name);
        write(current);
        refreshUi();
        try { if (typeof showToast === 'function') showToast('Tema: ' + THEMES[current].label); } catch (e) {}
    }
    function toggle() {
        var i = ORDER.indexOf(current);
        set(ORDER[(i + 1) % ORDER.length]);
    }

    // Update tampilan kartu "Ganti Tema" di Profile tanpa render ulang seluruh halaman
    function refreshUi() {
        try {
            var opts = document.querySelectorAll('[data-theme-opt]');
            for (var i = 0; i < opts.length; i++) {
                var on = opts[i].getAttribute('data-theme-opt') === current;
                opts[i].className = optClass(on);
                var chk = opts[i].querySelector('.theme-check');
                if (chk) chk.style.visibility = on ? 'visible' : 'hidden';
            }
            var lbl = document.getElementById('theme-current-label');
            if (lbl) lbl.textContent = THEMES[current].label;
        } catch (e) {}
    }
    function optClass(on) { return 'pro-opt' + (on ? ' is-on' : ''); }

    // HTML kartu "Ganti Tema" (dipakai profile.js)
    function cardHtml() {
        var rows = ORDER.map(function (n) {
            var t = THEMES[n], on = n === current;
            return '<button type="button" data-theme-opt="' + n + '" onclick="ThemeSwitch.set(\'' + n + '\')" class="' + optClass(on) + '">' +
                '<span class="pro-opt-ico"><i data-lucide="' + t.icon + '"></i></span>' +
                '<span class="pro-opt-txt"><b>' + t.label + '</b><small>' + t.desc + '</small></span>' +
                '<i data-lucide="check" class="theme-check pro-opt-check" style="visibility:' + (on ? 'visible' : 'hidden') + '"></i>' +
                '</button>';
        }).join('');
        return '<div class="pro-card">' +
            '<div class="pro-card-head"><i data-lucide="palette"></i><span>Ganti Tema</span><em id="theme-current-label" class="hc-badge">' + THEMES[current].label + '</em></div>' +
            '<div class="pro-opt-list">' + rows + '</div>' +
            '<button type="button" onclick="ThemeSwitch.toggle()" class="theme-switch-btn pro-btn pro-btn-block"><i data-lucide="repeat"></i> Ganti Tema</button>' +
            '</div>';
    }

    window.ThemeSwitch = {
        get: function () { return current; },
        set: set,
        toggle: toggle,
        cardHtml: cardHtml,
        themes: THEMES
    };
})();
