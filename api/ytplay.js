const G = require('./_guard.js');
const axios = require('axios');
const crypto = require('crypto');

// Memory cache for audio stream URLs (valid 1.5 hours)
const ytCache = new Map();
const CACHE_TTL = 90 * 60 * 1000;

// Second provider (vidssave) races alongside the savetube CDNs below.
// It returns a ready-to-use googlevideo.com URL directly, no AES decrypt needed.
async function tryVidssave(fullUrl, idMatch, signal) {
  const api = axios.create({
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "origin": "https://vidssave.com",
      "referer": "https://vidssave.com/",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "accept": "application/json, text/plain, */*"
    },
    timeout: 9000,
    signal
  });

  const params = new URLSearchParams({
    auth: process.env.VIDSSAVE_AUTH || "20250901majwlqo",
    domain: "api-ak.vidssave.com",
    origin: "source",
    link: fullUrl
  });

  const res = await api.post("https://api.vidssave.com/api/contentsite_api/media/parse", params.toString());
  const data = res?.data?.data;
  if (!data) {
    throw new Error(`No data from vidssave — raw response: ${JSON.stringify(res.data).slice(0, 300)}`);
  }

  // Prefer medium quality (128KBPS) for faster load; fall back to whatever's there.
  const audioList = (data.resources || []).filter(r => r.type === "audio" && r.download_url);
  const pick = audioList.find(r => r.quality === "128KBPS") || audioList[0];
  if (!pick) throw new Error("No audio resource from vidssave");

  return {
    duration: `${Math.floor(data.duration / 60)}:${(data.duration % 60).toString().padStart(2, "0")}`,
    audio: pick.download_url,
    cdn: "vidssave"
  };
}

async function getDownload(url) {
  const idMatch = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/
  ].find(p => p.test(url))?.exec(url)?.[1] || (url.length === 11 ? url : null);

  if (!idMatch) {
    console.error("Invalid URL or video ID:", url);
    return null;
  }

  // Check cache first
  const cached = ytCache.get(idMatch);
  if (cached && cached.expireAt > Date.now()) {
    console.log(`[EXTRACT] Cache hit for video ID: ${idMatch}`);
    return cached.data;
  }

  const fullUrl = "https://www.youtube.com/watch?v=" + idMatch;
  const cdns = ["cdn405.savetube.vip", "cdn403.savetube.vip", "cdn401.savetube.vip"];

  // Race all CDNs in parallel instead of looping sequentially.
  // Sequential (3 cdn x 2 attempts x 25s) could take up to 150s, way past
  // Netlify's ~30s hard function timeout. Racing them means total wall time
  // is bounded by the single slowest attempt (capped below), not the sum.
  const PER_CDN_TIMEOUT = 20000; // ms — temporarily raised to confirm whether savetube's
                                  // /download step is truly blocked or just very slow
  const controller = new AbortController();

  async function tryCdn(cdn) {
    const api = axios.create({
      headers: {
        "content-type": "application/json",
        "origin": "https://yt.savetube.me",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
      },
      timeout: PER_CDN_TIMEOUT,
      signal: controller.signal
    });

    const infoResponse = await api.post(`https://${cdn}/v2/info`, { url: fullUrl }).catch(err => {
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        throw new Error(`${cdn} unreachable/timeout (likely dead CDN)`);
      }
      throw err;
    });
    const encryptedData = infoResponse?.data?.data;
    if (!encryptedData) throw new Error(`No data from ${cdn}`);

    const encrypted = Buffer.from(encryptedData, "base64");
    const decipher = crypto.createDecipheriv("aes-128-cbc",
      Buffer.from("C5D58EF67A7584E4A29F6C35BBC4EB12", "hex"),
      encrypted.slice(0, 16)
    );

    const decryptedBuffer = Buffer.concat([
      decipher.update(encrypted.slice(16)),
      decipher.final()
    ]);

    const decrypted = JSON.parse(decryptedBuffer.toString());
    const downloadRes = await api.post(`https://${cdn}/download`, {
      id: idMatch,
      downloadType: "audio",
      quality: "128",
      key: decrypted.key
    });

    const audioUrl = downloadRes.data?.data?.downloadUrl || downloadRes.data?.downloadUrl;
    if (!audioUrl) throw new Error(`No audio URL from ${cdn}`);

    return {
      duration: `${Math.floor(decrypted.duration / 60)}:${(decrypted.duration % 60).toString().padStart(2, "0")}`,
      audio: audioUrl,
      cdn
    };
  }

  // Small head start for vidssave (fastest/lightest provider) — everyone still
  // races in parallel via Promise.any, this just gives vidssave a ~200ms lead
  // so it wins by default when healthy, without turning this into sequential fallback.
  const HEAD_START_MS = 200;
  const delay = (ms) => new Promise(r => setTimeout(r, ms));

  // Provider cadangan (best effort): Piped publik, dipakai kalau savetube/vidssave mati/diblok.
  const pipedHosts = ["pipedapi.kavin.rocks", "pipedapi.adminforge.de", "api.piped.private.coffee"];
  const tryPiped = async (host) => {
    const r = await axios.get(`https://${host}/streams/${idMatch}`, { timeout: 8000, signal: controller.signal, headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36" } });
    const list = (r.data?.audioStreams || []).filter(a => a.url && !a.videoOnly).sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
    const pick = list.find(a => /mp4|m4a/.test(a.mimeType || "") && (a.bitrate || 0) <= 160000) || list[0];
    if (!pick) throw new Error("No audio stream from " + host);
    const d = r.data.duration || 0;
    return { duration: `${Math.floor(d / 60)}:${(d % 60).toString().padStart(2, "0")}`, audio: pick.url, cdn: "piped:" + host };
  };

  try {
    const racers = [
      tryVidssave(fullUrl, idMatch, controller.signal).catch(err => {
        const detail = err?.response ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}` : err.message;
        console.error(`[EXTRACT] vidssave failed:`, detail);
        err.__provider = 'vidssave';
        err.__detail = detail;
        throw err;
      }),
      ...pipedHosts.map(h => delay(1500).then(() => tryPiped(h)).catch(err => { err.__provider = h; err.__detail = err.message; throw err; })),
      ...cdns.map(cdn =>
        delay(HEAD_START_MS).then(() => tryCdn(cdn)).catch(err => {
          const detail = err?.response ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}` : err.message;
          console.error(`[EXTRACT] ${cdn} failed:`, detail);
          err.__provider = cdn;
          err.__detail = detail;
          throw err;
        })
      )
    ];

    const result = await Promise.any(racers);

    // Winner found, stop the losing in-flight requests so they don't
    // keep the function/connections alive uselessly.
    controller.abort();

    console.log(`[EXTRACT] Winner: ${result.cdn}`);
    ytCache.set(idMatch, { data: result, expireAt: Date.now() + CACHE_TTL });
    return result;
  } catch (aggregateErr) {
    const details = (aggregateErr?.errors || []).map(e => `${e.__provider}: ${e.__detail || e.message}`);
    console.error("[EXTRACT] All CDNs failed:", details.join(" | "));
    const notFoundErr = new Error("All providers failed");
    notFoundErr.__details = details;
    throw notFoundErr;
  }
}

const __handler = async (req, res) => {
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'POST') { res.status(405).json({ status: false, message: 'Method not allowed' }); return; }

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    body = body || {};

    const url = (body.query || body.url || '').trim();
    if (!url) { res.status(400).json({ status: false, message: 'Parameter query wajib diisi' }); return; }

    console.log(`[EXTRACT] Starting extraction for: ${url}`);
    const debug = req.query?.debug === '1';

    try {
        let audioData = await getDownload(url);

        if (audioData && audioData.audio) {
            console.log("[EXTRACT] Success");
            return res.status(200).json({
                status: true,
                result: {
                    duration: audioData.duration || null,
                    download: { audio: audioData.audio }
                }
            });
        }
    } catch (err) {
        console.error("[EXTRACT] All providers failed:", err.__details?.join(" | ") || err.message);
        return res.status(503).json({
            status: false,
            error: "Media extraction services are currently overloaded. Please try another track.",
            ...(debug ? { debug: err.__details || [err.message] } : {})
        });
    }

    console.error("[EXTRACT] All methods failed");
    res.status(503).json({ status: false, error: "Media extraction services are currently overloaded. Please try another track." });
};

module.exports = G.wrap(__handler);
