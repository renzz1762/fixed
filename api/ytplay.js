// /api/ytplay di Vercel = JEMBATAN ke mesin musik di Netlify (Edge Runtime).
// Kenapa: sumber audio memblok server Vercel, sedangkan edge function Netlify diterima.
// File ini hanya meneruskan permintaan ke Netlify, jadi TIDAK ada ekstraksi di sini.
// Ganti alamat backend lewat env MUSIC_BACKEND kalau domain Netlify-mu beda.
export const config = { runtime: 'edge' };

const BACKEND = (process.env.MUSIC_BACKEND || 'https://hcmusify.netlify.app').replace(/\/+$/, '');
const EXTRA_HOSTS = (process.env.ALLOWED_HOSTS || '').split(',').map(s => s.trim()).filter(Boolean);
const RATE_MAX = parseInt(process.env.RATE_MAX, 10) || 60;
const rateHits = new Map();

function hostOf(u) { try { return new URL(u).host; } catch { return ''; } }
function clientIp(req) { return (req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim(); }

function isAllowed(req) {
    const self = (req.headers.get('x-forwarded-host') || req.headers.get('host') || hostOf(req.url) || '').split(',')[0].trim();
    const origin = req.headers.get('origin') || '';
    const referer = req.headers.get('referer') || '';
    if (self && (hostOf(origin) === self || hostOf(referer) === self)) return true;
    if (req.headers.get('sec-fetch-site') === 'same-origin') return true;
    return EXTRA_HOSTS.some(h => origin.includes(h) || referer.includes(h));
}

function isRateLimited(req) {
    const ip = clientIp(req), now = Date.now(), rec = rateHits.get(ip);
    if (!rec || now > rec.resetAt) {
        if (rateHits.size > 5000) rateHits.forEach((v, k) => { if (now > v.resetAt) rateHits.delete(k); });
        rateHits.set(ip, { count: 1, resetAt: now + 60000 });
        return false;
    }
    rec.count++;
    return rec.count > RATE_MAX;
}

function json(obj, status) {
    return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

export default async function handler(req) {
    if (req.method !== 'POST') return json({ status: false, message: 'Method not allowed' }, 405);
    if (!isAllowed(req)) return json({ status: false, message: 'Access denied' }, 403);
    if (isRateLimited(req)) return json({ status: false, message: 'Terlalu banyak request, coba lagi sebentar' }, 429);

    let body;
    try { body = await req.text(); } catch { body = '{}'; }
    if (body.length > 4096) return json({ status: false, message: 'Request terlalu besar' }, 413);

    // Origin/Referer diisi domain Netlify supaya lolos pemeriksaan asal di sana
    const upstream = await fetch(BACKEND + '/api/ytplay', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'origin': BACKEND, 'referer': BACKEND + '/' },
        body,
        signal: AbortSignal.timeout(28000)
    }).catch(err => { console.log('[YTPLAY-BRIDGE] gagal hubungi Netlify: ' + err.message); return null; });

    if (!upstream) return json({ status: false, error: 'Mesin musik tidak bisa dihubungi, coba lagi sebentar.' }, 502);
    const text = await upstream.text();
    console.log('[YTPLAY-BRIDGE] netlify status=' + upstream.status);
    return new Response(text, { status: upstream.status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}
