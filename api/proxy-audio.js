// /api/proxy-audio di Vercel = JEMBATAN streaming ke proxy audio Netlify (Edge Runtime).
// Meneruskan Range (seek) dan mengalirkan audio langsung, tidak ditampung di memori.
export const config = { runtime: 'edge' };

const BACKEND = (process.env.MUSIC_BACKEND || 'https://hcmusify.netlify.app').replace(/\/+$/, '');
const RATE_MAX = parseInt(process.env.RATE_MAX_AUDIO, 10) || 240;
const rateHits = new Map();
const PRIVATE_HOST = /^(localhost|.*\.(local|internal|localhost)|0\.0\.0\.0|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|169\.254\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|\[.*\])$/i;

function isRateLimited(req) {
    const ip = (req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
    const now = Date.now(), rec = rateHits.get(ip);
    if (!rec || now > rec.resetAt) {
        if (rateHits.size > 5000) rateHits.forEach((v, k) => { if (now > v.resetAt) rateHits.delete(k); });
        rateHits.set(ip, { count: 1, resetAt: now + 60000 });
        return false;
    }
    rec.count++;
    return rec.count > RATE_MAX;
}

export default async function handler(req) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
    if (isRateLimited(req)) return new Response('Terlalu banyak request, coba lagi sebentar', { status: 429 });

    const target = new URL(req.url).searchParams.get('url');
    if (!target) return new Response('Missing url parameter', { status: 400 });
    let parsed;
    try { parsed = new URL(target); } catch { return new Response('Invalid url parameter', { status: 400 }); }
    if (parsed.protocol !== 'https:' || PRIVATE_HOST.test(parsed.hostname) || parsed.username || parsed.password) {
        return new Response('Target tidak diizinkan', { status: 400 });
    }

    const headers = {};
    const range = req.headers.get('range');
    if (range) headers['range'] = range;

    let upstream;
    try {
        upstream = await fetch(BACKEND + '/api/proxy-audio?url=' + encodeURIComponent(target), { method: req.method, headers, signal: req.signal });
    } catch (err) {
        console.log('[AUDIO-BRIDGE] gagal hubungi Netlify: ' + err.message);
        return new Response('Proxy error', { status: 502 });
    }
    console.log('[AUDIO-BRIDGE] netlify status=' + upstream.status + ' ct=' + (upstream.headers.get('content-type') || '-') + ' host=' + parsed.host);

    const out = new Headers();
    ['content-type', 'content-length', 'accept-ranges', 'content-range', 'etag', 'last-modified'].forEach(h => {
        const v = upstream.headers.get(h);
        if (v) out.set(h, v);
    });
    if (!out.has('accept-ranges')) out.set('accept-ranges', 'bytes');
    out.set('cache-control', 'private, no-store');
    return new Response(upstream.body, { status: upstream.status, headers: out });
}
