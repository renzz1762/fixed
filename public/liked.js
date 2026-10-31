var Liked = {
    render() {
        var el = gid('view-liked');
        if(!el) return;
        var liked = typeof getLikedSongs === 'function' ? getLikedSongs() : [];
        var listHtml = '';
        if(liked.length > 0) {
            listHtml = liked.map(function(s, i) {
                var isCur = S.ct && (
                    S.ct.id === s.id ||
                    S.ct.videoId === s.videoId ||
                    (S.ct.title === s.title && S.ct.artist === s.artist)
                );
                var isPlay = isCur && S.ip;
                var isLoad = isCur && S.il;
                var songJson = es(JSON.stringify(s)).replace(/"/g, '&quot;');

                return '<div class="pro-row' + (isCur ? ' is-cur' : '') + '">' +
                    '<button type="button" onclick="PK(\'liked\',' + i + ')" class="pro-main">' +
                        '<span class="pro-cover"><img src="' + s.cover + '" class="object-cover" onerror="this.src=\'' + FI + '\'" /></span>' +
                        '<span class="pro-meta">' +
                            '<span class="pro-title">' + es(s.title) + '</span>' +
                            '<span class="pro-sub">' + es(s.artist) + '</span>' +
                        '</span>' +
                    '</button>' +
                    '<button type="button" onclick="toggleLikeSong(' + songJson + ');Liked.render();" class="pro-ibtn is-like" title="Hapus dari Disukai" aria-label="Hapus dari Disukai">' +
                        '<i data-lucide="heart"></i>' +
                    '</button>' +
                    '<button type="button" onclick="PK(\'liked\',' + i + ')" class="pro-play" aria-label="Putar">' + HCUI.playInner(isLoad, isPlay, isCur) + '</button>' +
                '</div>';
            }).join('');
        } else {
            listHtml = HCUI.empty('heart', 'Belum ada lagu disukai', 'Klik ikon hati pada lagu favoritmu untuk menyimpannya di sini.', '', 'is-like');
        }

        el.innerHTML =
        HCUI.hero(
            '<div class="hc-hero-row">' +
                '<div>' +
                    '<h1 class="text-3xl font-black text-white tracking-tight">Liked Songs</h1>' +
                    '<p class="hc-hero-sub">' + (liked.length > 0 ? liked.length + ' lagu tersimpan' : 'Koleksi lagu favoritmu') + '</p>' +
                '</div>' +
                '<div class="hc-hero-ico" style="color:#ff6b86"><i data-lucide="heart" class="fill-current"></i></div>' +
            '</div>'
        ) +
        '<div class="pro-page">' +
            (liked.length > 0
                ? '<div class="pro-bar"><span class="pro-bar-title">Koleksi</span>' +
                  '<button type="button" onclick="PK(\'liked\',0)" class="pro-link"><svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg> Putar Semua</button></div>'
                : '') +
            '<div class="pro-list">' + listHtml + '</div>' +
        '</div>';
        lucide.createIcons();
    }
};
