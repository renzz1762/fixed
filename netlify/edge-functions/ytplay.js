// Edge Function version of the YT audio extractor.
//
// WHY THIS EXISTS: the Netlify Functions (AWS Lambda) version of this same
// logic was getting blocked by both vidssave ("analyze_risk") and savetube
// (silent connection drop) — both flagging the Lambda IP range as bot/cloud
// traffic. Edge Functions run on a different network (Deno Deploy edge),
// so this is worth trying as a way around that IP-reputation block.
//
// Edge Functions run on Deno, not Node — no `require()`, no axios, no Node
// `crypto` module. Uses native `fetch` and the Web Crypto API instead.

const CACHE_TTL = 90 * 60 * 1000;
const ytCache = new Map();

function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

function base64ToBytes(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

async function aesCbcDecrypt(base64Data, keyHex) {
    const encrypted = base64ToBytes(base64Data);
    const iv = encrypted.slice(0, 16);
    const ciphertext = encrypted.slice(16);

    const keyBytes = hexToBytes(keyHex);
    const cryptoKey = await crypto.subtle.importKey(
        'raw', keyBytes, { name: 'AES-CBC' }, false, ['decrypt']
    );
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, cryptoKey, ciphertext);
    return new TextDecoder().decode(decrypted);
}

function formatDuration(seconds) {
    return `${Math.floor(seconds / 60)}:${(Math.floor(seconds) % 60).toString().padStart(2, '0')}`;
}

async function fetchJson(url, opts, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { ...opts, signal: controller.signal });
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = null; }
        if (!res.ok) {
            const err = new Error(`HTTP ${res.status}`);
            err.status = res.status;
            err.body = data || text;
            throw err;
        }
        return data;
    } finally {
        clearTimeout(timer);
    }
}

async function tryVidssave(fullUrl) {
    const params = new URLSearchParams({
        auth: '20250901majwlqo',
        domain: 'api-ak.vidssave.com',
        origin: 'source',
        link: fullUrl
    });

    const json = await fetchJson('https://api.vidssave.com/api/contentsite_api/media/parse', {
        method: 'POST',
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            'origin': 'https://vidssave.com',
            'referer': 'https://vidssave.com/',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'accept': 'application/json, text/plain, */*'
        },
        body: params.toString()
    }, 9000);

    const data = json?.data;
    if (!data) throw new Error(`No data from vidssave — raw: ${JSON.stringify(json).slice(0, 300)}`);

    const audioList = (data.resources || []).filter(r => r.type === 'audio' && r.download_url);
    const pick = audioList.find(r => r.quality === '128KBPS') || audioList[0];
    if (!pick) throw new Error('No audio resource from vidssave');

    return { duration: formatDuration(data.duration), audio: pick.download_url, cdn: 'vidssave' };
}

async function tryCdn(cdn, fullUrl, idMatch) {
    const infoJson = await fetchJson(`https://${cdn}/v2/info`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'origin': 'https://yt.savetube.me',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        },
        body: JSON.stringify({ url: fullUrl })
    }, 9000);

    const encryptedData = infoJson?.data;
    if (!encryptedData) throw new Error(`No data from ${cdn}`);

    const decryptedText = await aesCbcDecrypt(encryptedData, 'C5D58EF67A7584E4A29F6C35BBC4EB12');
    const decrypted = JSON.parse(decryptedText);

    const downloadJson = await fetchJson(`https://${cdn}/download`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'origin': 'https://yt.savetube.me',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        },
        body: JSON.stringify({ id: idMatch, downloadType: 'audio', quality: '128', key: decrypted.key })
    }, 9000);

    const audioUrl = downloadJson?.data?.downloadUrl || downloadJson?.downloadUrl;
    if (!audioUrl) throw new Error(`No audio URL from ${cdn}`);

    return { duration: formatDuration(decrypted.duration), audio: audioUrl, cdn };
}

// Provider cadangan (best effort): instance Piped publik. Dipakai kalau savetube/vidssave lagi mati/diblok.
const PIPED_HOSTS = ['pipedapi.kavin.rocks', 'pipedapi.adminforge.de', 'api.piped.private.coffee'];
async function tryPiped(host, idMatch) {
    const json = await fetchJson(`https://${host}/streams/${idMatch}`, {
        headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36' }
    }, 8000);
    const list = (json?.audioStreams || []).filter(a => a.url && !a.videoOnly);
    list.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
    const pick = list.find(a => /mp4|m4a/.test(a.mimeType || '') && (a.bitrate || 0) <= 160000) || list[0];
    if (!pick) throw new Error('No audio stream from ' + host);
    return { duration: formatDuration(json.duration || 0), audio: pick.url, cdn: 'piped:' + host };
}

async function getDownload(url) {
    const idMatch =
        url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/)?.[1] ||
        url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)?.[1] ||
        (url.length === 11 ? url : null);

    if (!idMatch) return { error: 'Invalid URL or video ID' };

    const cached = ytCache.get(idMatch);
    if (cached && cached.expireAt > Date.now()) return { result: cached.data };

    const fullUrl = 'https://www.youtube.com/watch?v=' + idMatch;
    const cdns = ['cdn405.savetube.vip', 'cdn403.savetube.vip', 'cdn401.savetube.vip'];

    const HEAD_START_MS = 200;
    const delay = (ms) => new Promise(r => setTimeout(r, ms));

    const label = (p, promise) => promise.catch(err => {
        const detail = err.body ? `HTTP ${err.status}: ${JSON.stringify(err.body).slice(0, 200)}` : err.message;
        throw new Error(`${p}: ${detail}`);
    });

    const racers = [
        label('vidssave', tryVidssave(fullUrl)),
        ...cdns.map(cdn => label(cdn, delay(HEAD_START_MS).then(() => tryCdn(cdn, fullUrl, idMatch)))),
        ...PIPED_HOSTS.map(h => label(h, delay(1500).then(() => tryPiped(h, idMatch))))
    ];

    try {
        const result = await Promise.any(racers);
        ytCache.set(idMatch, { data: result, expireAt: Date.now() + CACHE_TTL });
        return { result };
    } catch (aggregateErr) {
        const details = (aggregateErr.errors || []).map(e => e.message);
        return { errors: details };
    }
}

// ---- PROTEKSI: origin/referer check + rate limit per IP ----
// Endpoint ini yang paling "berharga" buat di-scrape (ekstraksi audio YouTube
// gratis), makanya paling penting dikasih pagar. CORS lama '*' berarti situs
// LAIN bisa manggil endpoint ini langsung dari browser mereka dan numpang
// jadi backend gratisan buat situs mereka sendiri.
// Domain TIDAK di-hardcode lagi: request dianggap sah kalau datang dari host website ini sendiri
// (domain netlify.app apa pun, domain custom, dst). Opsional: isi env ALLOWED_ORIGIN di Netlify
// (pisah koma) kalau mau mengizinkan domain lain juga.
const ALLOWED_HOSTS = (Deno.env.get('ALLOWED_ORIGIN') || '')
    .split(',').map(s => s.trim()).filter(Boolean);

function hostOf(u) {
    try { return new URL(u).host; } catch { return ''; }
}

function isAllowedOrigin(request) {
    const selfHost = hostOf(request.url);
    const origin = request.headers.get('origin') || '';
    const referer = request.headers.get('referer') || '';
    if (selfHost && (hostOf(origin) === selfHost || hostOf(referer) === selfHost)) return true;
    if (request.headers.get('sec-fetch-site') === 'same-origin') return true;
    return ALLOWED_HOSTS.some(h => origin.includes(h) || referer.includes(h));
}

const rateHits = new Map();
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 90;

function isRateLimited(request) {
    const ip = request.headers.get('x-nf-client-connection-ip') || request.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();
    const rec = rateHits.get(ip);
    if (!rec || now > rec.resetAt) {
        rateHits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return false;
    }
    rec.count++;
    return rec.count > RATE_MAX;
}

export default async (request) => {
    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders(request) });
    }
    if (request.method !== 'POST') {
        return json({ status: false, message: 'Method not allowed' }, 405, request);
    }
    if (!isAllowedOrigin(request)) {
        return json({ status: false, message: 'Access denied: Cross-origin requests from external domains are disabled.' }, 403, request);
    }
    if (isRateLimited(request)) {
        return json({ status: false, message: 'Terlalu banyak request, coba lagi sebentar' }, 429, request);
    }

    let body;
    try { body = await request.json(); } catch { body = {}; }

    const url = (body.query || body.url || '').trim();
    if (!url) return json({ status: false, message: 'Parameter query wajib diisi' }, 400, request);

    const debug = new URL(request.url).searchParams.get('debug') === '1';
    const outcome = await getDownload(url);

    if (outcome.result?.audio) {
        return json({
            status: true,
            result: {
                duration: outcome.result.duration || null,
                download: { audio: outcome.result.audio }
            }
        }, 200, request);
    }

    return json({
        status: false,
        error: 'Media extraction services are currently overloaded. Please try another track.',
        ...(debug ? { debug: outcome.errors || [outcome.error] } : {})
    }, 503, request);
};

function corsHeaders(request) {
    const origin = request && request.headers.get('origin');
    return {
        'access-control-allow-origin': (origin && isAllowedOrigin(request)) ? origin : (request ? new URL(request.url).origin : 'null'),
        'access-control-allow-headers': 'Content-Type, Authorization, X-Requested-With',
        'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD'
    };
}

function json(obj, status = 200, request = null) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: { 'content-type': 'application/json', ...corsHeaders(request) }
    });
}

export const config = { path: '/api/ytplay' };
