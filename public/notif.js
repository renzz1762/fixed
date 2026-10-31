/* ============================================================
   NOTIFIKASI PUSH — pesan dari bot (.notif teks) muncul di HP walau web ditutup
   - Prompt kecil "Aktifkan notifikasi?" (muncul sekali, ulang 3 hari kalau "Nanti")
   - Tombol Aktifkan/Matikan Notifikasi di Profile
   - Langganan disimpan lewat /api/notif-subscribe, kunci VAPID dari /api/notif-key
   Catatan: tidak jalan di WebView APK (WebView tidak mendukung Web Push) —
   jalan di Chrome / PWA terinstall. iPhone: harus Install PWA (Add to Home Screen) dulu.
   ============================================================ */
(function () {
    var SNOOZE_KEY = 'hc_notif_snooze';      // "Nanti" = sembunyi selama sesi ini saja
    var isOn = false;

    function supported() {
        return ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window);
    }
    function u8(b64) {
        var pad = '='.repeat((4 - b64.length % 4) % 4);
        var raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
        var out = new Uint8Array(raw.length);
        for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
        return out;
    }
    function sameKey(sub, keyBytes) {
        try {
            var cur = sub.options && sub.options.applicationServerKey;
            if (!cur) return true;
            var a = new Uint8Array(cur);
            if (a.length !== keyBytes.length) return false;
            for (var i = 0; i < a.length; i++) if (a[i] !== keyBytes[i]) return false;
            return true;
        } catch (e) { return true; }
    }
    function toast(msg) {
        var t = document.createElement('div');
        t.textContent = msg;
        t.style.cssText = 'position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:600;max-width:86%;padding:10px 16px;border-radius:14px;background:rgba(14,15,21,.95);color:#fff;border:1px solid rgba(255,255,255,.18);font:600 12px system-ui,sans-serif;text-align:center;box-shadow:0 8px 28px rgba(0,0,0,.45)';
        document.body.appendChild(t);
        setTimeout(function () { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 320); }, 2600);
    }

    async function getKey() {
        var r = await fetch('/api/notif-key', { cache: 'no-store' });
        var j = await r.json();
        if (!j || !j.publicKey) throw new Error((j && j.message) || 'Server notifikasi belum siap');
        return u8(j.publicKey);
    }

    // Buat/ambil langganan lalu kirim ke server
    async function subscribe() {
        var reg = await navigator.serviceWorker.ready;
        var key = await getKey();
        var sub = await reg.pushManager.getSubscription();
        if (sub && !sameKey(sub, key)) { try { await sub.unsubscribe(); } catch (e) {} sub = null; }
        if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
        var r = await fetch('/api/notif-subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription: sub.toJSON() })
        });
        var j = await r.json().catch(function () { return {}; });
        if (!j.status) throw new Error(j.message || 'Gagal menyimpan langganan');
        isOn = true;
        return sub;
    }

    async function enable() {
        if (!supported()) return { ok: false, reason: 'unsupported' };
        if (Notification.permission === 'denied') return { ok: false, reason: 'denied' };
        var perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
        if (perm !== 'granted') return { ok: false, reason: perm };
        try { await subscribe(); return { ok: true }; }
        catch (e) { return { ok: false, reason: 'error', message: e.message }; }
    }

    async function disable() {
        try {
            var reg = await navigator.serviceWorker.ready;
            var sub = await reg.pushManager.getSubscription();
            if (sub) {
                var endpoint = sub.endpoint;
                await sub.unsubscribe();
                fetch('/api/notif-subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unsubscribe', endpoint: endpoint }) }).catch(function () {});
            }
        } catch (e) {}
        isOn = false;
    }

    function btnLabel() {
        if (Notification.permission === 'denied') return ['Notifikasi Diblokir', 'Ketuk untuk lihat cara mengizinkan'];
        return isOn ? ['Notifikasi Aktif', 'Ketuk untuk mematikan'] : ['Aktifkan Notifikasi', 'Dapat info update langsung di HP'];
    }
    function buttonHtml() {
        var l = btnLabel();
        return '<button type="button" id="hc-notif-btn" onclick="HCNotif.toggle()" class="pro-action">' +
            '<span class="pro-action-ico"><i data-lucide="bell"></i></span>' +
            '<span class="pro-action-txt"><b id="hc-notif-t">' + l[0] + '</b><small id="hc-notif-d">' + l[1] + '</small></span>' +
            '<i data-lucide="chevron-right" class="pro-action-go"></i></button>';
    }
    function refreshButton() {
        var t = document.getElementById('hc-notif-t'), d = document.getElementById('hc-notif-d');
        if (!t || !d) return;
        var l = btnLabel(); t.textContent = l[0]; d.textContent = l[1];
    }

    async function toggle() {
        if (!supported()) { toast('Browser ini belum mendukung notifikasi'); return; }
        if (isOn) { await disable(); refreshButton(); toast('Notifikasi dimatikan'); return; }
        if (Notification.permission === 'denied') { try { sessionStorage.removeItem(SNOOZE_KEY); } catch (e) {} showBlockedCard(); return; }
        var r = await enable();
        refreshButton();
        if (r.ok) toast('Notifikasi aktif ✔');
        else if (r.reason === 'denied') showBlockedCard();
        else if (r.reason === 'error') toast('Gagal: ' + (r.message || 'coba lagi nanti'));
        else toast('Izin notifikasi tidak diberikan');
    }

    // ---- Overlay izin notifikasi (modal tengah layar, muncul terus sampai aktif) ----
    var reTimer = null;
    var NANTI_MS = 60000;   // "Nanti" = muncul lagi 1 menit kemudian (selama belum aktif)
    function snoozed() { return false; }   // tiap buka web selalu ditawarkan lagi
    function snooze() {
        clearTimeout(reTimer);
        reTimer = setTimeout(function () {
            if (!supported() || Notification.permission === 'granted') return;
            if (Notification.permission === 'denied') showBlockedCard(); else showPrompt();
        }, NANTI_MS);
    }
    function removeCards() {
        ['hc-notif-prompt', 'hc-notif-blocked'].forEach(function (id) { var el = document.getElementById(id); if (el) el.remove(); });
    }
    function modal(id, html) {
        removeCards();
        var el = document.createElement('div');
        el.id = id;
        el.style.cssText = 'position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.72);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);';
        el.innerHTML = '<div style="width:100%;max-width:360px;padding:20px;border-radius:22px;background:rgba(14,15,21,.98);color:#fff;border:1px solid rgba(255,255,255,.18);box-shadow:0 16px 48px rgba(0,0,0,.6);font-family:system-ui,sans-serif;text-align:center">' + html + '</div>';
        document.body.appendChild(el);
        return el;
    }
    var BTN_MAIN = 'width:100%;padding:12px;border-radius:14px;border:0;background:#fff;color:#000;font-weight:800;font-size:13px;margin-bottom:8px';
    var BTN_SUB = 'width:100%;padding:10px;border-radius:14px;border:1px solid rgba(255,255,255,.2);background:transparent;color:#fff;font-weight:700;font-size:12px';

    // Cek ulang izin (dipanggil pas balik dari pengaturan browser / tombol "Sudah saya izinkan")
    async function recheck(manual) {
        if (!supported()) return;
        if (Notification.permission === 'granted') {
            removeCards(); clearTimeout(reTimer);
            if (!isOn) {
                try { await subscribe(); refreshButton(); toast('Notifikasi aktif ✔'); }
                catch (e) { toast('Gagal mendaftar notifikasi: ' + ((e && e.message) || 'coba lagi nanti')); }
            }
        } else if (manual) {
            toast('Notifikasi masih diblokir, izinkan dulu lewat setelan situs');
        }
    }

    // Overlay cara mengizinkan (kalau notifikasi terblokir di browser)
    function showBlockedCard() {
        if (document.getElementById('hc-notif-blocked')) return;
        var el = modal('hc-notif-blocked',
            '<div style="font-size:34px;margin-bottom:6px">🔕</div>' +
            '<div style="font-weight:800;font-size:15px;margin-bottom:8px">Notifikasi masih diblokir</div>' +
            '<div style="font-size:12px;opacity:.78;line-height:1.6;margin-bottom:14px;text-align:left">' +
              '1. Ketuk ikon di sebelah kiri alamat web (atas)<br>' +
              '2. Pilih <b>Izin</b> / <b>Setelan situs</b> → <b>Notifikasi</b><br>' +
              '3. Pilih <b>Izinkan</b>, lalu balik ke sini<br>' +
              '<span style="opacity:.7">Kalau udah diizinkan, otomatis aktif.</span></div>' +
            '<button id="hc-nb-ok" type="button" style="' + BTN_MAIN + '">Sudah saya izinkan</button>' +
            '<button id="hc-nb-no" type="button" style="' + BTN_SUB + '">Nanti</button>');
        document.getElementById('hc-nb-ok').onclick = function () { recheck(true); };
        document.getElementById('hc-nb-no').onclick = function () { el.remove(); snooze(); };
    }
    function showPrompt() {
        if (document.getElementById('hc-notif-prompt')) return;
        var el = modal('hc-notif-prompt',
            '<div style="font-size:34px;margin-bottom:6px">🔔</div>' +
            '<div style="font-weight:800;font-size:15px;margin-bottom:6px">Aktifkan notifikasi</div>' +
            '<div style="font-size:12px;opacity:.72;line-height:1.55;margin-bottom:14px">Biar dapat info update & pengumuman HC MUSIFY langsung di HP, walau aplikasi ditutup. Ketuk <b>Izinkan</b> pada pop-up berikutnya.</div>' +
            '<button id="hc-np-yes" type="button" style="' + BTN_MAIN + '">Aktifkan</button>' +
            '<button id="hc-np-no" type="button" style="' + BTN_SUB + '">Nanti</button>');
        document.getElementById('hc-np-no').onclick = function () { el.remove(); snooze(); };
        document.getElementById('hc-np-yes').onclick = async function () {
            el.remove();
            var r = await enable();
            refreshButton();
            if (r.ok) { toast('Notifikasi aktif ✔'); clearTimeout(reTimer); }
            else if (r.reason === 'error') toast('Gagal: ' + (r.message || 'coba lagi nanti'));
            else if (r.reason === 'denied') showBlockedCard();
            else { toast('Izin belum diberikan, ditawarkan lagi sebentar lagi'); snooze(); }
        };
    }
    function waitIdle(cb) {
        var tries = 0;
        (function loop() {
            var splash = document.getElementById('splash-screen');
            var splashGone = !splash || splash.classList.contains('hidden') || getComputedStyle(splash).display === 'none' || getComputedStyle(splash).opacity === '0';
            var busy = document.getElementById('v2-popup') || document.getElementById('hc-update-overlay');
            if ((splashGone && !busy) || tries > 60) return cb();
            tries++; setTimeout(loop, 500);
        })();
    }

    async function init() {
        if (!supported()) return;
        // Balik dari pengaturan browser / buka lagi app -> cek ulang izin, kalau sudah diizinkan langsung aktif
        document.addEventListener('visibilitychange', function () { if (!document.hidden) recheck(false); });
        window.addEventListener('focus', function () { recheck(false); });
        try {
            var reg = await navigator.serviceWorker.ready;
            var sub = await reg.pushManager.getSubscription();
            isOn = !!sub && Notification.permission === 'granted';
        } catch (e) {}
        if (Notification.permission === 'granted') {
            // sudah diizinkan: sinkronkan langganan diam-diam (kalau kunci/endpoint berubah)
            var wasOn = isOn;
            subscribe().then(function () { refreshButton(); if (!wasOn) toast('Notifikasi terdaftar ✔'); })
                .catch(function (e) { toast('Gagal mendaftar notifikasi: ' + ((e && e.message) || 'coba lagi nanti')); });
            return;
        }
        // Pantau perubahan izin: begitu diizinkan lewat pengaturan browser -> langsung aktif
        try {
            navigator.permissions.query({ name: 'notifications' }).then(function (st) {
                st.onchange = function () {
                    if (st.state === 'granted') {
                        removeCards();
                        subscribe().then(function () { refreshButton(); toast('Notifikasi aktif ✔'); }).catch(function (e) { toast('Gagal mendaftar notifikasi: ' + ((e && e.message) || 'coba lagi nanti')); });
                    }
                };
            });
        } catch (e) {}
        // Terus ditawarkan setiap buka web SAMPAI aktif ("Nanti" = sembunyi selama sesi ini saja)
        if (!snoozed()) {
            setTimeout(function () {
                waitIdle(function () {
                    setTimeout(function () {
                        if (Notification.permission === 'granted' || snoozed()) return;
                        if (Notification.permission === 'denied') showBlockedCard(); else showPrompt();
                    }, 2500);
                });
            }, 3000);
        }
    }

    window.HCNotif = { supported: supported, enable: enable, disable: disable, toggle: toggle, buttonHtml: buttonHtml, refresh: refreshButton, isOn: function () { return isOn; } };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
