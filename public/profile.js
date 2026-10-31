var Profile = {
    render() {
        var el = gid('view-dev');
        if(!el) return;

        var likedCount = 0, artistCount = 0, offlineCount = 0;
        try { likedCount = (typeof getLikedSongs === 'function' ? getLikedSongs() : []).length; } catch(e){}
        try { artistCount = (typeof getLikedArtists === 'function' ? getLikedArtists() : []).length; } catch(e){}
        try { offlineCount = (typeof getOfflineSongs === 'function' ? getOfflineSongs() : []).length; } catch(e){}

        var swOk = 'serviceWorker' in navigator;
        var standalone = typeof isStandaloneApp !== 'undefined' && isStandaloneApp;

        // Data promosi diambil dari promosi.js, dengan fallback kalau file belum ke-load
        var P = (typeof Promosi !== 'undefined') ? Promosi : {
            website: { title:"Kunjungi Website", desc:"Akses HC MUSIFY langsung dari browser tanpa install.", url:location.origin, label:location.host },
            pwa: { title:"Install Aplikasi (PWA)", desc:"Support Mode Offline", url:"#" },
            apk: { title:"Install Aplikasi (APK)", desc:"Tidak Support Mode Offline" },
            social: {
                tiktok: { label:"TikTok", url:"#" },
                discord: { label:"Discord", url:"#" },
                whatsapp: { label:"Channel", url:"#" }
            },
            list: []
        };
        // Gabungin daftar dari website-app.js (utama) + promosi.js (yang belum ada di daftar utama)
        var promoList = [];
        var seenUrls = {};
        if (typeof WEBSITE_APP_LIST !== 'undefined' && WEBSITE_APP_LIST.length) {
            WEBSITE_APP_LIST.forEach(function(w){
                var t = String(w.type || '').toLowerCase();
                var isApp = (t === 'app' || t === 'aplikasi' || t === 'apk');
                seenUrls[String(w.link || '').replace(/\/+$/, '')] = 1;
                promoList.push({
                    icon: isApp ? 'smartphone' : 'globe',
                    color: isApp ? 'text-rose-400' : 'text-sky-400',
                    title: es(w.name || ''),
                    badge: es(w.type || ''),
                    desc: es(w.desc || ''),
                    url: w.link || '',
                    type: w.link ? 'link' : 'nolink'
                });
            });
        }
        (P.list || []).forEach(function(it){
            if (!seenUrls[String(it.url || '').replace(/\/+$/, '')]) promoList.push(it);
        });

        var promoListHtml = promoList.map(function(item, i){
            if (item.type === 'soon') {
                return '<div class="pro-link-item is-soon">'+
                    '<span class="pro-link-ico"><i data-lucide="'+(item.icon||'clock')+'" class="'+(item.color||'text-white/70')+'"></i></span>'+
                    '<span class="pro-link-txt"><b>'+item.title+' <span class="hc-badge">'+(item.badge||'Coming Soon')+'</span></b>'+
                    '<small>'+item.desc+'</small></span>'+
                    '<i data-lucide="clock" class="pro-link-go"></i>'+
                '</div>';
            }
            var isShare = item.type === 'share';
            var attrs = isShare
                ? 'type="button" onclick="Profile.share(\'' + esJs(item.url||'') + '\',\'' + esJs(item.shareText||item.title||'') + '\')"'
                : 'type="button" onclick="Profile.openLink(\'' + esJs(item.url||'') + '\')"';
            return '<button '+attrs+' class="pro-link-item">'+
                '<span class="pro-link-ico"><i data-lucide="'+item.icon+'" class="'+(item.color||'text-white/70')+'"></i></span>'+
                '<span class="pro-link-txt"><b>'+item.title+(item.badge?' <span class="hc-badge">'+item.badge+'</span>':'')+'</b>'+
                '<small>'+item.desc+'</small></span>'+
                '<i data-lucide="'+(isShare?'share-2':'arrow-up-right')+'" class="pro-link-go"></i>'+
            '</button>';
        }).join('');

        el.innerHTML = `
        <div class="relative animate-slide-up">
            <!-- Banner profil 16:9: ikut banner pilihan (sama seperti semua halaman) -->
            <div id="hc-profile-banner-el" class="hc-hero hc-hero-bare hc-profile-banner border-b border-white/10">
                <div class="hc-prof-top">
                    <div class="hc-prof-left">
                        <button type="button" class="hc-pill" onclick="Profile.nextBanner()" title="Ganti Banner">
                            <i data-lucide="image"></i><span id="hc-banner-pill-label">Ganti Banner</span>
                        </button>
                        <button type="button" class="hc-sq" onclick="if(window.ThemeSwitch)ThemeSwitch.toggle()" title="Ganti Tema">
                            <i data-lucide="palette"></i>
                        </button>
                    </div>
                    <button type="button" id="hc-antilag-btn" class="hc-sq ${(typeof AntiLag !== 'undefined' && AntiLag.active()) ? 'is-on' : ''}" onclick="Profile.cycleAntiLag()" title="Anti Lag">
                        <i data-lucide="gauge"></i>
                    </button>
                </div>
            </div>

            <div class="px-4">
                <!-- Avatar overlapping banner, Discord style (no badge here — checkmark is next to name only) -->
                <div class="relative -mt-10 w-[76px] h-[76px]">
                    <div class="hc-avatar w-full h-full rounded-full overflow-hidden flex items-center justify-center shadow-xl relative" style="background:#0b0c10">
                        <img data-hc-logo="1" src="${(typeof LogoSwitch !== 'undefined') ? LogoSwitch.url() : '/logo-preset-1.png'}" class="absolute inset-0 w-full h-full object-cover" onerror="this.style.display='none'" />
                    </div>
                </div>

                <!-- Name row -->
                <div class="mt-2 flex items-center gap-1.5">
                    <h1 class="text-lg font-black text-white leading-none">HC MUSIFY</h1>
                    <span class="w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0" style="background:#1d9bf0;" title="Verified">
                        <i data-lucide="check" class="w-3 h-3 text-white" style="stroke-width:3.5"></i>
                    </span>
                </div>
                <p class="text-white/45 text-xs mt-1">Streaming Musik YouTube dengan Lirik · <span class="text-white/60 font-semibold">v2.1.0</span></p>

                <!-- Compact stats row -->
                <div class="flex items-center gap-3.5 mt-3 mb-3.5">
                    <button onclick="if(typeof App!=='undefined') App.switch('liked')" class="flex items-center gap-1.5 active:scale-95 transition-all">
                        <i data-lucide="heart" class="w-3.5 h-3.5 text-rose-400 fill-current"></i>
                        <span class="text-white font-bold text-xs">${likedCount}</span>
                        <span class="text-white/45 text-[11px]">Lagu</span>
                    </button>
                    <span class="w-1 h-1 rounded-full bg-white/15"></span>
                    <button onclick="if(typeof App!=='undefined') App.switch('library')" class="flex items-center gap-1.5 active:scale-95 transition-all">
                        <i data-lucide="mic-vocal" class="w-3.5 h-3.5 text-purple-400"></i>
                        <span class="text-white font-bold text-xs">${artistCount}</span>
                        <span class="text-white/45 text-[11px]">Artist</span>
                    </button>
                    <span class="w-1 h-1 rounded-full bg-white/15"></span>
                    <button onclick="if(typeof App!=='undefined') App.switch('offline')" class="flex items-center gap-1.5 active:scale-95 transition-all">
                        <i data-lucide="download" class="w-3.5 h-3.5 text-sky-400"></i>
                        <span class="text-white font-bold text-xs">${offlineCount}</span>
                        <span class="text-white/45 text-[11px]">Offline</span>
                    </button>
                </div>

                <!-- Compact social row: TikTok / Discord / WhatsApp Channel -->
                <div class="grid grid-cols-3 gap-2 mb-4">
                    <a href="${P.social.tiktok.url}" target="_blank" rel="noopener" class="glass rounded-xl py-2.5 flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-all">
                        <i data-lucide="music-2" class="w-4 h-4 text-white"></i>
                        <span class="text-[10px] font-bold text-white/80">${P.social.tiktok.label}</span>
                    </a>
                    <a href="${P.social.discord.url}" target="_blank" rel="noopener" class="glass rounded-xl py-2.5 flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-all">
                        <i data-lucide="gamepad-2" class="w-4 h-4" style="color:#5865F2;"></i>
                        <span class="text-[10px] font-bold text-white/80">${P.social.discord.label}</span>
                    </a>
                    <a href="${P.social.whatsapp.url}" target="_blank" rel="noopener" class="hc-channel-btn rounded-xl py-2.5 flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-all">
                        <i data-lucide="message-circle" class="w-4 h-4"></i>
                        <span class="text-[10px] font-bold">${P.social.whatsapp.label}</span>
                    </a>
                </div>

                <!-- App & PWA -->
                <div class="pro-card">
                    <div class="pro-card-head"><i data-lucide="smartphone"></i><span>Aplikasi &amp; PWA</span></div>
                    <div class="pro-kv">
                        <div class="pro-kv-row"><span>Nama</span><b>HC MUSIFY</b></div>
                        <div class="pro-kv-row"><span>Versi</span><b>v2.1.0</b></div>
                        <div class="pro-kv-row"><span>Mode Offline PWA</span><span class="pro-status"><i></i> Aktif</span></div>
                        <div class="pro-kv-row"><span>Service Worker</span><span class="pro-status ${swOk ? '' : 'off'}"><i></i> ${swOk ? 'Terdaftar' : 'Tidak didukung'}</span></div>
                    </div>
                    <div class="pro-clear">
                        <span>Cache PWA tersimpan</span>
                        <button type="button" onclick="if(typeof clearPwaCache==='function') clearPwaCache();"><i data-lucide="trash-2"></i> Bersihkan</button>
                    </div>
                </div>

                <!-- Install: PWA (dari browser) & APK (download) -->
                <div class="pro-actions">
                    ${(typeof HCNotif !== 'undefined' && HCNotif.supported()) ? HCNotif.buttonHtml() : ''}
                    <button type="button" id="pwa-install-btn" onclick="installPWA()" class="${standalone ? 'hidden ' : ''}pro-action">
                        <span class="pro-action-ico"><i data-lucide="download"></i></span>
                        <span class="pro-action-txt"><b>${P.pwa.title}</b><small>${P.pwa.desc}</small></span>
                        <i data-lucide="chevron-right" class="pro-action-go"></i>
                    </button>
                    <button type="button" onclick="Profile.downloadApk()" class="pro-action">
                        <span class="pro-action-ico"><i data-lucide="package"></i></span>
                        <span class="pro-action-txt"><b>${P.apk.title}</b><small>${P.apk.desc}</small></span>
                        <i data-lucide="download" class="pro-action-go"></i>
                    </button>
                    <button type="button" onclick="Profile.shareApk()" class="pro-action">
                        <span class="pro-action-ico"><i data-lucide="link"></i></span>
                        <span class="pro-action-txt"><b>Bagikan Link Aplikasi</b><small>Salin / kirim link download APK</small></span>
                        <i data-lucide="share-2" class="pro-action-go"></i>
                    </button>
                </div>

                <!-- Ganti Tema -->
                ${(typeof ThemeSwitch !== 'undefined') ? ThemeSwitch.cardHtml() : ''}

                <!-- Anti Lag -->
                ${(typeof AntiLag !== 'undefined') ? AntiLag.cardHtml() : ''}

                <!-- Ganti Banner -->
                ${(typeof BannerSwitch !== 'undefined') ? BannerSwitch.cardHtml() : ''}

                <!-- Ganti Logo Aplikasi (APK/PWA) -->
                ${(typeof LogoSwitch !== 'undefined') ? LogoSwitch.cardHtml() : ''}

                <!-- Daftar Promosi Website / APK (dari promosi.js) -->
                <div class="pro-card">
                    <div class="pro-card-head"><i data-lucide="layout-grid"></i><span>Website &amp; App</span></div>
                    ${promoListHtml || '<p class="pro-card-note" style="margin:0">Belum ada website atau app.</p>'}
                </div>

            </div>
        </div>`;
        lucide.createIcons();
    },
    nextBanner() {
        if (typeof BannerSwitch === 'undefined') return;
        BannerSwitch.next();
        var l = document.getElementById('hc-banner-pill-label');
        if (l) l.textContent = BannerSwitch.label();
    },
    cycleAntiLag() {
        if (typeof AntiLag === 'undefined') return;
        var order = ['auto', 'on', 'off'];
        var i = order.indexOf(AntiLag.get());
        AntiLag.set(order[(i + 1) % order.length]);
        var b = document.getElementById('hc-antilag-btn');
        if (b) b.classList.toggle('is-on', !!AntiLag.active());
    },
    // URL APK (absolut) dari promosi.js. Boleh path lokal (/HC-MUSIFY.apk) atau link luar (MediaFire dll).
    apkUrl() {
        var u = '';
        try { u = (typeof Promosi !== 'undefined' && Promosi.apk && Promosi.apk.url) ? String(Promosi.apk.url).trim() : ''; } catch (e) {}
        if (!u) return '';
        try { return new URL(u, location.origin).href; } catch (e) { return u; }
    },
    // Tidak langsung install: file APK DIUNDUH ke daftar unduhan HP (Downloads) dulu,
    // jadi bisa dibuka/diinstall belakangan dan linknya bisa dibagikan.
    downloadApk() {
        var url = Profile.apkUrl();
        if (!url) { if (typeof showToast === 'function') showToast('Link APK belum diisi (lihat promosi.js)'); return; }
        var sameOrigin = false;
        try { sameOrigin = new URL(url).origin === location.origin; } catch (e) {}
        var go = function () {
            try {
                var a = document.createElement('a');
                a.href = url; a.download = 'HC-MUSIFY.apk'; a.rel = 'noopener';
                if (!sameOrigin) a.target = '_blank';
                a.style.display = 'none';
                document.body.appendChild(a); a.click();
                setTimeout(function () { try { a.remove(); } catch (e) {} }, 800);
                if (typeof showToast === 'function') showToast('APK diunduh ke daftar Unduhan HP kamu');
            } catch (e) { try { location.href = url; } catch (e2) {} }
        };
        if (!sameOrigin) { go(); return; }
        // file lokal: cek dulu ada atau nggak biar nggak nyasar ke halaman error
        fetch(url, { method: 'HEAD', cache: 'no-store' }).then(function (r) {
            var ct = (r.headers.get('content-type') || '').toLowerCase();
            if (r.ok && ct.indexOf('text/html') === -1) go();
            else if (typeof showToast === 'function') showToast('File APK belum diupload ke server');
        }).catch(function () { go(); });
    },
    shareApk() {
        var url = Profile.apkUrl();
        if (!url) { if (typeof showToast === 'function') showToast('Link APK belum diisi (lihat promosi.js)'); return; }
        Profile.share(url, 'Download aplikasi HC MUSIFY (APK):');
    },
    // Buka link luar. Aman di PWA & WebView APK (target=_blank sering mati di WebView).
    openLink(url, emptyMsg) {
        url = String(url || '').trim();
        if (!url || url === '#') {
            if (typeof showToast === 'function') showToast(emptyMsg || 'Link belum tersedia');
            return;
        }
        var w = null;
        try { w = window.open(url, '_blank', 'noopener'); } catch (e) {}
        if (!w) { try { location.href = url; } catch (e) {} }
    },
    share(url, text) {
        url = url || location.origin;
        text = text || 'Cobain HC MUSIFY yuk!';
        if (navigator.share) {
            navigator.share({ title: 'HC MUSIFY', text: text, url: url }).catch(function(){});
        } else if (navigator.clipboard) {
            navigator.clipboard.writeText(text + ' ' + url).then(function(){
                if (typeof showToast === 'function') showToast('Link disalin ke clipboard');
            }).catch(function(){});
        }
    }
};

var Dev = Profile;
