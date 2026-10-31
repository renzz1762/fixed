const G = require('./_guard.js');
const { getTranscribe } = require('./transcribe.js');
const { translateLines } = require('./translate.js');

async function getLyrics2(videoId) {
    let lyricsData = { type: 'none', lines: [] };
    let title = '', artist = '';

    try {
        const transcribed = await getTranscribe(videoId);
        if (transcribed) {
            title = transcribed.title || '';
            if (transcribed.synced && transcribed.synced.length > 0) {
                lyricsData = {
                    type: 'synced',
                    lines: transcribed.synced.map(s => ({
                        time: typeof s.time === 'number' ? s.time : (parseFloat(String(s.start).replace('s', '')) || 0),
                        text: s.text || '• • •'
                    }))
                };
            } else if (transcribed.text) {
                lyricsData = {
                    type: 'plain',
                    lines: transcribed.text.split('. ').map(t => ({ time: -1, text: t.trim() })).filter(t => t.text)
                };
            }
        }
    } catch (err) {
        console.error('[LYRICS2] Transcribe error:', err.message);
    }

    if (lyricsData.lines && lyricsData.lines.length > 0) {
        lyricsData.lines = await translateLines(lyricsData.lines);
    }

    return { videoId, title, artist, lyrics: lyricsData };
}

const handler = async (req, res) => {
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    const videoId = (req.query.id || req.body?.id || '').trim();
    if (!videoId) { res.status(400).json({ status: false, message: 'Parameter id wajib diisi' }); return; }

    try {
        const result = await getLyrics2(videoId);
        res.status(200).json({ status: true, source: 'transcribe', result });
    } catch(e) {
        res.status(500).json({ status: false, message: e.message });
    }
};

handler.getLyrics2 = getLyrics2;
module.exports = G.wrap(handler);
