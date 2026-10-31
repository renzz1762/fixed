/* ============================================================
   KEEPALIVE — musik tetap jalan saat keluar app / keluar Chrome / layar mati
   1) Web Lock selama musik main: Chrome tidak membekukan (freeze) / membuang tab yang lagi pegang lock,
      jadi proses halaman tidak "mati" sewaktu di background.
   2) Kalau audio tiba-tiba di-pause sistem (bukan user) saat halaman di background -> otomatis play lagi.
   3) Media Session dijaga tetap "playing" biar Android nganggap ini pemutar media aktif (notifikasi + prioritas proses).
   ============================================================ */
(function () {
    function ready() { return typeof AU !== 'undefined' && AU && typeof S !== 'undefined'; }

    // ---- 1. Web Lock ----
    var releaseLock = null;
    function holdLock() {
        if (releaseLock || !navigator.locks || !navigator.locks.request) return;
        try {
            navigator.locks.request('hc-musify-playing', { mode: 'shared' }, function () {
                return new Promise(function (resolve) { releaseLock = resolve; });
            }).catch(function () { releaseLock = null; });
        } catch (e) {}
    }
    function dropLock() {
        if (releaseLock) { try { releaseLock(); } catch (e) {} releaseLock = null; }
    }

    // ---- 2. Auto-resume kalau di-pause bukan oleh user ----
    var tries = 0, resumeTimer = null;
    function tryResume() {
        resumeTimer = null;
        if (!ready() || !wantPlay || !S.ct || AU.ended) return;
        if (!AU.paused) { tries = 0; return; }
        if (S.il || (typeof isRecovering !== 'undefined' && isRecovering)) return;   // lagi ganti lagu / recovery -> jangan ganggu
        if (tries >= 4) { tries = 0; return; }
        tries++;
        try {
            var p = AU.play();
            if (p && p.catch) p.catch(function () {});
        } catch (e) {}
        resumeTimer = setTimeout(tryResume, 700 * tries);
    }
    function onPaused() {
        if (!ready()) return;
        dropLock();
        // wantPlay=false kalau user yang pause (tombol / notifikasi). Kalau masih true = dipaksa sistem.
        if (wantPlay && !AU.ended && !S.il && !resumeTimer) {
            tries = 0;
            resumeTimer = setTimeout(tryResume, 400);
        }
    }

    function bind() {
        if (!ready()) return setTimeout(bind, 400);
        AU.addEventListener('playing', function () { tries = 0; holdLock(); });
        AU.addEventListener('play', holdLock);
        AU.addEventListener('pause', onPaused);
        AU.addEventListener('ended', function () { if (!wantPlay) dropLock(); });

        // ---- 3. Jaga Media Session tetap aktif ----
        setInterval(function () {
            try {
                if (!('mediaSession' in navigator) || !wantPlay || !S.ct) return;
                if (!AU.paused) {
                    if (navigator.mediaSession.playbackState !== 'playing') navigator.mediaSession.playbackState = 'playing';
                } else if (document.hidden) {
                    tryResume();
                }
            } catch (e) {}
        }, 3000);

        // Saat halaman disembunyikan: pastikan lock ada & simpan posisi (player-guard ikut simpan sesi)
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) {
                if (wantPlay && !AU.paused) holdLock();
            } else {
                tries = 0;
                if (wantPlay && AU.paused) tryResume();
            }
        });
        // Halaman dibekukan lalu dihidupkan lagi (Page Lifecycle API)
        document.addEventListener('resume', function () { tries = 0; if (wantPlay && AU.paused) tryResume(); });
    }
    bind();
})();
