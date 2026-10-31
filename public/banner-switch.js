/* ============================================================
   GANTI BANNER (SEMUA HALAMAN) — HC MUSIFY
   Pilihan foto PRESET (bukan upload dari galeri). Banner yang dipilih
   dipakai di SEMUA halaman navigasi (Home, Search, Library, Offline,
   Liked, Profile) lewat satu CSS variable --hc-banner di <html>,
   jadi begitu ganti, semua halaman langsung ikut tanpa reload.
   Banner kompak 2:1 (lihat .hc-hero di pro.css).
   Tambah pilihan baru: taruh gambar di /public (sisakan ruang langit ±20% di atas kepala), terus tambah satu
   baris di PRESETS di bawah.
   ============================================================ */
(function () {
    var KEY = 'hc_banner_choice';
    var DEFAULT = 'default';
    var PRESETS = {
        default: { label: 'Senja di Pantai', desc: 'Banner default', url: '/banner.png', pos: 'center 35%', icon: 'image' },
        preset1: { label: 'Preset 1', desc: 'Potret di tepi jendela', url: '/banner-preset-1.png', pos: 'center 30%', icon: 'image' }
    };
    var ORDER = ['default', 'preset1'];

    function read() { try { var v = localStorage.getItem(KEY); if (v && PRESETS[v]) return v; } catch (e) {} return DEFAULT; }
    function write(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
    var current = read();

    function url() { return PRESETS[current].url; }

    // satu variable di <html> -> semua .hc-hero (semua halaman) ikut berubah
    function applyToDom() {
        try { var st = document.documentElement.style; st.setProperty('--hc-banner', "url('" + url() + "')"); st.setProperty('--hc-banner-pos', PRESETS[current].pos || 'center top'); } catch (e) {}
    }
    applyToDom();

    function set(name) {
        if (!PRESETS[name]) return;
        current = name; write(current);
        applyToDom(); refreshUi();
        try { if (typeof showToast === 'function') showToast('Banner semua halaman: ' + PRESETS[current].label); } catch (e) {}
    }

    function refreshUi() {
        try {
            var opts = document.querySelectorAll('[data-banner-opt]');
            for (var i = 0; i < opts.length; i++) {
                var on = opts[i].getAttribute('data-banner-opt') === current;
                opts[i].className = optClass(on);
                var chk = opts[i].querySelector('.banner-check');
                if (chk) chk.style.visibility = on ? 'visible' : 'hidden';
            }
            var lbl = document.getElementById('banner-current-label');
            if (lbl) lbl.textContent = PRESETS[current].label;
        } catch (e) {}
    }
    function optClass(on) { return 'pro-opt' + (on ? ' is-on' : ''); }

    function cardHtml() {
        var rows = ORDER.map(function (n) {
            var t = PRESETS[n], on = n === current;
            return '<button type="button" data-banner-opt="' + n + '" onclick="BannerSwitch.set(\'' + n + '\')" class="' + optClass(on) + '">' +
                '<span class="pro-opt-thumb" style="background-image:url(\'' + t.url + '\')"></span>' +
                '<span class="pro-opt-txt"><b>' + t.label + '</b><small>' + t.desc + '</small></span>' +
                '<i data-lucide="check" class="banner-check pro-opt-check" style="visibility:' + (on ? 'visible' : 'hidden') + '"></i>' +
                '</button>';
        }).join('');
        return '<div class="pro-card">' +
            '<div class="pro-card-head"><i data-lucide="image"></i><span>Ganti Banner</span><em id="banner-current-label" class="hc-badge">' + PRESETS[current].label + '</em></div>' +
            '<p class="pro-card-note">Pilihan foto dari aplikasi. Banner yang dipilih berlaku untuk semua halaman.</p>' +
            '<div class="pro-opt-list">' + rows + '</div></div>';
    }

    function next() { var i = ORDER.indexOf(current); set(ORDER[(i + 1) % ORDER.length]); }
    function label() { return PRESETS[current].label; }

    window.BannerSwitch = { get: function () { return current; }, url: url, set: set, next: next, label: label, cardHtml: cardHtml };
})();
