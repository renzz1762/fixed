/* ============================================================
   INFO LAG — HC MUSIFY
   Muncul otomatis kalau FPS kedetect rendah (event 'hc:lag-detected' dari
   antilag.js). Isinya CUMA pemberitahuan/info — tidak menyuruh ganti tema
   dan tidak mengubah pengaturan apa pun.
   Sengaja DIANTRE paling belakang: nunggu sampai nggak ada overlay lain
   yang kebuka, jadi nggak pernah ketiban/ketimpa overlay lain.
   ============================================================ */
(function () {
    var SEEN_KEY = 'hc_lag_tip_seen';
    var shown = false, waiting = false;

    function alreadySeenThisSession() {
        try { return sessionStorage.getItem(SEEN_KEY) === '1'; } catch (e) { return false; }
    }
    function markSeenThisSession() {
        try { sessionStorage.setItem(SEEN_KEY, '1'); } catch (e) {}
    }
    function otherOverlayOpen() {
        return !!(document.getElementById('hc-update-overlay') ||
            document.getElementById('v2-popup') ||
            document.querySelector('[role="dialog"]') ||
            document.querySelector('.modal-overlay.open'));
    }

    function render() {
        if (document.getElementById('hc-lag-tip')) return;
        var wrap = document.createElement('div');
        wrap.id = 'hc-lag-tip';
        wrap.style.cssText = 'position:fixed;left:12px;right:12px;bottom:84px;z-index:99999;display:flex;justify-content:center;pointer-events:none;';
        wrap.innerHTML =
            '<div style="pointer-events:auto;max-width:420px;width:100%;background:#15181f;border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px 14px 12px;box-shadow:0 12px 32px rgba(0,0,0,.5);color:#fff;font-family:inherit;animation:hcLagIn .25s ease-out;">' +
                '<div style="display:flex;gap:10px;align-items:flex-start;">' +
                    '<span style="font-size:20px;line-height:1">🐢</span>' +
                    '<div style="flex:1;min-width:0;">' +
                        '<p style="font-size:13px;font-weight:700;margin:0 0 3px;">Kerasa lag / patah-patah?</p>' +
                        '<p style="font-size:12px;color:rgba(255,255,255,.6);margin:0;line-height:1.5;">HP lagi kerja berat. Coba tutup aplikasi lain yang lagi jalan biar pemutar lebih lancar.</p>' +
                    '</div>' +
                    '<button id="hc-lag-tip-x" aria-label="Tutup" style="background:none;border:none;color:rgba(255,255,255,.4);font-size:16px;line-height:1;padding:2px;cursor:pointer;">✕</button>' +
                '</div>' +
                '<div style="display:flex;gap:8px;margin-top:10px;">' +
                    '<button id="hc-lag-tip-later" style="flex:1;background:#fff;color:#111;border:none;border-radius:10px;padding:9px;font-size:12.5px;font-weight:800;cursor:pointer;">Oke, ngerti</button>' +
                '</div>' +
            '</div>';
        if (!document.getElementById('hc-lag-tip-style')) {
            var st = document.createElement('style');
            st.id = 'hc-lag-tip-style';
            st.textContent = '@keyframes hcLagIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}';
            document.head.appendChild(st);
        }
        document.body.appendChild(wrap);
        shown = true; markSeenThisSession();
        function dismiss() { wrap.remove(); }
        document.getElementById('hc-lag-tip-x').addEventListener('click', dismiss);
        document.getElementById('hc-lag-tip-later').addEventListener('click', dismiss);
    }

    function tryShowQueued() {
        if (shown || waiting) return;
        if (alreadySeenThisSession()) return;
        waiting = true;
        var tries = 0;
        var iv = setInterval(function () {
            tries++;
            if (!otherOverlayOpen()) {
                clearInterval(iv); waiting = false; render();
            } else if (tries > 60) { // ~30s timeout, biar nggak nunggu selamanya
                clearInterval(iv); waiting = false;
            }
        }, 500);
    }

    window.addEventListener('hc:lag-detected', tryShowQueued);
})();
