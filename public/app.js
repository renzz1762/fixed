// PWA - INSTALL & OFFLINE MODE HANDLING
var deferredInstallPrompt=null;
var isStandaloneApp=(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)||window.navigator.standalone===true;
var isIOSDevice=/iPad|iPhone|iPod/.test(navigator.userAgent)&&!window.MSStream;

// Auto-fix PWA detection for users who have it installed but browser doesn't report standalone
if (isStandaloneApp) {
    try { localStorage.setItem('pwa_installed', 'true'); } catch(e){}
} else {
    // Bukan standalone sekarang -> jangan percaya flag lama, APK mungkin udah di-uninstall
    try { localStorage.removeItem('pwa_installed'); } catch(e){}
}

function showToast(msg) {
    var existing = document.getElementById('global-app-toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.id = 'global-app-toast';
    toast.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-[600] bg-zinc-900/95 text-white text-xs font-semibold px-4 py-2.5 rounded-full border border-white/15 shadow-2xl backdrop-blur-md flex items-center space-x-2 transition-all duration-300 transform -translate-y-4 opacity-0 pointer-events-none';
    toast.innerHTML = '<span>' + (typeof es === 'function' ? es(msg) : String(msg)) + '</span>';
    document.body.appendChild(toast);
    setTimeout(function(){
        toast.classList.remove('-translate-y-4', 'opacity-0', 'pointer-events-none');
        toast.classList.add('translate-y-0', 'opacity-100');
    }, 10);
    setTimeout(function(){
        if(toast && toast.parentElement) {
            toast.classList.remove('translate-y-0', 'opacity-100');
            toast.classList.add('-translate-y-4', 'opacity-0', 'pointer-events-none');
            setTimeout(function(){ if(toast.parentElement) toast.remove(); }, 300);
        }
    }, 3200);
}

function updateOnlineOfflineStatus() {
    var banner = document.getElementById('pwa-offline-banner');
    if (!navigator.onLine) {
        if (banner) banner.classList.remove('hidden');
        showToast('Mode Offline PWA Aktif — Memutar lagu & lirik tersimpan');
    } else {
        if (banner) banner.classList.add('hidden');
    }
}

function clearPwaCache() {
    if ('caches' in window) {
        caches.keys().then(function(names) {
            names.forEach(function(name) { caches.delete(name); });
        });
    }
    try { localStorage.removeItem('pwa_lyrics_cache'); localStorage.removeItem('pwa_audio_cache'); } catch(e){}
    if (typeof lyricsCache !== 'undefined') lyricsCache = {};
    if (typeof audioUrlCache !== 'undefined') audioUrlCache = {};
    showToast('Cache offline PWA berhasil dibersihkan');
    if (typeof Profile !== 'undefined' && Profile.render) Profile.render();
}

window.addEventListener('online', function() {
    updateOnlineOfflineStatus();
    showToast('Koneksi internet terhubung kembali (Online)');
});
window.addEventListener('offline', function() {
    updateOnlineOfflineStatus();
});
document.addEventListener('DOMContentLoaded', updateOnlineOfflineStatus);

if(window.__hcBIP && !deferredInstallPrompt) deferredInstallPrompt=window.__hcBIP;
window.addEventListener('beforeinstallprompt',function(e){
    e.preventDefault();
    deferredInstallPrompt=e; window.__hcBIP=e;
    var btn=document.getElementById('pwa-install-btn');
    if(btn&&!isStandaloneApp)btn.classList.remove('hidden');
});
window.addEventListener('appinstalled',function(){
    deferredInstallPrompt=null;
    try { localStorage.setItem('pwa_installed', 'true'); } catch(e){}
    isStandaloneApp = true;
    var btn=document.getElementById('pwa-install-btn');
    if(btn)btn.classList.add('hidden');
    showToast('HC MUSIFY berhasil diinstall!');
});

function isPwaInstalled() {
    return isStandaloneApp || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
}

function showPwaRequiredModal() {
    var existing = document.getElementById('pwa-required-modal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'pwa-required-modal';
    modal.className = 'fixed inset-0 z-[700] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in';
    modal.onclick = function(e){ if(e.target === modal) modal.remove(); };
    modal.innerHTML = '<div class="bg-[#121318] border border-white/15 rounded-2xl p-5 max-w-xs w-full text-center space-y-3 shadow-2xl relative" onclick="event.stopPropagation()">'+
        '<div class="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 text-white flex items-center justify-center mx-auto shadow-md">'+
            '<i data-lucide="smartphone" class="w-6 h-6 text-white"></i>'+
        '</div>'+
        '<div class="space-y-1">'+
            '<h3 class="text-white font-bold text-sm">Install Aplikasi Terlebih Dahulu</h3>'+
            '<p class="text-white/60 text-xs leading-relaxed">'+
                'Fitur Mode Offline khusus untuk aplikasi PWA. Silakan install HC MUSIFY ke layar utama terlebih dahulu.'+
            '</p>'+
        '</div>'+
        '<div class="space-y-2 pt-1">'+
            '<button onclick="document.getElementById(\'pwa-required-modal\').remove(); installPWA();" class="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-gray-200 text-black font-bold text-xs shadow-md active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer">'+
                '<i data-lucide="download" class="w-4 h-4"></i>'+
                '<span>Install Aplikasi</span>'+
            '</button>'+
            '<button onclick="document.getElementById(\'pwa-required-modal\').remove();" class="w-full py-2 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 font-semibold text-xs active:scale-95 transition cursor-pointer">'+
                'Tutup'+
            '</button>'+
        '</div>'+
    '</div>';
    document.body.appendChild(modal);
    if (window.lucide) lucide.createIcons();
}

function hcInstallPrompt(){ return deferredInstallPrompt || window.__hcBIP || null; }

function hcInAppBrowser(){
    var ua=navigator.userAgent||'';
    return /FBAN|FBAV|Instagram|TikTok|musical_ly|BytedanceWebview|Line\/|; wv\)|Snapchat|Twitter|GSA\//i.test(ua);
}

function showInstallHelp(){
    var existing=document.getElementById('pwa-help-modal'); if(existing) existing.remove();
    var inApp=hcInAppBrowser();
    var steps=inApp
        ? '<li>Kamu lagi buka lewat browser bawaan aplikasi lain (TikTok/IG/dll), di sini tidak bisa install.</li><li>Tap titik tiga di pojok, pilih <b>Buka di Chrome</b> (atau salin link, buka di Chrome).</li><li>Di Chrome tap tombol Install lagi.</li>'
        : (isIOSDevice
            ? '<li>Buka lewat <b>Safari</b>.</li><li>Tap ikon <b>Bagikan</b>.</li><li>Pilih <b>Add to Home Screen</b>.</li>'
            : '<li>Buka lewat <b>Chrome</b> (bukan browser dalam aplikasi lain).</li><li>Tap titik tiga di kanan atas.</li><li>Pilih <b>Install aplikasi</b> atau <b>Tambahkan ke layar utama</b>.</li><li>Kalau tidak muncul: Chrome &rarr; Setelan &rarr; Setelan situs &rarr; Hapus data situs ini, lalu buka ulang.</li>');
    var m=document.createElement('div');
    m.id='pwa-help-modal';
    m.className='fixed inset-0 z-[700] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm';
    m.onclick=function(e){ if(e.target===m) m.remove(); };
    m.innerHTML='<div class="bg-[#121318] border border-white/15 rounded-2xl p-5 max-w-xs w-full space-y-3 shadow-2xl" onclick="event.stopPropagation()">'+
        '<h3 class="text-white font-bold text-sm text-center">Cara Install HC MUSIFY</h3>'+
        '<ol class="text-white/70 text-xs leading-relaxed list-decimal pl-4 space-y-1.5">'+steps+'</ol>'+
        '<button onclick="document.getElementById(\'pwa-help-modal\').remove()" class="w-full py-2.5 rounded-xl bg-white text-black font-bold text-xs active:scale-95 transition cursor-pointer">Oke</button>'+
    '</div>';
    document.body.appendChild(m);
}

function installPWA(){
    var p=hcInstallPrompt();
    if(p){
        try{
            p.prompt();
            p.userChoice.then(function(choice){
                if(choice.outcome==='accepted') {
                    try { localStorage.setItem('pwa_installed', 'true'); } catch(e){}
                    isStandaloneApp = true;
                    showToast('Menginstall HC MUSIFY...');
                }
                deferredInstallPrompt=null; window.__hcBIP=null;
                var btn=document.getElementById('pwa-install-btn');
                if(btn && choice.outcome==='accepted')btn.classList.add('hidden');
            }).catch(function(){ showInstallHelp(); });
        }catch(e){ deferredInstallPrompt=null; window.__hcBIP=null; showInstallHelp(); }
    }else{
        showInstallHelp();
    }
}

// ===== DONASI =====
// GANTI nomor di bawah ini pake nomor WhatsApp lo (format: kode negara tanpa +, mis. 6281234567890)
var DONATE_WA_NUMBER = '6283148944126';

function dismissDonateBanner(){
    var banner = document.getElementById('donate-banner');
    if (banner) banner.classList.add('hidden');
    try { sessionStorage.setItem('hc_donate_dismissed', 'true'); } catch(e){}
}

function showDonateModal(){
    var existing = document.getElementById('donate-modal');
    if (existing) existing.remove();

    var waText = encodeURIComponent('Halo, saya mau tanya soal donasi HC MUSIFY');
    var modal = document.createElement('div');
    modal.id = 'donate-modal';
    modal.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm z-[500] flex items-center justify-center p-4';
    modal.onclick = function(e){ if(e.target === modal) modal.remove(); };
    modal.innerHTML = '<div class="bg-[#121318] border border-white/15 rounded-2xl p-5 max-w-xs w-full text-center space-y-4 shadow-2xl relative" onclick="event.stopPropagation()">'+
        '<button onclick="document.getElementById(\'donate-modal\').remove()" class="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white active:scale-90 transition-all cursor-pointer" title="Tutup">'+
            '<i data-lucide="x" class="w-4 h-4"></i>'+
        '</button>'+
        '<div>'+
            '<h3 class="text-white font-bold text-base">Dukung HC MUSIFY</h3>'+
            '<p class="text-white/60 text-xs mt-1">Scan QRIS di bawah buat donasi. Makasih banyak! 🙏</p>'+
        '</div>'+
        '<img src="/donate.png" alt="QRIS Donasi" class="w-full rounded-xl border border-white/10 bg-white p-2" onerror="this.style.display=\'none\'; var el=document.getElementById(\'donate-img-error\'); if(el) el.classList.remove(\'hidden\');" />'+
        '<p id="donate-img-error" class="hidden text-rose-400 text-xs">Gambar QRIS belum tersedia (cek file /donate.png di folder public).</p>'+
        '<a href="https://wa.me/'+DONATE_WA_NUMBER+'?text='+waText+'" target="_blank" rel="noopener" class="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shadow-md active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer">'+
            '<i data-lucide="message-circle" class="w-4 h-4"></i>'+
            '<span>Chat Developer via WhatsApp</span>'+
        '</a>'+
    '</div>';
    document.body.appendChild(modal);
    if (window.lucide) lucide.createIcons();
}

// Offline PWA Storage Helper
function getOfflineSongs() {
    try {
        var data = localStorage.getItem('pwa_offline_tracks');
        return data ? JSON.parse(data) : [];
    } catch(e) {
        return [];
    }
}

function isOfflineSong(track) {
    if (!track) return false;
    var vid = track.videoId || track.id;
    var list = getOfflineSongs();
    return list.some(function(s) {
        return (s.videoId === vid || s.id === vid);
    });
}

var offlineDownloading = {};

function persistOfflineSongs(list) {
    try { localStorage.setItem('pwa_offline_tracks', JSON.stringify(list)); } catch(e){}
}

// Ubah 1 lagu di daftar offline (baca ulang dulu biar nggak nimpa perubahan lain)
function updateOfflineSong(vid, patch) {
    var list = getOfflineSongs();
    var changed = false;
    list.forEach(function(s) {
        if (s.videoId === vid || s.id === vid) {
            for (var k in patch) { s[k] = patch[k]; }
            changed = true;
        }
    });
    if (changed) persistOfflineSongs(list);
    return changed;
}

function removeOfflineSong(vid) {
    var list = getOfflineSongs().filter(function(s) { return !(s.videoId === vid || s.id === vid); });
    persistOfflineSongs(list);
}

function rerenderOfflineIfActive() {
    if (typeof OfflineView !== 'undefined' && typeof S !== 'undefined' && S.at === 'offline') OfflineView.render();
}

// Download file audio lagu -> simpan di IndexedDB. Return true kalau berhasil.
async function downloadSongAudio(song, silent) {
    var vid = song.videoId || song.id;
    if (!vid || offlineDownloading[vid]) return false;
    if (!OfflineAudio.supported) return false;
    offlineDownloading[vid] = true;
    try {
        var lastStep = 0;
        var onProg = function(p) {
            var step = Math.floor(p * 4); // 25%, 50%, 75%
            if (!silent && step > lastStep && step < 4) {
                lastStep = step;
                showToast('Mengunduh "' + (song.title || 'lagu') + '" ' + (step * 25) + '%');
            }
        };
        var blob = null;
        var raw = audioUrlCache[vid] || await fetchFreshAudioUrl(song);
        for (var attempt = 0; attempt < 2 && !blob; attempt++) {
            if (!raw) raw = await fetchFreshAudioUrl(song);
            if (!raw) break;
            try {
                blob = await fetchAudioBlob(raw, onProg);
                audioUrlCache[vid] = raw;
            } catch(e) {
                blob = null;
                raw = null; // link lama mungkin kadaluarsa -> ambil link baru di percobaan berikutnya
                delete audioUrlCache[vid];
            }
        }
        if (!blob) return false;

        try {
            await OfflineAudio.put(vid, blob);
        } catch(e) {
            if (!silent) showToast('Penyimpanan HP penuh / tidak bisa menyimpan audio');
            return false;
        }
        updateOfflineSong(vid, { hasAudio: true });
        if (typeof savePwaCaches === 'function') savePwaCaches();
        return true;
    } finally {
        delete offlineDownloading[vid];
    }
}

async function saveTrackForOffline(track) {
    if (!track) return;
    var vid = track.videoId || track.id;
    if (!vid) return;

    var list = getOfflineSongs();
    var existingIndex = list.findIndex(function(s) { return (s.videoId === vid || s.id === vid); });

    if (existingIndex !== -1) {
        if (offlineDownloading[vid]) { showToast('Lagu ini masih diunduh, tunggu sebentar'); return; }
        // Remove from offline (daftar + file audio)
        removeOfflineSong(vid);
        try { await OfflineAudio.del(vid); } catch(e) {}
        showToast('Lagu dihapus dari Mode Offline PWA');
        updateOfflineButtons();
        rerenderOfflineIfActive();
        return false;
    }

    if (offlineDownloading[vid]) { showToast('Lagu ini masih diunduh, tunggu sebentar'); return; }
    if (!navigator.onLine) { showToast('Butuh internet untuk menyimpan lagu ke Mode Offline'); return false; }
    if (!OfflineAudio.supported) { showToast('Browser/aplikasi ini tidak mendukung penyimpanan offline'); return false; }

    // Minta storage "persisten" biar file lagu nggak gampang dihapus otomatis oleh browser
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch(e) {}

    showToast('Menyimpan lagu ke Mode Offline PWA...');

    // 1. Add track metadata to list
    var songObj = {
        id: vid,
        videoId: vid,
        title: track.title || 'Lagu',
        artist: track.artist || 'Unknown Artist',
        cover: track.cover || (typeof toHDCover==='function'?toHDCover('', vid):''),
        artistId: track.artistId || '',
        ytUrl: track.ytUrl || ('https://youtube.com/watch?v=' + vid),
        savedAt: Date.now(),
        hasAudio: false
    };
    list.unshift(songObj);
    persistOfflineSongs(list);
    updateOfflineButtons();
    rerenderOfflineIfActive();

    // 2. Pre-fetch & cache Lyrics
    try {
        var cachedLyric = (typeof lyricsCache !== 'undefined' && lyricsCache[vid]) ? lyricsCache[vid] : null;
        if (!cachedLyric && typeof S !== 'undefined' && S.ld && S.ld.vid === vid && S.ld.lines && S.ld.lines.length > 0) {
            cachedLyric = S.ld;
        }

        if (!cachedLyric) {
            var tParam = (songObj && songObj.title) ? '&title=' + encodeURIComponent(songObj.title) : '';
            var aParam = (songObj && songObj.artist) ? '&artist=' + encodeURIComponent(songObj.artist) : '';
            var lr = await fetch(API.lyrics + '?id=' + vid + tParam + aParam);
            var ld = await lr.json();
            if (ld && ld.status && ld.result && ld.result.lyrics) {
                cachedLyric = {
                    vid: vid,
                    type: ld.result.lyrics.type || 'none',
                    lines: ld.result.lyrics.lines || []
                };
            }
        }

        if (cachedLyric) {
            if (typeof lyricsCache !== 'undefined') {
                lyricsCache[vid] = cachedLyric;
            }
            updateOfflineSong(vid, { lyrics: cachedLyric });
            if (typeof savePwaCaches === 'function') savePwaCaches();
        }
    } catch(e) {}

    // 3. Download FILE AUDIO-nya (ini yang bikin lagu beneran bisa diputar tanpa internet)
    var ok = await downloadSongAudio(songObj, false);
    if (!ok) {
        // Jangan bohong "tersimpan" kalau audionya gagal diunduh
        removeOfflineSong(vid);
        showToast('Gagal mengunduh audio "' + track.title + '", coba lagi');
        updateOfflineButtons();
        rerenderOfflineIfActive();
        return false;
    }

    showToast('Lagu "' + track.title + '" tersimpan untuk Mode Offline!');
    updateOfflineButtons();
    rerenderOfflineIfActive();
    return true;
}

// Lagu yang dulu disimpan (versi lama) cuma punya daftar tanpa file audio.
// Fungsi ini nyocokin status dgn isi IndexedDB, lalu download otomatis yang belum ada (pas online).
var OfflineSync = {
    running: false,
    lastRun: 0,
    async run(force) {
        if (this.running || !navigator.onLine || !OfflineAudio.supported) return;
        if (!force && Date.now() - this.lastRun < 60000) return;
        this.running = true;
        this.lastRun = Date.now();
        try {
            var keys = [];
            try { keys = await OfflineAudio.keys(); } catch(e) { return; }
            var have = {};
            keys.forEach(function(k) { have[k] = true; });

            var list = getOfflineSongs();
            var changed = false;
            list.forEach(function(s) {
                var h = !!have[s.videoId || s.id];
                if (!!s.hasAudio !== h) { s.hasAudio = h; changed = true; }
            });
            if (changed) { persistOfflineSongs(list); rerenderOfflineIfActive(); }

            var todo = list.filter(function(s) { return !s.hasAudio; });
            if (!todo.length) return;

            showToast('Mengunduh ' + todo.length + ' lagu agar bisa diputar offline...');
            var done = 0;
            for (var i = 0; i < todo.length; i++) {
                if (!navigator.onLine) break;
                var ok = await downloadSongAudio(todo[i], true);
                if (ok) { done++; rerenderOfflineIfActive(); }
                await new Promise(function(r) { setTimeout(r, 600); });
            }
            if (done) showToast(done + ' lagu siap diputar tanpa internet');
            else showToast('Belum berhasil mengunduh lagu offline, coba lagi nanti');
        } finally {
            this.running = false;
            rerenderOfflineIfActive();
        }
    }
};
window.addEventListener('load', function() { setTimeout(function() { OfflineSync.run(); }, 4000); });
window.addEventListener('online', function() { setTimeout(function() { OfflineSync.run(true); }, 1500); });

function toggleCurrentOffline() {
    if (typeof S === 'undefined' || !S.ct) {
        showToast('Pilih lagu terlebih dahulu');
        return;
    }
    saveTrackForOffline(S.ct);
}

function updateOfflineButtons() {
    if (typeof S === 'undefined') return;
    var isSaved = S.ct ? isOfflineSong(S.ct) : false;
    
    // Update FullPlayer Offline Button
    var fullBtn = gid('full-offline-btn');
    if (fullBtn) {
        if (isSaved) {
            fullBtn.className = 'w-11 h-11 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center active:scale-90 transition-all shrink-0 cursor-pointer shadow-md';
            fullBtn.title = 'Tersimpan di Mode Offline PWA (Klik untuk menghapus)';
            fullBtn.innerHTML = '<i data-lucide="check-circle-2" class="w-5 h-5"></i>';
        } else {
            fullBtn.className = 'w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-white flex items-center justify-center active:scale-90 transition-all shrink-0 cursor-pointer shadow-md';
            fullBtn.title = 'Simpan ke Mode Offline PWA';
            fullBtn.innerHTML = '<i data-lucide="wifi-off" class="w-5 h-5"></i>';
        }
    }

    if (window.lucide) lucide.createIcons();
}

var OfflineView = {
    render() {
        var el = gid('view-offline');
        if (!el) return;

        var offlineSongs = typeof getOfflineSongs === 'function' ? getOfflineSongs() : [];
        var isOnline = navigator.onLine;

        var songsHtml = '';
        if (offlineSongs.length > 0) {
            songsHtml = offlineSongs.map(function(s, i) {
                var isCur = S.ct && (
                    S.ct.id === s.id ||
                    S.ct.videoId === s.videoId ||
                    (S.ct.title === s.title && S.ct.artist === s.artist)
                );
                var isPlay = isCur && S.ip;
                var isLoad = isCur && S.il;

                var dateStr = s.savedAt ? new Date(s.savedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '';
                var safeSongJson = JSON.stringify(s).replace(/"/g, '&quot;');
                var statusHtml = s.hasAudio
                    ? '<span class="pro-ok">Tersimpan</span>' + (dateStr ? ' <span class="pro-tag">&middot; ' + dateStr + '</span>' : '')
                    : '<span class="pro-warn">' + (offlineDownloading[s.videoId||s.id] ? 'Mengunduh...' : 'Belum terunduh') + '</span>';

                return '<div class="pro-row' + (isCur ? ' is-cur' : '') + '">' +
                    '<button type="button" onclick="PK(\'offline\',' + i + ')" class="pro-main">' +
                        '<span class="pro-idx">' + (i + 1) + '</span>' +
                        '<span class="pro-cover"><img src="' + (s.cover || FI) + '" class="object-cover" onerror="this.src=\'' + FI + '\'" /></span>' +
                        '<span class="pro-meta">' +
                            '<span class="pro-title">' + es(s.title) + '</span>' +
                            '<span class="pro-sub">' + es(s.artist) + ' &middot; ' + statusHtml + '</span>' +
                        '</span>' +
                    '</button>' +
                    '<button type="button" onclick="event.stopPropagation();saveTrackForOffline(' + safeSongJson + ');" class="pro-ibtn is-del" title="Hapus dari Mode Offline PWA" aria-label="Hapus dari Mode Offline">' +
                        '<i data-lucide="trash-2"></i>' +
                    '</button>' +
                    '<button type="button" onclick="PK(\'offline\',' + i + ')" class="pro-play" aria-label="Putar">' + HCUI.playInner(isLoad, isPlay, isCur) + '</button>' +
                '</div>';
            }).join('');
        } else {
            songsHtml = HCUI.empty('wifi-off', 'Belum Ada Lagu Offline', 'Simpan lagu favoritmu untuk diputar tanpa koneksi internet.',
                '<div class="pro-pill"><i data-lucide="download"></i><span>Klik ikon Download di pemutar lagu</span></div>');
        }

        el.innerHTML =
        HCUI.hero(
            '<div class="hc-hero-row">' +
                '<div>' +
                    '<h1 class="text-3xl font-black text-white tracking-tight">Offline Mode</h1>' +
                    '<p class="hc-hero-sub"><span class="hc-hero-badge ' + (isOnline ? 'on' : '') + '"><i></i>' + (isOnline ? 'Online' : 'Offline') + '</span>&nbsp; PWA Storage &amp; Saved Songs</p>' +
                '</div>' +
                '<div class="hc-hero-ico"><i data-lucide="wifi-off"></i></div>' +
            '</div>'
        ) +
        '<div class="pro-page">' +
            (offlineSongs.length > 0
                ? '<div class="pro-bar"><span class="pro-bar-title">' + offlineSongs.length + ' lagu tersimpan</span>' +
                  '<button type="button" onclick="PK(\'offline\',0)" class="pro-link"><svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg> Putar Semua</button></div>'
                : '') +
            '<div class="pro-list">' + songsHtml + '</div>' +
        '</div>';

        if (window.lucide) lucide.createIcons();
        if (navigator.onLine && typeof OfflineSync !== 'undefined') setTimeout(function() { OfflineSync.run(); }, 300);
    }
};

var App={
    init(){
        document.documentElement.classList.remove('theme-light');
        try { localStorage.removeItem('theme'); } catch(e){}

        gid('nav-container').innerHTML=`
        <nav id="hc-nav" class="hcn" style="--hcn-n:6;--hcn-i:0">
            <div class="hcn-bg">
                <div class="hcn-bg-l"></div>
                <svg class="hcn-bg-notch" viewBox="0 0 124 46" aria-hidden="true"><path class="nf" d="M0 0 C15 0 21 3 25 10 C31 21 42 40 62 40 C82 40 93 21 99 10 C103 3 109 0 124 0 L124 46 L0 46 Z"/><path class="ns" d="M0 0 C15 0 21 3 25 10 C31 21 42 40 62 40 C82 40 93 21 99 10 C103 3 109 0 124 0"/></svg>
                <div class="hcn-bg-r"></div>
            </div>
            <div class="hcn-bubble"><i data-lucide="home"></i></div>
            <div class="hcn-row">
                <button onclick="App.switch('home')" id="nav-home" class="hcn-item" aria-label="Home">
                    <span class="hcn-ico"><i data-lucide="home"></i></span>
                    <span class="hcn-label">Home</span>
                </button>
                <button onclick="App.switch('search')" id="nav-search" class="hcn-item" aria-label="Search">
                    <span class="hcn-ico"><i data-lucide="search"></i></span>
                    <span class="hcn-label">Search</span>
                </button>
                <button onclick="App.switch('library')" id="nav-library" class="hcn-item" aria-label="Library">
                    <span class="hcn-ico"><i data-lucide="library"></i></span>
                    <span class="hcn-label">Library</span>
                </button>
                <button onclick="App.switch('offline')" id="nav-offline" class="hcn-item" aria-label="Offline">
                    <span class="hcn-ico"><i data-lucide="wifi-off"></i></span>
                    <span class="hcn-label">Offline</span>
                </button>
                <button onclick="App.switch('liked')" id="nav-liked" class="hcn-item" aria-label="Liked">
                    <span class="hcn-ico"><i data-lucide="heart"></i></span>
                    <span class="hcn-label">Liked</span>
                </button>
                <button onclick="App.switch('dev')" id="nav-dev" class="hcn-item" aria-label="Profil">
                    <span class="hcn-ico"><i data-lucide="user"></i></span>
                    <span class="hcn-label">Profil</span>
                </button>
            </div>
        </nav>`;
        
        Profile.render();
        
        MP.init();FullPlayer.init();Artist.init();Album.init();Home.render();Search.render();
        if(typeof updateOG==='function') updateOG(null);
        App.switch(!navigator.onLine ? 'offline' : 'home');
        lucide.createIcons();
        setTimeout(function(){ App.checkUrl(); }, 1000);
        window.addEventListener('popstate', function(e) {
            if (typeof Album !== 'undefined' && gid('album-modal') && gid('album-modal').style.display !== 'none') {
                gid('album-modal').style.display = 'none';
                gid('album-content').innerHTML = '';
                Album.currentAlbumId = null;
            }
            if (typeof Artist !== 'undefined' && gid('artist-modal') && gid('artist-modal').style.display !== 'none') {
                gid('artist-modal').style.display = 'none';
                gid('artist-content').innerHTML = '';
                Artist.currentArtistId = null;
            }
        });
    },
    checkUrl(){
        var path = window.location.pathname;
        if(path.startsWith('/search/')){
            var q = path.split('/search/')[1];
            if(q){
                setTimeout(function(){
                    var si=gid('search-input');
                    if(si){
                        si.value=decodeURIComponent(q);
                        gid('search-form').dispatchEvent(new Event('submit'));
                    }
                    App.switch('search');
                },300);
            }
        }
        else if(path.startsWith('/play/')){
            var videoId = path.split('/play/')[1];
            if(videoId) {
                var p = new URLSearchParams(location.search);
                var isShared = p.get('share') === 'true' || p.get('share') === '1';
                var qTitle = p.get('title');
                var qArtist = p.get('artist');
                var qCover = p.get('cover') || p.get('thumb');
                if (qCover && typeof updateOG === 'function') {
                    updateOG(qTitle || 'Lagu', qCover, qArtist || '');
                }
                if(isShared) {
                    App.showSharePopup(videoId);
                } else {
                    App.autoPlayTrack(videoId);
                }
            }
        }
        else if(path.startsWith('/album/')){
            var albumId = path.split('/album/')[1];
            if(albumId) {
                var p = new URLSearchParams(location.search);
                var qTitle = p.get('title');
                var qArtist = p.get('artist');
                var qCover = p.get('cover') || p.get('thumb');
                if (qCover && typeof updateOGForAlbum === 'function') {
                    updateOGForAlbum(qTitle || 'Album', qCover, qArtist || '');
                }
                App.switch('home');
                setTimeout(function(){ Album.open(albumId, qCover); }, 300);
            }
        }
        else if(path.startsWith('/playlist/')){
            var playlistId = path.split('/playlist/')[1];
            if(playlistId){
                App.switch('library');
                setTimeout(function(){
                    if(typeof Library !== 'undefined' && typeof Library.open === 'function'){
                        var pls = typeof getUserPlaylists === 'function' ? getUserPlaylists() : [];
                        var exists = pls.some(function(p){ return p.id === playlistId; });
                        if(exists){
                            Library.open(playlistId);
                        } else if(typeof showToast === 'function'){
                            // Playlists are stored locally on-device, so a shared link only
                            // opens correctly on the device that created it.
                            showToast('Playlist ini tidak ditemukan di perangkat ini');
                        }
                    }
                }, 300);
            }
        }
        else if(path.startsWith('/artist/')){
            var artistId = path.split('/artist/')[1];
            if(artistId) {
                var p = new URLSearchParams(location.search);
                var qName = p.get('name') || p.get('title');
                var qCover = p.get('cover') || p.get('thumb');
                if (qCover && typeof updateOGForArtist === 'function') {
                    updateOGForArtist(qName || 'Artist', qCover);
                }
                App.switch('home');
                setTimeout(function(){ Artist.open(artistId, qName, qCover); }, 300);
            }
        }
        else {
            var p=new URLSearchParams(location.search);
            var play=p.get('play'),search=p.get('search'),isShared=p.get('share')==='1';
            if(play){if(isShared){App.showSharePopup(play);}else{App.autoPlayTrack(play);}}
            else if(search){setTimeout(function(){var si=gid('search-input');if(si){si.value=decodeURIComponent(search);gid('search-form').dispatchEvent(new Event('submit'));}App.switch('search');},300);}
        }
    },
    autoPlayTrack(videoId){
        fetch(API.search+'?query=https://youtube.com/watch?v='+videoId).then(function(r){return r.json();}).then(function(d){
            var title='Lagu',artist='HC MUSIFY',cover=toHDCover('', videoId),artistId='';
            if(d.status&&d.result.songs&&d.result.songs.length>0){var song=d.result.songs[0];title=cn(song.title);artist=cn(song.artist);cover=toHDCover(song.thumbnail, videoId);artistId=song.artistId||'';}
            S.ct={id:videoId,videoId:videoId,title:title,artist:artist,cover:cover,artistId:artistId,ytUrl:'https://youtube.com/watch?v='+videoId};
            S.ps='direct';S.pl=[S.ct];S.pi=0;UU();MP.show();resetLyricsUI(videoId);
            FullPlayer.open();loadTrack(S.ct);
        }).catch(function(){
            S.ct={id:videoId,videoId:videoId,title:'Lagu',artist:'HC MUSIFY',cover:toHDCover('', videoId),artistId:'',ytUrl:'https://youtube.com/watch?v='+videoId};
            S.ps='direct';S.pl=[S.ct];S.pi=0;UU();MP.show();resetLyricsUI(videoId);
            FullPlayer.open();loadTrack(S.ct);
        });
    },
    showSharePopup(videoId){
        fetch(API.search+'?query=https://youtube.com/watch?v='+videoId).then(function(r){return r.json();}).then(function(d){
            var title='Lagu',artist='HC MUSIFY',cover=toHDCover('', videoId);
            if(d.status&&d.result.songs&&d.result.songs.length>0){var song=d.result.songs[0];title=cn(song.title);artist=cn(song.artist);cover=toHDCover(song.thumbnail, videoId);}
            App.renderPopup(videoId,title,artist,cover);
        }).catch(function(){App.renderPopup(videoId,'Lagu','HC MUSIFY',toHDCover('', videoId));});
    },
    renderPopup(videoId,title,artist,cover){
        if(typeof updateOG==='function') updateOG(title, cover, artist);
        var popup=document.createElement('div');popup.className='fixed inset-0 z-[300] flex items-end justify-center bg-black/60';
        popup.onclick=function(e){if(e.target===popup)popup.remove();};
        popup.innerHTML='<div class="glass-strong w-full max-w-md rounded-t-3xl p-6 border-t border-white/10" style="animation:slideUp 0.4s ease-out forwards;"><div class="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4"></div><div class="flex items-center gap-4 mb-4"><img src="'+cover+'" class="w-16 h-16 rounded-xl object-cover " onerror="this.src=\''+FI+'\'" /><div class="flex-1 truncate"><h3 class="font-bold text-white truncate">'+title+'</h3><p class="text-[#b3b3b3] text-sm truncate">'+artist+'</p></div></div><p class="text-white/70 text-xs mb-4 text-center">Seseorang membagikan lagu ini kepadamu</p><div class="flex gap-3"><button id="popup-play" class="flex-1 btn-chrome font-bold py-3 rounded-full active:scale-95 flex items-center justify-center gap-2"><i data-lucide="play" class="w-4 h-4 fill-current"></i> Putar Sekarang</button><button id="popup-later" class="px-6 py-3 glass glass-hover text-white rounded-full active:scale-95">Nanti</button></div></div>';
        document.body.appendChild(popup);
        popup.querySelector('#popup-play').onclick=function(){popup.remove();S.ct={id:videoId,videoId:videoId,title:title,artist:artist,cover:cover,artistId:'',ytUrl:'https://youtube.com/watch?v='+videoId};S.ps='direct';S.pl=[S.ct];S.pi=0;UU();MP.show();resetLyricsUI(videoId);FullPlayer.open();loadTrack(S.ct);};
        popup.querySelector('#popup-later').onclick=function(){popup.remove();};
    },
    switch(t){
        // Auto-close opened detail modals/tabs when switching bottom navbar
        if(typeof FullPlayer !== 'undefined' && FullPlayer.close) FullPlayer.close();
        if(typeof Album !== 'undefined' && Album.close) Album.close();
        if(typeof Artist !== 'undefined' && Artist.close) Artist.close();
        if(typeof Library !== 'undefined' && Library.closeModalOnly) Library.closeModalOnly();

        // Remove any open popups or dialogs
        document.querySelectorAll('.fixed.z-\\[300\\], .fixed.z-\\[400\\]').forEach(function(el){
            if(el.id !== 'v2-popup' && el.id !== 'mini-player') el.remove();
        });

        var tabs = ['home', 'search', 'library', 'offline', 'liked', 'dev'];
        var prevTab = S.at || 'home';
        var prevIndex = tabs.indexOf(prevTab);
        var nextIndex = tabs.indexOf(t);

        S.at = t;

        tabs.forEach(function(id){
            var el = gid('view-' + id);
            if(el) {
                el.style.display = 'none';
                el.classList.remove('animate-slide-right', 'animate-slide-left');
            }
        });

        if(t==='library'){Library.render();}
        if(t==='dev'){Profile.render();}
        if(t==='offline'){
            OfflineView.render();
        }
        if(t==='home'){
            if (prevTab === 'home' && Home.activeCategory) {
                Home.selectCategory('Semua');
            } else {
                Home.render();
            }
        }
        if(t==='search'){Search.onShow();}
        if(t==='liked'){Liked.render();}

        var targetEl = gid('view-' + t);
        if(targetEl) {
            targetEl.style.display = 'block';
            if(prevIndex !== -1 && nextIndex !== -1 && prevIndex !== nextIndex) {
                if(nextIndex > prevIndex) {
                    targetEl.classList.add('animate-slide-right');
                } else {
                    targetEl.classList.add('animate-slide-left');
                }
            }
        }

        var _order=['home','search','library','offline','liked','dev'];
        var _nav=gid('hc-nav');
        _order.forEach(function(n){
            var b=gid('nav-'+n);
            if(!b)return;
            b.classList.toggle('active', n===t);
        });
        if(_nav){
            var _i=Math.max(0,_order.indexOf(t));
            _nav.style.setProperty('--hcn-i',_i);
            var _src=gid('nav-'+t), _ic=_src&&_src.querySelector('i,svg');
            var _bub=_nav.querySelector('.hcn-bubble');
            if(_bub && _src){
                var _name=_src.querySelector('.hcn-ico').getAttribute('data-name')||'';
                var _lucide=({home:'home',search:'search',library:'library',offline:'wifi-off',liked:'heart',dev:'user'})[t];
                _bub.classList.remove('pop'); void _bub.offsetWidth; _bub.classList.add('pop');
                _bub.innerHTML='<i data-lucide="'+_lucide+'"></i>';
            }
        }

        gid('main-area').scrollTop=0;lucide.createIcons();
    },
    renderLiked() {
        if (typeof Liked !== 'undefined') Liked.render();
    },
    showV2Popup() {
        // DIHAPUS: overlay "What's New di v2" nggak dipake lagi (atas permintaan).
        // Overlay update/pembaruan asli (dari /update.json, lihat update-notice.js) TETAP jalan seperti biasa.
        return;
        // eslint-disable-next-line no-unreachable
        try { if(localStorage.getItem('seen_v2_popup_update')) return; } catch(e){}
        var popup = document.createElement('div');
        popup.id = 'v2-popup';
        popup.className = 'fixed inset-0 z-[400] flex items-center justify-center bg-black/80 px-4';
        ;
        popup.innerHTML = `
            <div class="glass-strong w-full max-w-sm rounded-3xl p-6 border border-white/10 text-center relative overflow-hidden" style="animation: slideUp 0.3s ease-out forwards;">
                <!-- Header -->
                <div class="relative w-16 h-16 rounded-full mx-auto mb-4 bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center  ">
                    <i data-lucide="sparkles" class="w-8 h-8 text-white"></i>
                </div>
                
                <h2 class="text-2xl font-black chrome-text mb-1">New Version v2</h2>
                <p class="text-white/70 text-xs mb-5">Berikut adalah fitur dan pembaruan terbaru:</p>
                
                <!-- Features list -->
                <div class="space-y-4 text-left mb-6 max-h-[250px] overflow-y-auto pr-1">
                    <div class="flex items-start gap-3">
                        <div class="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
                            <i data-lucide="sliders" class="w-4 h-4 text-rose-400"></i>
                        </div>
                        <div>
                            <h4 class="text-white font-bold text-sm">Equalizer Suara (Web Audio)</h4>
                            <p class="text-[#b3b3b3] text-xs leading-relaxed">Sesuaikan Bass, Mid, Treble, dan gunakan berbagai Preset Keren untuk kualitas audio musik terbaik.</p>
                        </div>
                    </div>
                    
                    <div class="flex items-start gap-3">
                        <div class="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
                            <i data-lucide="share-2" class="w-4 h-4 text-rose-400"></i>
                        </div>
                        <div>
                            <h4 class="text-white font-bold text-sm">Share Lagu via Link Audio Langsung</h4>
                            <p class="text-[#b3b3b3] text-xs leading-relaxed">Bagikan lagu favorit Anda menggunakan link audio langsung untuk kemudahan berbagi musik.</p>
                        </div>
                    </div>

                    <div class="flex items-start gap-3">
                        <div class="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
                            <i data-lucide="timer" class="w-4 h-4 text-rose-400"></i>
                        </div>
                        <div>
                            <h4 class="text-white font-bold text-sm">Timer Sleep (Pengantar Tidur)</h4>
                            <p class="text-[#b3b3b3] text-xs leading-relaxed">Atur waktu putar musik otomatis sebelum tidur dengan durasi yang dapat ditentukan sendiri.</p>
                        </div>
                    </div>

                    <div class="flex items-start gap-3">
                        <div class="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
                            <i data-lucide="shield-check" class="w-4 h-4 text-rose-400"></i>
                        </div>
                        <div>
                            <h4 class="text-white font-bold text-sm">Fitur Pintar: "Hentikan di Akhir Lagu"</h4>
                            <p class="text-[#b3b3b3] text-xs leading-relaxed">Dilengkapi opsi agar lagu aktif Anda tetap berputar sampai selesai sebelum pemutaran otomatis berhenti tanpa memotong lagu di tengah-tengah.</p>
                        </div>
                    </div>

                    <div class="flex items-start gap-3">
                        <div class="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
                            <i data-lucide="gauge" class="w-4 h-4 text-rose-400"></i>
                        </div>
                        <div>
                            <h4 class="text-white font-bold text-sm">Kontrol Kecepatan Putar</h4>
                            <p class="text-[#b3b3b3] text-xs leading-relaxed">Memungkinkan Anda mempercepat atau memperlambat musik sesuai kebutuhan (mendukung kecepatan 0.5x, 0.75x, 1.0x (Normal), 1.25x, 1.5x, 1.75x, hingga 2.0x).</p>
                        </div>
                    </div>

                    <div class="flex items-start gap-3">
                        <div class="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
                            <i data-lucide="zap" class="w-4 h-4 text-rose-400"></i>
                        </div>
                        <div>
                            <h4 class="text-white font-bold text-sm">Mode "Slowed + Reverb" & "Nightcore"</h4>
                            <p class="text-[#b3b3b3] text-xs leading-relaxed">Kustomisasi getaran audio dengan mengubah kecepatan musik secara instan ke gaya favorit Anda.</p>
                        </div>
                    </div>
                </div>
                
                <!-- Button -->
                <button id="close-v2-popup" class="w-full btn-chrome font-bold py-3.5 rounded-full active:scale-95 transition-all">
                    Keren, Mulai Dengar!
                </button>
            </div>
        `;
        document.body.appendChild(popup);
        lucide.createIcons();
        popup.querySelector('#close-v2-popup').onclick = function() {
            try { localStorage.setItem('seen_v2_popup_update', 'true'); } catch(e){}
            popup.remove();
        };
    }
};
App.init();Home.fetch();

// SPLASH SCREEN - LOGO BULAT BESAR & RENDER HOME SYNC
var splashStartTime = Date.now();
var splashDismissed = false;

function hideSplashScreen() {
    if (splashDismissed) return;
    var minDuration = 1000;
    var elapsed = Date.now() - splashStartTime;
    if (elapsed < minDuration) {
        setTimeout(hideSplashScreen, minDuration - elapsed);
        return;
    }
    splashDismissed = true;
    var sp = gid('splash-screen');
    if (!sp) return;
    sp.classList.add('hide');
    setTimeout(function() { 
        if (sp && sp.parentNode) sp.parentNode.removeChild(sp); 
        // Trigger V2 Update popup here
        App.showV2Popup();
    }, 400);
}

(function(){
    var sp = gid('splash-screen');
    if (!sp) return;
    var logoWrap = sp.querySelector('.splash-logo-wrap') || sp.querySelector('.logo-wrap');
    if (logoWrap) {
        logoWrap.style.width = '170px';
        logoWrap.style.height = '170px';
        logoWrap.style.borderRadius = '50%';
    }
    var logo = sp.querySelector('.splash-logo-wrap img') || sp.querySelector('.logo');
    if (logo) {
        logo.style.borderRadius = '50%';
        logo.style.objectFit = 'cover';
    }
    // Safety max fallback timer in case network or API is extremely slow
    setTimeout(function(){
        hideSplashScreen();
    }, 4500);
})();

// Library object moved to /library.js

