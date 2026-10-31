const push = require('./_push');

// Dipanggil dari bot WhatsApp (Anya MD, command .notif)
// POST header  x-notif-secret: <NOTIF_SECRET>
// body {message, title?, url?}     -> kirim ke semua pengguna yang sudah aktifkan notifikasi
// body {action:'count'}            -> cek jumlah pelanggan
module.exports = async (req, res) => {
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'POST') { res.status(405).json({ status: false, message: 'Method not allowed' }); return; }

    const secret = process.env.NOTIF_SECRET;
    if (!secret) { res.status(503).json({ status: false, message: 'NOTIF_SECRET belum di-set di environment variable hosting' }); return; }
    const body = push.parseBody(req);
    const given = (req.headers && (req.headers['x-notif-secret'] || req.headers['X-Notif-Secret'])) || body.secret;
    if (!push.safeEqual(given, secret)) { res.status(401).json({ status: false, message: 'Secret salah' }); return; }

    try {
        const db = await push.backend();
        const subs = await push.listSubs(db);
        if (body.action === 'count') { res.status(200).json({ status: true, total: subs.length }); return; }

        const message = String(body.message || body.text || '').trim().slice(0, 500);
        if (!message) { res.status(400).json({ status: false, message: 'Teks notifikasi kosong' }); return; }
        const title = String(body.title || 'Notifikasi dari HC MUSIFY').trim().slice(0, 80);
        let url = '/';
        if (typeof body.url === 'string' && /^(\/|https?:\/\/)/.test(body.url)) url = body.url.slice(0, 500);

        const vapid = await push.getVapid(db);
        const host = (req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || '';
        const subject = process.env.NOTIF_SUBJECT || (host ? 'https://' + host : 'https://hcmusify.netlify.app');
        const origin = process.env.NOTIF_ORIGIN || (host ? 'https://' + host : 'https://hcmusify.netlify.app');
        const payload = JSON.stringify({ title, body: message, url, icon: origin + '/icon-192.png', badge: origin + '/badge-bell.png?v=2', tag: 'hc-' + Date.now(), ts: Date.now() });
        const wp = push.webpush();
        const opts = { TTL: 86400, urgency: 'high', vapidDetails: { subject, publicKey: vapid.publicKey, privateKey: vapid.privateKey } };

        let sent = 0, failed = 0, removed = 0;
        for (let i = 0; i < subs.length; i += 25) {
            const batch = subs.slice(i, i + 25);
            const results = await Promise.allSettled(batch.map(s => wp.sendNotification(s.sub, payload, opts)));
            for (let j = 0; j < results.length; j++) {
                const r = results[j];
                if (r.status === 'fulfilled') { sent++; continue; }
                failed++;
                const code = r.reason && r.reason.statusCode;
                if (code === 404 || code === 410) {
                    removed++;
                    try { await db.del(batch[j].key); } catch (e) {}
                }
            }
        }
        res.status(200).json({ status: true, total: subs.length, sent, failed, removed });
    } catch (e) {
        res.status(500).json({ status: false, message: e.message });
    }
};
