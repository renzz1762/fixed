const G = require('./_guard.js');
const push = require('./_push');

// GET -> kasih public key VAPID ke browser (dipakai buat langganan notifikasi)
const __handler = async (req, res) => {
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'GET') { res.status(405).json({ status: false, message: 'Method not allowed' }); return; }
    try {
        const db = await push.backend();
        const v = await push.getVapid(db);
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).json({ status: true, publicKey: v.publicKey });
    } catch (e) {
        res.status(500).json({ status: false, message: e.message });
    }
};

module.exports = G.wrap(__handler);
