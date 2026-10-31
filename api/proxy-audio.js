// Proxy audio streaming (Edge Runtime Vercel) - support Range/206 biar bisa seek.
// Edge = stream langsung dari sumber ke pendengar (tidak ditampung di memori) dan IP-nya beda dari serverless biasa.
export const config = { runtime: 'edge' };

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/149.0.0.0 Safari/537.36';
const rateHits = new Map();
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = parseInt(process.env.RATE_MAX, 10) || 120;
const PRIVATE_HOST = /^(localhost|.*\.(local|internal|localhost)|0\.0\.0\.0|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|169\.254\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|\[.*\])$/i;

async function fetchUpstream(targetUrl, headers, signal) {
    let lastErr;
    for (let i = 0; i < 2; i++) {
        try {
            const r = await fetch(targetUrl, { headers, redirect: 'follow', signal });
            if (r.status >= 500 && i === 0) { try { await r.body?.cancel(); } catch (e) {} continue; }
            return r;
        } catch (e) {
            lastErr = e;
            if (signal && signal.aborted) throw e;
        }
    }
    throw lastErr || new Error('upstream gagal');
}

function isRateLimited(request) {
    const ip = (request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
    const now = Date.now();
    const rec = rateHits.get(ip);
    if (!rec || now > rec.resetAt) {
        if (rateHits.size > 5000) { rateHits.forEach((v, k) => { if (now > v.resetAt) rateHits.delete(k); }); }
        rateHits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return false;
    }
    rec.count++;
    return rec.count > RATE_MAX;
}

export default async function handler(request) {
    if (isRateLimited(request)) return new Response('Terlalu banyak request, coba lagi sebentar', { status: 429 });
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) return new Response('Missing url parameter', { status: 400 });

    let parsed;
    try { parsed = new URL(targetUrl); } catch (e) { return new Response('Invalid url parameter', { status: 400 }); }
    if (parsed.protocol !== 'https:' || PRIVATE_HOST.test(parsed.hostname) || parsed.username || parsed.password) {
        return new Response('Target tidak diizinkan', { status: 400 });
    }

    const upstreamHeaders = { 'User-Agent': UA };
    const range = request.headers.get('range');
    if (range) upstreamHeaders['Range'] = range;

    let upstream;
    try { upstream = await fetchUpstream(targetUrl, upstreamHeaders, request.signal); }
    catch (err) { return new Response('Proxy error: ' + err.message, { status: 502 }); }

    const ct = (upstream.headers.get('content-type') || '').toLowerCase();
    console.log('[AUDIO] upstream status=' + upstream.status + ' host=' + parsed.host + ' ct=' + ct + ' range=' + (range || '-'));
    if (/^(text\/|application\/(json|xml|javascript))/.test(ct)) {
        try { await upstream.body?.cancel(); } catch (e) {}
        return new Response('Sumber balas halaman web, bukan audio', { status: 502 });
    }

    const respHeaders = new Headers();
    ['content-type', 'content-length', 'accept-ranges', 'content-range', 'etag', 'last-modified'].forEach((h) => {
        const v = upstream.headers.get(h);
        if (v) respHeaders.set(h, v);
    });
    if (!respHeaders.has('accept-ranges')) respHeaders.set('accept-ranges', 'bytes');
    respHeaders.set('cache-control', 'private, no-store');
    return new Response(upstream.body, { status: upstream.status, headers: respHeaders });
}
