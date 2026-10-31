// Proxy gambar same-origin (Node function Vercel) supaya canvas bisa baca warna cover.
const { Readable } = require('stream');
const G = require('./_guard.js');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/149.0.0.0 Safari/537.36';

module.exports = async (req, res) => {
    if (!G.check(req, res, { max: parseInt(process.env.RATE_MAX, 10) || 120 })) return;
    const targetUrl = (req.query && req.query.url) || '';
    if (!targetUrl) { res.status(400).send('Missing url parameter'); return; }
    if (G.badTarget(targetUrl)) { res.status(400).send('Target tidak diizinkan'); return; }

    let upstream;
    try { upstream = await fetch(targetUrl, { headers: { 'User-Agent': UA }, redirect: 'follow' }); }
    catch (err) { res.status(502).send('Proxy error: ' + err.message); return; }

    if (!upstream.ok) { try { await upstream.body?.cancel(); } catch (e) {} res.status(upstream.status).send('Upstream error'); return; }
    const ct = (upstream.headers.get('content-type') || '').toLowerCase();
    if (!ct.startsWith('image/')) { try { await upstream.body?.cancel(); } catch (e) {} res.status(415).send('Bukan gambar'); return; }

    res.setHeader('content-type', ct);
    res.setHeader('cache-control', 'public, max-age=86400');
    res.statusCode = 200;
    if (!upstream.body) { res.end(); return; }
    const stream = Readable.fromWeb(upstream.body);
    stream.on('error', () => { try { res.end(); } catch (e) {} });
    stream.pipe(res);
};
