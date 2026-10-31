const G = require('./_guard.js');
const https = require('https');
const http = require('http');
const { translateLines } = require('./translate.js');

const API_KEY = process.env.YT_WEB_KEY || 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8'; // key publik web YouTube (bukan rahasia)

function getRunsText(runs) { return Array.isArray(runs) ? runs.map(r => r.text || '').join('') : ''; }

function parseSyncedLyrics(s) {
    if (!s) return [];
    const lines = [], p = /\[(\d{2,}):(\d{2})(?:\.(\d{2,3}))?\]\s*(.*)/;
    for (const l of s.split('\n')) { 
        const m = l.trim().match(p); 
        if (m) {
            let ms = 0;
            if (m[3]) ms = m[3].length === 3 ? parseInt(m[3])/1000 : parseInt(m[3])/100;
            lines.push({ time: Math.round((parseInt(m[1])*60+parseInt(m[2])+ms)*100)/100, text: m[4].trim() || '• • •' }); 
        } 
    }
    return lines;
}

function parsePlainLyrics(p) {
    if (!p) return [];
    return p.split('\n').map(t => t.trim()).filter(t => t).map(t => ({ time: -1, text: t }));
}

function makeRequest(options, payload) {
    return new Promise((resolve, reject) => {
        const client = options.hostname && options.hostname.includes('http:') ? http : https;
        const req = client.request(options, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => {
                try { resolve(JSON.parse(d)); } catch(e) { resolve(d); }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        if (payload) req.write(JSON.stringify(payload));
        req.end();
    });
}

function cleanT(t) {
    if (!t) return '';
    return t
        .replace(/(\(.*?(official|lyric|video|audio|mv|visualizer).*?\)|\[.*?(official|lyric|video|audio|mv|visualizer).*?\]|-.*?(official|lyric|video|audio|mv|visualizer).*?|Official\s*Music\s*Video|Official\s*Video|Official\s*Audio|Lyric\s*Video|Full\s*Audio)/gi, '')
        .replace(/f(ea)?t\..*/gi, '')
        .replace(/[-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function cleanA(a) {
    if (!a) return '';
    return a.replace(/- Topic/gi, '').replace(/\s+/g, ' ').trim();
}

async function getLyrics1(videoId, queryTitle = '', queryArtist = '') {
    let title = (queryTitle || '').trim();
    let artist = (queryArtist || '').trim();
    let album = '';

    // 1. Try YouTube oEmbed if title/artist not supplied
    if (!title || !artist) {
        try {
            const oembed = await makeRequest({
                hostname: 'www.youtube.com',
                path: '/oembed?url=https://www.youtube.com/watch?v=' + encodeURIComponent(videoId) + '&format=json',
                method: 'GET',
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 3000
            }, null);
            if (oembed && oembed.title) {
                if (!title) title = oembed.title;
                if (!artist) artist = oembed.author_name || '';
            }
        } catch(e) {}
    }

    // 2. Try YT Music Watch Next API if still empty
    if (!title || !artist) {
        try {
            const ytData = await makeRequest({
                hostname: 'music.youtube.com',
                path: '/youtubei/v1/next?key=' + API_KEY,
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 Chrome/120.0.0.0', 'Origin': 'https://music.youtube.com' },
                rejectUnauthorized: false,
                timeout: 4000
            }, { context: { client: { clientName: 'WEB_REMIX', clientVersion: '1.20240101.00.00', hl: 'en', gl: 'ID' } }, videoId });

            try {
                const c = ytData?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.musicQueueRenderer?.content?.playlistPanelRenderer?.contents?.[0]?.playlistPanelVideoRenderer || {};
                if (!title) title = getRunsText(c.title?.runs || []);
                if (!artist) artist = getRunsText(c.shortBylineText?.runs || c.longBylineText?.runs || []);
                if (!album) album = getRunsText(c.longBylineText?.runs || []);
            } catch(e) {}
        } catch(e) {}
    }

    let lyricsData = { type: 'none', lines: [] };

    let cTitle = cleanT(title);
    let cArtist = cleanA(artist);

    // If title has format "Artist - Song Name", split it
    if (cTitle.includes(' - ')) {
        const parts = cTitle.split(' - ');
        if (parts.length >= 2) {
            const pArtist = parts[0].trim();
            const pSong = parts.slice(1).join(' - ').trim();
            if (!cArtist || cArtist.toLowerCase() === 'unknown' || cTitle.toLowerCase().includes(cArtist.toLowerCase())) {
                cArtist = pArtist;
            }
            cTitle = pSong;
        }
    }

    // Try search queries on LRCLIB
    const searchQueries = [];
    if (cTitle && cArtist) searchQueries.push(cTitle + ' ' + cArtist);
    if (cTitle) searchQueries.push(cTitle);
    if (title && title !== cTitle) searchQueries.push(cleanT(title));

    for (const sqRaw of searchQueries) {
        if (!sqRaw || lyricsData.lines.length > 0) break;
        try {
            const sq = encodeURIComponent(sqRaw);
            const lrc = await makeRequest({
                hostname: 'lrclib.net',
                path: '/api/search?q=' + sq,
                method: 'GET',
                headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120.0.0.0' },
                rejectUnauthorized: false,
                timeout: 5000
            }, null);

            if (Array.isArray(lrc) && lrc.length > 0) {
                let b = lrc.find(x => x.syncedLyrics) || lrc.find(x => x.plainLyrics) || lrc[0];
                if (b.syncedLyrics) {
                    lyricsData = { type: 'synced', lines: parseSyncedLyrics(b.syncedLyrics) };
                } else if (b.plainLyrics) {
                    lyricsData = { type: 'plain', lines: parsePlainLyrics(b.plainLyrics) };
                }
            }
        } catch (e) {}
    }

    // Translate lines with 3.5s timeout safety race
    if (lyricsData.lines && lyricsData.lines.length > 0) {
        try {
            const transPromise = translateLines(lyricsData.lines);
            const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(lyricsData.lines), 3500));
            lyricsData.lines = await Promise.race([transPromise, timeoutPromise]);
        } catch(e) {}
    }

    return { videoId, title: title || cTitle, artist: artist || cArtist, album, lyrics: lyricsData };
}

const handler = async (req, res) => {
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    const videoId = (req.query.id || req.body?.id || '').trim();
    const title = (req.query.title || req.body?.title || '').trim();
    const artist = (req.query.artist || req.body?.artist || '').trim();

    if (!videoId) { res.status(400).json({ status: false, message: 'Parameter id wajib diisi' }); return; }

    try {
        const result = await getLyrics1(videoId, title, artist);
        res.status(200).json({ status: true, source: 'lrclib', result });
    } catch(e) {
        res.status(500).json({ status: false, message: e.message });
    }
};

handler.getLyrics1 = getLyrics1;
module.exports = G.wrap(handler);

