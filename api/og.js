// Preview link (OG meta) untuk /play/:id, /artist/:id, /album/:id.
// Dipanggil lewat rewrite di vercel.json. Node runtime Vercel.

const FALLBACK_IMAGE = 'https://www.gobox.my.id/file/R0ym4wqfznmp.png';
const FETCH_TIMEOUT_MS = 4000;

function hdCover(url, videoId) {
    if (!url && videoId) return 'https://i.ytimg.com/vi/' + videoId + '/hqdefault.jpg';
    if (!url) return FALLBACK_IMAGE;
    var hd = String(url);
    if (hd.includes('googleusercontent.com') || hd.includes('ggpht.com') || hd.includes('ytimg.com')) {
        if (/=w\d+-h\d+/i.test(hd)) {
            hd = hd.replace(/=w\d+-h\d+[^?#]*/i, '=w800-h800-l90-rj');
        } else if (/=s\d+/i.test(hd)) {
            hd = hd.replace(/=s\d+[^?#]*/i, '=s800-c-k-c0x00ffffff-no-rj');
        } else if (/=w\d+/i.test(hd)) {
            hd = hd.replace(/=w\d+[^?#]*/i, '=w800-h800-l90-rj');
        }
    }
    return hd;
}

function escapeAttr(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function fetchJson(url) {
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, FETCH_TIMEOUT_MS);
    try {
        const res = await fetch(url, { signal: controller.signal, headers: process.env.INTERNAL_KEY ? { 'x-hc-internal': process.env.INTERNAL_KEY, 'user-agent': 'HC-Musify-OG' } : {} });
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

async function getTrackMeta(origin, videoId) {
    const d = await fetchJson(origin + '/api/search?query=' + encodeURIComponent('https://youtube.com/watch?v=' + videoId));
    var title = 'Lagu', artist = 'HC MUSIFY', cover = hdCover(null, videoId);
    if (d && d.status && d.result && d.result.songs && d.result.songs.length > 0) {
        var song = d.result.songs[0];
        title = song.title || title;
        artist = song.artist || artist;
        cover = hdCover(song.thumbnail, videoId);
    }
    return {
        title: title,
        description: 'Dengarkan ' + title + ' - ' + artist + ' di HC MUSIFY',
        image: cover
    };
}

async function getArtistMeta(origin, artistId) {
    const d = await fetchJson(origin + '/api/artist?id=' + encodeURIComponent(artistId));
    var name = 'Artist', image = FALLBACK_IMAGE;
    if (d && d.status && d.result) {
        var a = d.result;
        name = a.name || name;
        if (a.thumbnails && a.thumbnails.length > 0) {
            var last = a.thumbnails[a.thumbnails.length - 1];
            image = (typeof last === 'string' ? last : (last.url || last.src)) || image;
        }
    }
    return {
        title: name + ' (Artist)',
        description: 'Dengarkan lagu & album terbaik dari ' + name + ' di HC MUSIFY',
        image: image
    };
}

async function getAlbumMeta(origin, albumId) {
    const d = await fetchJson(origin + '/api/album?id=' + encodeURIComponent(albumId));
    var title = 'Album', artist = '', image = FALLBACK_IMAGE;
    if (d && d.status && d.result) {
        var a = d.result;
        title = a.title || title;
        if (a.songs && a.songs.length > 0 && a.songs[0].artist) artist = a.songs[0].artist;
        if (a.thumbnails && a.thumbnails.length > 0) {
            var last = a.thumbnails[a.thumbnails.length - 1];
            image = (typeof last === 'string' ? last : (last.url || last.src)) || image;
        } else if (a.songs && a.songs.length > 0 && a.songs[0].thumbnails && a.songs[0].thumbnails.length > 0) {
            var st = a.songs[0].thumbnails[0];
            image = (typeof st === 'string' ? st : (st.url || st.src)) || image;
        }
    }
    var fullTitle = artist ? (title + ' - ' + artist) : title;
    return {
        title: fullTitle + ' (Album)',
        description: 'Dengarkan album ' + fullTitle + ' di HC MUSIFY',
        image: image
    };
}

function replaceMetaContent(html, matchRegex, newContent) {
    return html.replace(matchRegex, function (fullMatch) {
        return fullMatch.replace(/content="[^"]*"/, 'content="' + escapeAttr(newContent) + '"');
    });
}

function injectMeta(html, meta, pageUrl) {
    html = html.replace(/<title>[^<]*<\/title>/, '<title>' + escapeAttr(meta.title) + ' - HC MUSIFY</title>');
    html = replaceMetaContent(html, /<meta property="og:title"[^>]*>/, meta.title + ' | HC MUSIFY');
    html = replaceMetaContent(html, /<meta property="og:description"[^>]*>/, meta.description);
    html = replaceMetaContent(html, /<meta property="og:url"[^>]*>/, pageUrl);
    html = replaceMetaContent(html, /<meta property="og:image"(?!:)[^>]*>/, meta.image);
    html = replaceMetaContent(html, /<meta property="og:image:secure_url"[^>]*>/, meta.image);
    html = replaceMetaContent(html, /<meta name="twitter:title"[^>]*>/, meta.title);
    html = replaceMetaContent(html, /<meta name="twitter:description"[^>]*>/, meta.description);
    html = replaceMetaContent(html, /<meta name="twitter:image"(?!:)[^>]*>/, meta.image);
    html = replaceMetaContent(html, /<meta name="twitter:image:src"[^>]*>/, meta.image);
    return html;
}


module.exports = async (req, res) => {
    const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const origin = proto + '://' + host;
    const type = String((req.query && req.query.type) || '');
    const id = String((req.query && req.query.id) || '');

    let html = '';
    try {
        const r = await fetch(origin + '/index.html');
        html = await r.text();
    } catch (e) {
        res.statusCode = 500;
        return res.end('Gagal memuat halaman');
    }

    try {
        let meta = null;
        if (id) {
            if (type === 'play') meta = await getTrackMeta(origin, id);
            else if (type === 'artist') meta = await getArtistMeta(origin, id);
            else if (type === 'album') meta = await getAlbumMeta(origin, id);
        }
        if (meta) html = injectMeta(html, meta, origin + '/' + type + '/' + encodeURIComponent(id));
    } catch (e) {}

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.statusCode = 200;
    res.end(html);
};
