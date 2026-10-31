// Proxy audio streaming (Node function Vercel) - support Range/206 biar bisa seek.
const { Readable } = require('stream');
const G = require('./_guard.js');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/149.0.0.0 Safari/537.36';

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

module.exports = async (req, res) => {
    if (!G.check(req, res, { max: parseInt(process.env.RATE_MAX, 10) || 120 })) return;
    const targetUrl = (req.query && req.query.url) || '';
    if (!targetUrl) { res.status(400).send('Missing url parameter'); return; }
    if (G.badTarget(targetUrl)) { res.status(400).send('Target tidak diizinkan'); return; }

    const headers = { 'User-Agent': UA };
    if (req.headers.range) headers['Range'] = req.headers.range;

    // putus koneksi ke CDN kalau pendengar menutup (ganti lagu / app ditutup)
    const ctrl = new AbortController();
    res.on('close', () => { if (!res.writableEnded) ctrl.abort(); });

    let upstream;
    try { upstream = await fetchUpstream(targetUrl, headers, ctrl.signal); }
    catch (err) { console.log('[AUDIO] fetch gagal: ' + err.message); if (!res.headersSent) res.status(502).send('Proxy error: ' + err.message); return; }

    const ct = (upstream.headers.get('content-type') || '').toLowerCase();
    try { console.log('[AUDIO] upstream status=' + upstream.status + ' host=' + new URL(targetUrl).host + ' ct=' + ct + ' range=' + (req.headers.range || '-')); } catch (e) {}
    if (/^(text\/|application\/(json|xml|javascript))/.test(ct)) {
        try { await upstream.body?.cancel(); } catch (e) {}
        res.status(415).send('Tipe konten tidak diizinkan');
        return;
    }

    ['content-type', 'content-length', 'accept-ranges', 'content-range', 'etag', 'last-modified'].forEach((h) => {
        const v = upstream.headers.get(h);
        if (v) res.setHeader(h, v);
    });
    if (!upstream.headers.get('accept-ranges')) res.setHeader('accept-ranges', 'bytes');
    res.setHeader('cache-control', 'private, no-store');
    res.statusCode = upstream.status;

    if (!upstream.body) { res.end(); return; }
    const stream = Readable.fromWeb(upstream.body);
    stream.on('error', () => { try { res.end(); } catch (e) {} });
    stream.pipe(res);
};
