const express = require('express');
const path = require('path');
const https = require('https');
const http = require('http');
const fs = require('fs');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Function to validate and return allowed origin matching current domain/host
function getAllowedOrigin(req) {
    const origin = req.headers.origin || req.headers.referer;
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    if (origin) {
        try {
            const originUrl = new URL(origin);
            if (host && originUrl.host === host) {
                return originUrl.origin;
            } else {
                return null;
            }
        } catch (e) {
            return null;
        }
    }
    if (host) {
        const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
        return `${proto}://${host}`;
    }
    return null;
}

// Strict CORS middleware: Disable CORS for external domains (same-origin only)
app.use((req, res, next) => {
    const origin = req.headers.origin || req.headers.referer;
    const host = req.headers['x-forwarded-host'] || req.headers.host;

    // Block cross-origin requests to /api/ from external domains
    if (origin && host && req.path.startsWith('/api/')) {
        try {
            const originUrl = new URL(origin);
            if (originUrl.host !== host) {
                if (req.method === 'OPTIONS') {
                    return res.status(403).end();
                }
                return res.status(403).json({
                    status: false,
                    message: 'Access denied: Cross-origin requests from external domains are disabled.'
                });
            }
        } catch (e) {}
    }

    const allowedOrigin = getAllowedOrigin(req);
    if (allowedOrigin) {
        res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
        res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Expose-Headers', '*');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// API Routes
app.all('/api/search', require('./api/search.js'));
app.all('/api/lyrics', require('./api/lyrics.js'));
app.all('/api/lyrics1', require('./api/lyrics1.js'));
app.all('/api/lyrics2', require('./api/lyrics2.js'));
app.all('/api/artist', require('./api/artist.js'));
app.all('/api/album', require('./api/album.js'));
app.all('/api/suggest', require('./api/suggest.js'));
app.all('/api/ytplay', require('./api/ytplay.js'));
app.all('/api/translate', require('./api/translate.js'));
app.all('/api/transcribe', require('./api/transcribe.js'));
app.all('/api/notif-key', require('./api/notif-key.js'));
app.all('/api/notif-subscribe', require('./api/notif-subscribe.js'));
app.all('/api/notif-send', require('./api/notif-send.js'));

// Proxy audio needs to stream in node, bypassing edge function
app.get('/api/proxy-audio', (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('Missing url parameter');
    
    let parsed;
    try {
        parsed = new URL(targetUrl);
    } catch (e) {
        return res.status(400).send('Invalid url parameter');
    }

    const options = {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/149.0.0.0 Safari/537.36'
        }
    };
    if (req.headers.range) {
        options.headers['Range'] = req.headers.range;
    }

    const client = parsed.protocol === 'https:' ? https : http;
    const proxyReq = client.get(targetUrl, options, (proxyRes) => {
        // Handle potential redirects
        if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
            req.query.url = proxyRes.headers.location;
            return app._router.handle(req, res); // naive redirect following
        }

        res.status(proxyRes.statusCode);
        const allowedOrigin = getAllowedOrigin(req);
        if (allowedOrigin) {
            res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
            res.setHeader('Vary', 'Origin');
        }
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
        res.setHeader('Access-Control-Expose-Headers', '*');
        const passthrough = ['content-type', 'content-length', 'accept-ranges', 'content-range'];
        passthrough.forEach(h => {
            if (proxyRes.headers[h]) res.setHeader(h, proxyRes.headers[h]);
        });
        if (!res.getHeader('accept-ranges')) res.setHeader('Accept-Ranges', 'bytes');
        
        proxyRes.pipe(res);
    });
    
    proxyReq.on('error', (err) => {
        if (!res.headersSent) {
            res.status(500).send('Proxy error: ' + err.message);
        }
    });
});

// Static files (from public)
app.use(express.static(path.join(__dirname, 'public')));

// Fallback for SPA routing
app.use((req, res) => {
    const filePath = path.join(__dirname, 'public', 'index.html');
    
    if (req.path.startsWith('/play/')) {
        const videoId = req.path.split('/play/')[1];
        if (videoId) {
            const cleanVideoId = videoId.split('?')[0].split('/')[0];
            const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
            const qTitle = reqUrl.searchParams.get('title');
            const qArtist = reqUrl.searchParams.get('artist');
            const qCover = reqUrl.searchParams.get('cover') || reqUrl.searchParams.get('thumb');

            const coverUrl = qCover || `https://i.ytimg.com/vi/${cleanVideoId}/hqdefault.jpg`;
            const playTitle = qTitle ? (qArtist ? `${qTitle} - ${qArtist}` : qTitle) : `Dengarkan Musik - HC MUSIFY`;
            const playDesc = `Dengarkan ${qTitle || 'lagu favoritmu'} di HC MUSIFY Web Music Player`;

            return fs.readFile(filePath, 'utf8', (err, html) => {
                if (err) return res.sendFile(filePath);
                
                let updatedHtml = html
                    .replace(/<title>.*?<\/title>/gi, `<title>${playTitle}</title>`)
                    .replace(/<meta property="og:title" content=".*?"\s*\/?>/gi, `<meta property="og:title" content="${playTitle}">`)
                    .replace(/<meta property="og:description" content=".*?"\s*\/?>/gi, `<meta property="og:description" content="${playDesc}">`)
                    .replace(/<meta property="og:image" content=".*?"\s*\/?>/gi, `<meta property="og:image" content="${coverUrl}">`)
                    .replace(/<meta property="og:image:secure_url" content=".*?"\s*\/?>/gi, `<meta property="og:image:secure_url" content="${coverUrl}">`)
                    .replace(/<meta property="og:url" content=".*?"\s*\/?>/gi, `<meta property="og:url" content="${req.protocol}://${req.get('host')}${req.originalUrl}">`)
                    .replace(/<meta name="twitter:title" content=".*?"\s*\/?>/gi, `<meta name="twitter:title" content="${playTitle}">`)
                    .replace(/<meta name="twitter:description" content=".*?"\s*\/?>/gi, `<meta name="twitter:description" content="${playDesc}">`)
                    .replace(/<meta name="twitter:image" content=".*?"\s*\/?>/gi, `<meta name="twitter:image" content="${coverUrl}">`)
                    .replace(/<meta name="twitter:image:src" content=".*?"\s*\/?>/gi, `<meta name="twitter:image:src" content="${coverUrl}">`)
                    .replace(/<link rel="icon".*?>/gi, `<link rel="icon" type="image/jpeg" href="${coverUrl}">`)
                    .replace(/<link rel="apple-touch-icon".*?>/gi, `<link rel="apple-touch-icon" href="${coverUrl}">`);

                res.setHeader('Content-Type', 'text/html');
                return res.send(updatedHtml);
            });
        }
    }

    if (req.path.startsWith('/artist/')) {
        const artistId = req.path.split('/artist/')[1];
        if (artistId) {
            const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
            const qName = reqUrl.searchParams.get('name') || reqUrl.searchParams.get('title');
            const qCover = reqUrl.searchParams.get('cover') || reqUrl.searchParams.get('thumb');

            const pageTitle = qName ? `${qName} (Artist) - HC MUSIFY` : `Artist - HC MUSIFY`;
            const pageDesc = qName ? `Dengarkan lagu & album terbaik dari ${qName} di HC MUSIFY` : `Dengarkan lagu & album dari artist favoritmu di HC MUSIFY`;
            const coverUrl = qCover || `https://www.gobox.my.id/file/R0ym4wqfznmp.png`;

            return fs.readFile(filePath, 'utf8', (err, html) => {
                if (err) return res.sendFile(filePath);
                
                let updatedHtml = html
                    .replace(/<title>.*?<\/title>/gi, `<title>${pageTitle}</title>`)
                    .replace(/<meta property="og:title" content=".*?"\s*\/?>/gi, `<meta property="og:title" content="${pageTitle}">`)
                    .replace(/<meta property="og:description" content=".*?"\s*\/?>/gi, `<meta property="og:description" content="${pageDesc}">`)
                    .replace(/<meta property="og:image" content=".*?"\s*\/?>/gi, `<meta property="og:image" content="${coverUrl}">`)
                    .replace(/<meta property="og:image:secure_url" content=".*?"\s*\/?>/gi, `<meta property="og:image:secure_url" content="${coverUrl}">`)
                    .replace(/<meta property="og:url" content=".*?"\s*\/?>/gi, `<meta property="og:url" content="${req.protocol}://${req.get('host')}${req.originalUrl}">`)
                    .replace(/<meta name="twitter:title" content=".*?"\s*\/?>/gi, `<meta name="twitter:title" content="${pageTitle}">`)
                    .replace(/<meta name="twitter:description" content=".*?"\s*\/?>/gi, `<meta name="twitter:description" content="${pageDesc}">`)
                    .replace(/<meta name="twitter:image" content=".*?"\s*\/?>/gi, `<meta name="twitter:image" content="${coverUrl}">`)
                    .replace(/<meta name="twitter:image:src" content=".*?"\s*\/?>/gi, `<meta name="twitter:image:src" content="${coverUrl}">`)
                    .replace(/<link rel="icon".*?>/gi, `<link rel="icon" type="image/jpeg" href="${coverUrl}">`)
                    .replace(/<link rel="apple-touch-icon".*?>/gi, `<link rel="apple-touch-icon" href="${coverUrl}">`);

                res.setHeader('Content-Type', 'text/html');
                return res.send(updatedHtml);
            });
        }
    }

    if (req.path.startsWith('/album/')) {
        const albumId = req.path.split('/album/')[1];
        if (albumId) {
            const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
            const qTitle = reqUrl.searchParams.get('title');
            const qArtist = reqUrl.searchParams.get('artist');
            const qCover = reqUrl.searchParams.get('cover') || reqUrl.searchParams.get('thumb');

            const pageTitle = qTitle ? (qArtist ? `${qTitle} - ${qArtist} (Album) - HC MUSIFY` : `${qTitle} (Album) - HC MUSIFY`) : `Album - HC MUSIFY`;
            const pageDesc = qTitle ? `Dengarkan album ${qTitle} di HC MUSIFY` : `Dengarkan album favoritmu di HC MUSIFY`;
            const coverUrl = qCover || `https://www.gobox.my.id/file/R0ym4wqfznmp.png`;

            return fs.readFile(filePath, 'utf8', (err, html) => {
                if (err) return res.sendFile(filePath);
                
                let updatedHtml = html
                    .replace(/<title>.*?<\/title>/gi, `<title>${pageTitle}</title>`)
                    .replace(/<meta property="og:title" content=".*?"\s*\/?>/gi, `<meta property="og:title" content="${pageTitle}">`)
                    .replace(/<meta property="og:description" content=".*?"\s*\/?>/gi, `<meta property="og:description" content="${pageDesc}">`)
                    .replace(/<meta property="og:image" content=".*?"\s*\/?>/gi, `<meta property="og:image" content="${coverUrl}">`)
                    .replace(/<meta property="og:image:secure_url" content=".*?"\s*\/?>/gi, `<meta property="og:image:secure_url" content="${coverUrl}">`)
                    .replace(/<meta property="og:url" content=".*?"\s*\/?>/gi, `<meta property="og:url" content="${req.protocol}://${req.get('host')}${req.originalUrl}">`)
                    .replace(/<meta name="twitter:title" content=".*?"\s*\/?>/gi, `<meta name="twitter:title" content="${pageTitle}">`)
                    .replace(/<meta name="twitter:description" content=".*?"\s*\/?>/gi, `<meta name="twitter:description" content="${pageDesc}">`)
                    .replace(/<meta name="twitter:image" content=".*?"\s*\/?>/gi, `<meta name="twitter:image" content="${coverUrl}">`)
                    .replace(/<meta name="twitter:image:src" content=".*?"\s*\/?>/gi, `<meta name="twitter:image:src" content="${coverUrl}">`)
                    .replace(/<link rel="icon".*?>/gi, `<link rel="icon" type="image/jpeg" href="${coverUrl}">`)
                    .replace(/<link rel="apple-touch-icon".*?>/gi, `<link rel="apple-touch-icon" href="${coverUrl}">`);

                res.setHeader('Content-Type', 'text/html');
                return res.send(updatedHtml);
            });
        }
    }

    // Default HTML response (uses /logo.png as favicon for home)
    fs.readFile(filePath, 'utf8', (err, html) => {
        if (err) return res.sendFile(filePath);
        res.setHeader('Content-Type', 'text/html');
        return res.send(html);
    });
});

const port = 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
