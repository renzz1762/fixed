const G = require('./_guard.js');
const push = require('./_push');

// POST {subscription}                    -> simpan langganan
// POST {action:'unsubscribe', endpoint}  -> hapus langganan
const __handler = async (req, res) => {
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'POST') { res.status(405).json({ status: false, message: 'Method not allowed' }); return; }
    try {
        const body = push.parseBody(req);
        const db = await push.backend();
        if (body.action === 'unsubscribe') {
            if (typeof body.endpoint === 'string' && body.endpoint) await push.removeSub(db, body.endpoint);
            res.status(200).json({ status: true });
            return;
        }
        if (!push.validSub(body.subscription)) { res.status(400).json({ status: false, message: 'Subscription tidak valid' }); return; }
        await push.saveSub(db, body.subscription);
        res.status(200).json({ status: true, backend: db.name });
    } catch (e) {
        res.status(500).json({ status: false, message: e.message });
    }
};

module.exports = G.wrap(__handler);
