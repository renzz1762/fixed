/* ============================================================
   PLAYER GUARD - penanganan crash HC MUSIFY (web + APK WebView)
   1. Simpan sesi pemutar (lagu, antrean, posisi) secara berkala
   2. Kalau app crash / di-reload paksa / dimatikan sistem -> pulihkan lagu terakhir
      (kalau tadi lagi muter dan baru saja mati, lanjut muter otomatis)
   3. Anti crash-loop: kalau app restart berulang dalam waktu singkat, JANGAN auto-play lagi
   4. Jaga memori: bersihkan cache ringan kalau heap JS mendekati batas
   5. Tangkap error JS liar supaya nggak mematikan pemutar
   Dimuat SETELAH app.js.
   ============================================================ */
(function () {
    'use strict';

    var KEY_SESSION = 'hc_session_v1';
    var KEY_STARTS  = 'hc_starts_v1';
    var KEY_ERRORS  = 'hc_errors_v1';
    var MAX_AGE_RESTORE_MS = 6 * 60 * 60 * 1000;  // sesi > 6 jam tidak dipulihkan
    var MAX_AGE_AUTOPLAY_MS = 90 * 1000;          // auto-lanjut cuma kalau matinya baru saja
    var QUEUE_KEEP = 60;

    function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
    function toast(m) { try { if (typeof showToast === 'function') showToast(m); } catch (e) {} }
    function ready() { return typeof S !== 'undefined' && typeof AU !== 'undefined' && AU; }

    // ---------- deteksi crash-loop ----------
    var now = Date.now();
    var starts = (lsGet(KEY_STARTS) || []).filter(function (t) { return now - t < 60000; });
    starts.push(now);
    lsSet(KEY_STARTS, starts);
    var crashLoop = starts.length >= 4;   // 4x start dalam 60 dtk

    // ---------- simpan sesi ----------
    function slimTrack(t) {
        if (!t) return null;
        return {
            id: t.id, videoId: t.videoId, title: t.title, artist: t.artist,
            cover: t.cover, artistId: t.artistId || '', ytUrl: t.ytUrl
        };
    }

    function saveSession() {
        try {
            if (!ready() || !S.ct) return;
            var pl = Array.isArray(S.pl) ? S.pl : [];
            var pi = Math.max(0, S.pi);
            var from = Math.max(0, pi - 5);
            var slice = pl.slice(from, from + QUEUE_KEEP).map(slimTrack).filter(Boolean);
            lsSet(KEY_SESSION, {
                ct: slimTrack(S.ct),
                pl: slice,
                pi: pi - from,
                pos: AU.currentTime || S.pt || 0,
                playing: !!(typeof wantPlay !== 'undefined' && wantPlay && !AU.paused),
                ts: Date.now()
            });
        } catch (e) {}
    }

    setInterval(function () { if (ready() && S.ct && !AU.paused) saveSession(); }, 5000);
    document.addEventListener('visibilitychange', function () { if (document.hidden) saveSession(); });
    window.addEventListener('pagehide', saveSession);
    window.addEventListener('beforeunload', saveSession);

    // ---------- pulihkan sesi ----------
    function restoreSession() {
        try {
            if (!ready()) return;
            var path = location.pathname || '/';
            // Buka lewat link share (/play/.., /artist/..) -> biar App.checkUrl yang urus
            if (/^\/(play|artist|album|playlist|search)\//.test(path)) return;
            if (S.ct) return; // user sudah mulai sesuatu

            var ss = lsGet(KEY_SESSION);
            if (!ss || !ss.ct || !(ss.ct.videoId || ss.ct.id)) return;
            var age = Date.now() - (ss.ts || 0);
            if (age > MAX_AGE_RESTORE_MS) return;

            var list = (ss.pl && ss.pl.length) ? ss.pl : [ss.ct];
            var idx = (ss.pi >= 0 && ss.pi < list.length) ? ss.pi : 0;

            S.pl = list;
            S.pi = idx;
            S.ps = 'restored';   // bukan nama daftar bawaan -> PK() pakai S.pl apa adanya
            S.ct = list[idx] || ss.ct;
            S.pt = ss.pos || 0;
            if (typeof UU === 'function') UU();
            if (typeof MP !== 'undefined' && MP.show) MP.show();
            if (typeof resetLyricsUI === 'function') resetLyricsUI(S.ct.videoId || S.ct.id);
            if (typeof UB === 'function') UB();

            var shouldAutoplay = ss.playing && age < MAX_AGE_AUTOPLAY_MS && !crashLoop;
            if (shouldAutoplay && typeof loadTrack === 'function') {
                if (typeof wantPlay !== 'undefined') wantPlay = true;
                toast('Aplikasi sempat berhenti, melanjutkan musik...');
                loadTrack(S.ct, ss.pos || 0);
            } else if (crashLoop) {
                toast('Aplikasi sempat restart berulang. Tekan play untuk lanjut.');
            }
        } catch (e) {}
    }

    // Tombol play pada sesi yang dipulihkan (belum ada AU.src) sudah ditangani TP() -> loadTrack(S.ct).
    // Supaya lanjut dari posisi terakhir, bungkus TP sekali saja.
    function patchResumePosition() {
        try {
            if (typeof TP !== 'function' || window.__hcTPPatched) return;
            var ss = lsGet(KEY_SESSION);
            var origTP = TP;
            window.__hcTPPatched = true;
            window.TP = TP = function () {
                if (ready() && S.ct && !AU.src && ss && ss.pos > 2 && typeof loadTrack === 'function') {
                    var pos = ss.pos; ss = null;
                    if (typeof wantPlay !== 'undefined') wantPlay = true;
                    loadTrack(S.ct, pos);
                    return;
                }
                return origTP.apply(this, arguments);
            };
        } catch (e) {}
    }

    function boot() { restoreSession(); patchResumePosition(); }
    if (document.readyState === 'complete') setTimeout(boot, 400);
    else window.addEventListener('load', function () { setTimeout(boot, 400); });

    // ---------- error JS liar: catat, jangan bikin pemutar mati ----------
    function logError(msg) {
        try {
            var list = lsGet(KEY_ERRORS) || [];
            list.push({ t: Date.now(), m: String(msg).slice(0, 200) });
            lsSet(KEY_ERRORS, list.slice(-10));
        } catch (e) {}
    }
    window.addEventListener('error', function (ev) {
        if (ev && ev.target && ev.target !== window) return;   // error load gambar/script ditangani tempat lain
        logError((ev && ev.message) || 'error');
    });
    window.addEventListener('unhandledrejection', function (ev) {
        logError((ev && ev.reason && (ev.reason.message || ev.reason)) || 'unhandledrejection');
        try { ev.preventDefault(); } catch (e) {}
    });

    // ---------- jaga memori ----------
    setInterval(function () {
        try {
            var pm = performance && performance.memory;
            if (!pm || !pm.jsHeapSizeLimit) return;
            if (pm.usedJSHeapSize / pm.jsHeapSizeLimit < 0.8) return;
            // heap hampir penuh -> lepas yang aman dilepas
            if (typeof lyricsCache !== 'undefined') lyricsCache = {};
            if (typeof S !== 'undefined' && Array.isArray(S.pl) && S.pl.length > 40) {
                var pi = Math.max(0, S.pi);
                var from = Math.max(0, pi - 5);
                S.pl = S.pl.slice(from, from + 40);
                S.pi = pi - from;
            }
            try { if (typeof OfflineAudio !== 'undefined') { /* blob offline dilepas oleh setAudioSource */ } } catch (e) {}
            saveSession();
        } catch (e) {}
    }, 30000);

    // Dipakai APK (WebView): panggil dari Kotlin lewat evaluateJavascript("window.HCGuard && HCGuard.onNativeResume()")
    // setelah renderer WebView di-restart / app kembali dari background lama.
    window.HCGuard = {
        save: saveSession,
        restore: restoreSession,
        onNativeResume: function () {
            try {
                if (ready() && typeof wantPlay !== 'undefined' && wantPlay && S.ct && (AU.paused || AU.readyState < 3)) {
                    if (typeof recoverPlayback === 'function') recoverPlayback('native-resume');
                }
            } catch (e) {}
        },
        errors: function () { return lsGet(KEY_ERRORS) || []; }
    };
})();
