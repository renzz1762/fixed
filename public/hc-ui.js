/* ============================================================
   HC UI — helper kecil untuk komponen "pro" (lihat pro.css)
   Dipakai Search, Library, Offline, Liked, Profile.
   ============================================================ */
(function () {
    var PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>';
    var PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4" width="4.5" height="16" rx="1"/><rect x="13.5" y="4" width="4.5" height="16" rx="1"/></svg>';
    var EQ = '<span class="pro-eq"><span></span><span></span><span></span></span>';
    var SPIN = '<span class="pro-spin"></span>';

    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

    // isi tombol play sesuai status lagu
    function playInner(isLoad, isPlay, isCur) {
        if (isLoad) return SPIN;
        if (isPlay) return EQ;
        if (isCur) return PAUSE;
        return PLAY;
    }

    // banner 16:9. inner = isi (judul, tombol, dst) yang menempel di bawah banner
    function hero(inner, cls, id) {
        return '<div' + (id ? ' id="' + id + '"' : '') + ' class="hc-hero ' + (cls || '') + '">' + (inner || '') + '</div>';
    }

    function empty(icon, title, desc, extra, icoCls) {
        return '<div class="pro-empty">' +
            '<div class="pro-empty-ico ' + (icoCls || '') + '"><i data-lucide="' + icon + '"></i></div>' +
            '<b>' + title + '</b>' + (desc ? '<p>' + desc + '</p>' : '') + (extra || '') + '</div>';
    }

    window.HCUI = { PLAY: PLAY, PAUSE: PAUSE, EQ: EQ, SPIN: SPIN, esc: esc, playInner: playInner, hero: hero, empty: empty };
})();
