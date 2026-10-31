var Library={
    activeTab: 'playlists',
    setTab(t){
        Library.activeTab = t;
        Library.render();
    },
    render(){
        var pls = typeof getUserPlaylists === 'function' ? getUserPlaylists() : [];
        var likedArtists = typeof getLikedArtists === 'function' ? getLikedArtists() : [];
        var isPlaylistsTab = Library.activeTab === 'playlists';
        var isArtistsTab = Library.activeTab === 'artists';

        var sub = isArtistsTab
            ? (likedArtists.length + ' artist disukai')
            : (pls.length + ' playlist');

        var html = HCUI.hero(
            '<div class="hc-hero-row" style="margin-bottom:12px">' +
                '<div>' +
                    '<h1 class="text-3xl font-black text-white tracking-tight">Library</h1>' +
                    '<p class="hc-hero-sub">' + sub + '</p>' +
                '</div>' +
                '<div class="hc-hero-ico"><i data-lucide="library"></i></div>' +
            '</div>' +
            '<div class="pro-seg">' +
                '<button type="button" onclick="Library.setTab(\'playlists\')" class="pro-seg-btn' + (isPlaylistsTab ? ' is-on' : '') + '">' +
                    '<i data-lucide="list-music"></i><span>Playlists</span>' +
                '</button>' +
                '<button type="button" onclick="Library.setTab(\'artists\')" class="pro-seg-btn' + (isArtistsTab ? ' is-on' : '') + '">' +
                    '<i data-lucide="user"></i><span>Artists</span>' +
                '</button>' +
            '</div>'
        ) + '<div class="pro-page" style="padding-bottom:48px">';

        if (isArtistsTab) {
            // ARTISTS TAB CONTENT
            if(likedArtists.length === 0){
                html += HCUI.empty('user', 'Belum Ada Artist Disukai', 'Sukai artist favoritmu untuk melihatnya di sini.',
                    '<button type="button" onclick="App.switch(\'search\')" class="pro-btn" style="margin-top:16px"><i data-lucide="search"></i> Cari Artist</button>');
            } else {
                html += '<div class="pro-grid">';
                likedArtists.forEach(function(a){
                    html += '<div onclick="Artist.open(\'' + es(a.artistId) + '\', \'' + esJs(a.name) + '\')" class="pro-tile is-center">' +
                        '<div class="pro-tile-img is-round"><img src="' + a.thumbnail + '" class="object-cover" onerror="this.src=\'' + FI + '\'" /></div>' +
                        '<span class="pro-tile-name" style="max-width:100%">' + es(a.name) + '</span>' +
                        '<span class="pro-tile-sub">Artist</span>' +
                    '</div>';
                });
                html += '</div>';
            }
        } else if (isPlaylistsTab) {
            // PLAYLISTS TAB CONTENT
            html += '<button type="button" onclick="Library.createNew()" class="pro-create"><i data-lucide="plus"></i> Buat Playlist Baru</button>';

            if(pls.length === 0){
                html += HCUI.empty('list-music', 'Belum Ada Playlist', 'Buat playlist pertamamu dan kumpulkan lagu-lagu favoritmu di satu tempat.');
            } else {
                html += '<div class="pro-grid">';
                pls.forEach(function(p){
                    html += '<div onclick="Library.open(\'' + p.id + '\')" class="pro-tile">' +
                        '<div class="pro-tile-img">' +
                            '<img src="' + (p.image || (p.songs.length > 0 ? p.songs[0].cover : FI)) + '" class="object-cover" onerror="this.src=\'' + FI + '\'" />' +
                            '<button type="button" onclick="event.stopPropagation();Library.showActions(\'' + p.id + '\')" class="pro-tile-fab more" title="Opsi Playlist" aria-label="Opsi Playlist"><i data-lucide="more-vertical"></i></button>' +
                            (p.songs.length > 0 ? '<button type="button" onclick="event.stopPropagation();Library.playSong(\'' + p.id + '\',0)" class="pro-tile-fab play" title="Putar" aria-label="Putar"><i data-lucide="play"></i></button>' : '') +
                        '</div>' +
                        '<span class="pro-tile-name">' + es(p.name) + '</span>' +
                        '<span class="pro-tile-sub">' + p.songs.length + ' lagu</span>' +
                    '</div>';
                });
                html += '</div>';
            }
        }

        html += '</div>';
        gid('view-library').innerHTML = html;
        lucide.createIcons();
    },
    playAllLiked(){
        var songs = typeof getLikedSongs === 'function' ? getLikedSongs() : [];
        if(!songs.length) return;
        S.pl = songs;
        S.pi = 0;
        S.ps = 'playlist';
        S.ct = S.pl[S.pi];
        UU(); MP.show(); S.il = true; UB();
        resetLyricsUI(S.ct.videoId);
        loadTrack(S.ct);
    },
    playLikedIndex(index){
        var songs = typeof getLikedSongs === 'function' ? getLikedSongs() : [];
        if(!songs[index]) return;
        var s = songs[index];
        if (S.ct && (S.ct.id === s.id || S.ct.videoId === s.videoId || (S.ct.title === s.title && S.ct.artist === s.artist)) && AU.src) {
            TP();
            return;
        }
        S.pl = songs;
        S.pi = index;
        S.ps = 'playlist';
        S.ct = S.pl[S.pi];
        UU(); MP.show(); S.il = true; UB();
        resetLyricsUI(S.ct.videoId);
        loadTrack(S.ct);
    },
    createNew(){
        var popup=document.createElement('div');popup.className='fixed inset-0 z-[300] flex items-end justify-center bg-black/60';
        popup.innerHTML='<div class="glass-strong w-full max-w-md rounded-t-3xl p-6 border-t border-white/10" style="animation:slideUp 0.3s ease-out forwards;"><div class="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4"></div><h3 class="font-bold text-white mb-4">Buat Playlist Baru</h3><input id="pl-name" class="w-full glass-input text-white rounded-xl px-4 py-3 mb-3 focus:outline-none" placeholder="Nama Playlist" /><input id="pl-image" type="file" accept="image/*" class="w-full text-sm text-white/70 mb-4" /><div class="flex gap-3"><button id="pl-create" class="flex-1 btn-chrome font-bold py-3 rounded-full">Buat</button><button onclick="this.closest(\'.fixed\').remove()" class="px-6 py-3 glass glass-hover text-white rounded-full">Batal</button></div></div>';
        document.body.appendChild(popup);
        popup.querySelector('#pl-create').onclick=function(){
            var name=gid('pl-name').value.trim()||'Playlist Baru';
            var file=gid('pl-image').files[0];
            if(file){var reader=new FileReader();reader.onload=function(e){createPlaylist(name,e.target.result);popup.remove();Library.render();};reader.readAsDataURL(file);}
            else{createPlaylist(name,'');popup.remove();Library.render();}
        };
    },
    showActions(id){
        var pls=getUserPlaylists();var pl=pls.find(function(p){return p.id===id;});if(!pl)return;
        var popup=document.createElement('div');popup.className='fixed inset-0 z-[300] flex items-end justify-center bg-black/60';
        popup.onclick=function(e){if(e.target===popup)popup.remove();};
        popup.innerHTML='<div class="w-full max-w-md rounded-t-3xl p-6 border-t border-white/10 glass-strong" style="animation:slideUp 0.3s ease-out forwards; background: var(--bg-color);">'+
            '<div class="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4"></div>'+
            '<div class="flex items-center gap-3 mb-5"><img src="'+(pl.image||(pl.songs.length>0?pl.songs[0].cover:FI))+'" class="w-12 h-12 rounded-lg object-cover" onerror="this.src=\''+FI+'\'" /><div class="truncate"><h3 class="font-bold text-white truncate">'+es(pl.name)+'</h3><p class="text-white/70 text-xs">'+pl.songs.length+' lagu</p></div></div>'+
            '<button onclick="this.closest(\'.fixed\').remove();Library.editPlaylist(\''+id+'\')" class="w-full text-left p-4 rounded-xl hover:bg-white/5 flex items-center gap-3 mb-1"><i data-lucide="pencil" class="w-5 h-5 text-white"></i><span class="font-medium text-white">Edit Playlist</span></button>'+
            '<button onclick="this.closest(\'.fixed\').remove();Library.confirmDelete(\''+id+'\')" class="w-full text-left p-4 rounded-xl hover:bg-red-500/10 flex items-center gap-3"><i data-lucide="trash-2" class="w-5 h-5 text-red-400"></i><span class="font-medium text-red-400">Hapus Playlist</span></button>'+
        '</div>';
        document.body.appendChild(popup);lucide.createIcons();
    },
    editPlaylist(id){
        var pls=getUserPlaylists();var pl=pls.find(function(p){return p.id===id;});if(!pl)return;
        var popup=document.createElement('div');popup.className='fixed inset-0 z-[300] flex items-end justify-center bg-black/60';
        popup.innerHTML='<div class="glass-strong w-full max-w-md rounded-t-3xl p-6 border-t border-white/10" style="animation:slideUp 0.3s ease-out forwards;"><div class="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4"></div><h3 class="font-bold text-white mb-4">Edit Playlist</h3><input id="pl-edit-name" class="w-full glass-input text-white rounded-xl px-4 py-3 mb-3 focus:outline-none" placeholder="Nama Playlist" value="'+es(pl.name).replace(/"/g,'&quot;')+'" /><input id="pl-edit-image" type="file" accept="image/*" class="w-full text-sm text-white/70 mb-4" /><div class="flex gap-3"><button id="pl-edit-save" class="flex-1 btn-chrome font-bold py-3 rounded-full">Simpan</button><button onclick="this.closest(\'.fixed\').remove()" class="px-6 py-3 glass glass-hover text-white rounded-full">Batal</button></div></div>';
        document.body.appendChild(popup);
        popup.querySelector('#pl-edit-save').onclick=function(){
            var name=gid('pl-edit-name').value.trim()||pl.name;
            var file=gid('pl-edit-image').files[0];
            if(file){var reader=new FileReader();reader.onload=function(e){updateUserPlaylist(id,name,e.target.result);popup.remove();Library.render();showToast('Playlist diperbarui');};reader.readAsDataURL(file);}
            else{updateUserPlaylist(id,name,null);popup.remove();Library.render();showToast('Playlist diperbarui');}
        };
    },
    confirmDelete(id){
        var pls=getUserPlaylists();var pl=pls.find(function(p){return p.id===id;});if(!pl)return;
        var popup=document.createElement('div');popup.className='fixed inset-0 z-[300] flex items-end justify-center bg-black/60';
        popup.innerHTML='<div class="glass-strong w-full max-w-md rounded-t-3xl p-6 border-t border-white/10" style="animation:slideUp 0.3s ease-out forwards;"><div class="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4"></div><h3 class="font-bold text-white mb-2">Hapus "'+es(pl.name)+'"?</h3><p class="text-white/70 text-sm mb-5">Playlist ini akan dihapus permanen dan tidak bisa dikembalikan.</p><div class="flex gap-3"><button onclick="deleteUserPlaylist(\''+id+'\');this.closest(\'.fixed\').remove();Library.render();Library.close();showToast(\'Playlist dihapus\')" class="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-full active:scale-95">Hapus</button><button onclick="this.closest(\'.fixed\').remove()" class="px-6 py-3 glass glass-hover text-white rounded-full">Batal</button></div></div>';
        document.body.appendChild(popup);
    },
    share(id){
        var pls = getUserPlaylists();
        var pl = pls.find(function(p){return p.id===id;});
        if(!pl) return;
        var url = location.origin + '/playlist/' + id;
        var text = 'Dengarkan playlist "' + pl.name + '" (' + pl.songs.length + ' lagu) di HC MUSIFY!';
        if (navigator.share) {
            navigator.share({ title: pl.name + ' - HC MUSIFY', text: text, url: url }).catch(function(){});
        } else {
            navigator.clipboard.writeText(url).then(function(){
                showToast('Link playlist berhasil disalin!');
            }).catch(function(){
                showToast('Gagal menyalin link playlist');
            });
        }
    },
    handleScroll(){
        const c = gid('library-content');
        const h = gid('library-header');
        if (!h) return;
        if (c && c.scrollTop > 50) {
            h.style.background = 'rgba(5, 5, 7, 0.9)';
        } else {
            h.style.background = 'transparent';
        }
    },
    currentPlaylistId: null,
    open(id){
        var pls=getUserPlaylists();var pl=pls.find(function(p){return p.id===id;});if(!pl)return;
        Library.currentPlaylistId = id;
        var url = location.origin + '/playlist/' + id;
        history.pushState({}, '', url);
        
        var modal = gid('library-modal');
        if(!modal) {
            modal = document.createElement('div');
            modal.id = 'library-modal';
            modal.className = 'fixed inset-0 bg-[#050507] flex flex-col z-[100]';
            modal.style.animation = 'slideUp 0.3s ease-out forwards';
            document.body.appendChild(modal);
        }
        modal.style.display = 'flex';
        
        var html=`
            <div class="flex items-center gap-3 p-4 pt-safe bg-transparent absolute top-0 left-0 w-full z-[100] transition-all" id="library-header">
                <button onclick="Library.close()" class="glass glass-hover rounded-full text-white p-3 active:scale-90 shadow-md bg-black/80"><i data-lucide="arrow-left" class="w-6 h-6"></i></button>
                <div class="flex-1"></div>
                <div class="flex items-center gap-1 bg-black/80 rounded-full shadow-md">
                    <button onclick="Library.share('${id}')" class="text-white hover:text-white p-2.5 active:scale-90" title="Bagikan Playlist"><i data-lucide="share-2" class="w-5 h-5"></i></button>
                    <button onclick="Library.editPlaylist('${id}')" class="text-white hover:text-white p-2.5 active:scale-90" title="Edit Playlist"><i data-lucide="pencil" class="w-5 h-5"></i></button>
                    <button onclick="Library.confirmDelete('${id}')" class="text-red-400 hover:text-red-300 p-2.5 active:scale-90" title="Hapus Playlist"><i data-lucide="trash-2" class="w-5 h-5"></i></button>
                </div>
            </div>
            <div class="flex-1 overflow-y-auto hide-scrollbar pb-36 relative" id="library-content" onscroll="Library.handleScroll()">
                <div class="relative w-full aspect-square md:aspect-video max-h-[50vh] overflow-hidden -mt-20 mb-6">
                    <img src="${pl.image||(pl.songs.length>0?pl.songs[0].cover:FI)}" class="w-full h-full object-cover" onerror="this.src='${FI}'" />
                    <div class="absolute inset-0 bg-gradient-to-t from-[#050507] via-[#050507]/60 to-transparent"></div>
                    <div class="absolute bottom-6 left-6 right-6 flex flex-col justify-end items-center text-center z-10">
                        <img src="${pl.image||(pl.songs.length>0?pl.songs[0].cover:FI)}" class="w-32 h-32 md:w-48 md:h-48 rounded-xl object-cover border border-white/10 mb-4" onerror="this.src='${FI}'" />
                        <div>
                            <p class="text-[10px] font-bold text-white uppercase tracking-[0.2em] mb-1">PLAYLIST LOKAL</p>
                            <h1 class="text-3xl md:text-5xl font-black text-white mb-2 leading-tight line-clamp-2">${es(pl.name)}</h1>
                            <p class="text-white text-xs md:text-sm line-clamp-2">${pl.songs.length} lagu</p>
                        </div>
                    </div>
                </div>
                <div class="px-6 mb-6 flex items-center gap-4">
                    ${pl.songs.length>0?`<button onclick="Library.playSong('${id}',0)" class="bg-white hover:bg-gray-200 text-black w-14 h-14 rounded-full flex items-center justify-center active:scale-95 transition-all shadow-white/20"><i data-lucide="play" class="w-7 h-7 fill-current ml-1"></i></button><button onclick="Library.shufflePlaylist('${id}')" class="text-white/70 hover:text-white p-3 rounded-full active:scale-95 bg-white/5 transition-all" title="Acak Urutan (Shuffle)"><i data-lucide="shuffle" class="w-6 h-6"></i></button>`:''}
                </div>
        `;
        if(pl.songs.length===0){
            html+='<div class="text-center text-white/70 mt-10"><p>Belum ada lagu</p></div>';
        } else {
            html+='<div id="playlist-songs-list" class="space-y-1 px-4">';
            pl.songs.forEach(function(s,i){
                var isCur = S.ct && (
                    S.ct.id === s.id ||
                    S.ct.videoId === s.videoId ||
                    (S.ct.title === s.title && S.ct.artist === s.artist)
                );
                var isPlay = isCur && S.ip;
                var isLoad = isCur && S.il;

                var iconOverlay = '';
                if (isLoad) {
                    iconOverlay = '<div class="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>';
                } else if (isPlay) {
                    iconOverlay = '<div class="flex items-end justify-center gap-[2px] w-4 h-4 pb-0.5"><span class="w-[2px] bg-rose-400 rounded-full animate-eq-1"></span><span class="w-[2px] bg-rose-400 rounded-full animate-eq-2"></span><span class="w-[2px] bg-rose-400 rounded-full animate-eq-3"></span></div>';
                } else if (isCur) {
                    iconOverlay = '<i data-lucide="pause" class="w-4 h-4 text-rose-400 fill-current"></i>';
                } else {
                    iconOverlay = '<i data-lucide="play" class="w-4 h-4 text-white fill-white"></i>';
                }

                var rowBg = isPlay ? 'bg-gradient-to-r from-rose-500/20 via-rose-500/10 to-transparent border border-rose-500/30 shadow-md' : (isCur ? 'bg-white/10 border border-white/20' : 'hover:bg-white/5 border border-transparent');
                var titleClass = isCur ? 'text-rose-400 font-bold' : 'text-white font-medium';

                html+='<div class="flex items-center gap-2 p-2 rounded-lg active:scale-[0.98] ' + rowBg + '"><div onclick="Library.playSong(\''+id+'\','+i+')" class="flex items-center gap-3 flex-1 cursor-pointer overflow-hidden"><div class="relative w-10 h-10 rounded overflow-hidden shrink-0"><img src="'+s.cover+'" class="w-full h-full object-cover" onerror="this.src=\'' + FI + '\'" /><div class="absolute inset-0 bg-black/80 ' + (isCur ? 'opacity-100' : 'opacity-0 group-hover:opacity-100') + ' transition-all flex items-center justify-center">' + iconOverlay + '</div></div><div class="truncate flex-1 min-w-0"><p class="text-sm truncate ' + titleClass + '">'+es(s.title)+'</p><p class="text-white/70 text-xs truncate">'+es(s.artist)+'</p></div></div><button onclick="Library.removeSong(\''+id+'\','+i+')" class="text-white/70 hover:text-red-400 p-2 active:scale-90 shrink-0" title="Hapus"><i data-lucide="x" class="w-5 h-5"></i></button></div>';
            });
            html+='</div>';
        }
        html+='</div>';
        modal.innerHTML=html;
        lucide.createIcons();
    },
    closeModalOnly() {
        var modal = gid('library-modal');
        if(modal) modal.style.display = 'none';
        Library.currentPlaylistId = null;
    },
    close() {
        if(window.location.pathname.startsWith('/playlist/')) history.pushState({},'', '/');
        this.closeModalOnly();
        if (S.at === 'library') Library.render();
    },
    renderActive() {
        if (S.at === 'library' && S.libTab === 'liked') {
            Library.render();
            return;
        }
        var modal = gid('library-modal');
        if (!modal || modal.style.display === 'none' || !Library.currentPlaylistId) return;
        var pls = getUserPlaylists();
        var pl = pls.find(function(p){ return p.id === Library.currentPlaylistId; });
        var container = gid('playlist-songs-list');
        if (!container || !pl || !pl.songs) return;

        var children = container.children;
        for (var i = 0; i < pl.songs.length; i++) {
            var s = pl.songs[i];
            var el = children[i];
            if (!el) continue;

            var isCur = S.ct && (
                S.ct.id === s.id ||
                S.ct.videoId === s.videoId ||
                (S.ct.title === s.title && S.ct.artist === s.artist)
            );
            var isPlay = isCur && S.ip;
            var isLoad = isCur && S.il;

            var iconOverlay = '';
            if (isLoad) {
                iconOverlay = '<div class="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>';
            } else if (isPlay) {
                iconOverlay = '<div class="flex items-end justify-center gap-[2px] w-4 h-4 pb-0.5"><span class="w-[2px] bg-rose-400 rounded-full animate-eq-1"></span><span class="w-[2px] bg-rose-400 rounded-full animate-eq-2"></span><span class="w-[2px] bg-rose-400 rounded-full animate-eq-3"></span></div>';
            } else if (isCur) {
                iconOverlay = '<i data-lucide="pause" class="w-4 h-4 text-rose-400 fill-current"></i>';
            } else {
                iconOverlay = '<i data-lucide="play" class="w-4 h-4 text-white fill-white"></i>';
            }

            var coverOverlay = el.querySelector('.relative.w-10 .absolute');
            if (coverOverlay) {
                coverOverlay.innerHTML = iconOverlay;
                coverOverlay.className = 'absolute inset-0 bg-black/80 ' + (isCur ? 'opacity-100' : 'opacity-0 group-hover:opacity-100') + ' transition-all flex items-center justify-center';
            }

            var rowBg = isPlay ? 'bg-gradient-to-r from-rose-500/20 via-rose-500/10 to-transparent border border-rose-500/30 shadow-md' : (isCur ? 'bg-white/10 border border-white/20' : 'hover:bg-white/5 border border-transparent');
            el.className = 'flex items-center gap-2 p-2 rounded-lg active:scale-[0.98] ' + rowBg;

            var titleEl = el.querySelector('p');
            if (titleEl) {
                titleEl.className = 'text-sm truncate ' + (isCur ? 'text-rose-400 font-bold' : 'text-white font-medium');
            }
        }
        lucide.createIcons();
    },
    removeSong(plId,index){var pls=getUserPlaylists();var pl=pls.find(function(p){return p.id===plId;});if(!pl)return;pl.songs.splice(index,1);saveUserPlaylists(pls);Library.open(plId);showToast('Lagu dihapus');},
    shufflePlaylist(plId){
        var pls = getUserPlaylists();
        var pl = pls.find(p => p.id === plId);
        if(!pl || pl.songs.length === 0) return;
        var arr = pl.songs;
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        saveUserPlaylists(pls);
        Library.open(plId);
        showToast('Urutan playlist diacak');
    },
    playSong(plId,index){
        var pls=getUserPlaylists();var pl=pls.find(function(p){return p.id===plId;});if(!pl||!pl.songs[index])return;
        var s = pl.songs[index];
        if (S.ct && (S.ct.id === s.id || S.ct.videoId === s.videoId || (S.ct.title === s.title && S.ct.artist === s.artist)) && AU.src) {
            TP();
            return;
        }
        S.pl=pl.songs;S.pi=index;S.ps='playlist';S.ct=S.pl[S.pi];UU();MP.show();S.il=true;UB();resetLyricsUI(S.ct.videoId);loadTrack(S.ct);
    }
};
