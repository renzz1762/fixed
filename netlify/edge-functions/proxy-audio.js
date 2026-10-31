// Runs on Netlify's Edge (Deno) runtime instead of a regular Lambda Function
// because Lambda-based functions buffer the whole response in memory with a
// small payload limit, which breaks playback of longer tracks and Range
// (seek) requests. This streams bytes directly from origin to client.

const rateHits = new Map();
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 60; // lebih longgar dari ytplay karena tiap lagu bisa nge-fetch berkali² (seek/preload)

// Ambil dari upstream, retry 1x kalau error jaringan / 5xx. `signal` = putus kalau pendengar menutup koneksi
// (biar koneksi ke CDN nggak nyangkut & numpuk kalau user ganti lagu / app ditutup).
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
    if (isRateLimited(request)) {
        return new Response('Terlalu banyak request, coba lagi sebentar', { status: 429 });
    }
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) return new Response('Missing url parameter', { status: 400 });

    let parsed;
    try {
        parsed = new URL(targetUrl);
    } catch (e) {
        return new Response('Invalid url parameter', { status: 400 });
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return new Response('Invalid url protocol', { status: 400 });
    }

    const upstreamHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/149.0.0.0 Safari/537.36'
    };
    const range = request.headers.get('range');
    if (range) upstreamHeaders['Range'] = range;

    let upstream;
    try {
        upstream = await fetchUpstream(targetUrl, upstreamHeaders, request.signal);
    } catch (err) {
        return new Response('Proxy error: ' + err.message, { status: 502 });
    }

    const respHeaders = new Headers();
    ['content-type', 'content-length', 'accept-ranges', 'content-range', 'etag', 'last-modified'].forEach((h) => {
        const v = upstream.headers.get(h);
        if (v) respHeaders.set(h, v);
    });
    if (!respHeaders.has('accept-ranges')) respHeaders.set('accept-ranges', 'bytes');
    respHeaders.set('cache-control', 'private, no-store');   // jangan ditumpuk di cache CDN/SW

    return new Response(upstream.body, { status: upstream.status, headers: respHeaders });
};

export const config = { path: '/api/proxy-audio' };
