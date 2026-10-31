// Wraps the existing Express-style handlers in api/*.js (which expect
// (req, res) with req.query/req.body and res.status().json()/send()/setHeader())
// so they can run unmodified as Netlify Functions.

function getCorsHeaders(headers = {}) {
    const origin = headers.origin || headers.referer;
    const host = headers['x-forwarded-host'] || headers.host;
    const corsHeaders = {
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Expose-Headers': '*'
    };

    if (origin && host) {
        try {
            const originUrl = new URL(origin);
            if (originUrl.host === host) {
                corsHeaders['Access-Control-Allow-Origin'] = originUrl.origin;
                corsHeaders['Vary'] = 'Origin';
            }
        } catch (e) {}
    } else if (host) {
        corsHeaders['Access-Control-Allow-Origin'] = `https://${host}`;
    }
    return corsHeaders;
}

function buildReqRes(event) {
    const headers = event.headers || {};
    const req = {
        method: event.httpMethod,
        query: event.queryStringParameters || {},
        body: event.body,
        headers: headers
    };

    const res = {
        statusCode: 200,
        _headers: getCorsHeaders(headers),
        _body: '',
        setHeader(key, value) { this._headers[key] = value; return this; },
        header(key, value) { this._headers[key] = value; return this; },
        status(code) { this.statusCode = code; return this; },
        json(obj) {
            this._headers['Content-Type'] = 'application/json';
            this._body = JSON.stringify(obj);
            return this;
        },
        send(data) {
            this._body = typeof data === 'string' ? data : JSON.stringify(data);
            return this;
        },
        sendStatus(code) {
            this.statusCode = code;
            return this;
        },
        end(data) {
            if (data !== undefined) this._body = data;
            return this;
        }
    };

    return { req, res };
}

// Rate limit in-memory sederhana per IP. Reset tiap cold start / beda instance
// Lambda, jadi bukan limit "keras" 100% akurat lintas instance — tapi cukup
// nahan bot yang nembak endpoint berkali-kali dalam waktu singkat.
const hits = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_HITS = 40;

function isRateLimited(headers) {
    const ip = (headers['x-nf-client-connection-ip'] || headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    const now = Date.now();
    const rec = hits.get(ip);
    if (!rec || now > rec.resetAt) {
        hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
        return false;
    }
    rec.count++;
    return rec.count > MAX_HITS;
}

function wrap(handler) {
    return async (event) => {
        const headers = event.headers || {};
        const origin = headers.origin || headers.referer;
        const host = headers['x-forwarded-host'] || headers.host;

        if (origin && host) {
            try {
                const originUrl = new URL(origin);
                if (originUrl.host !== host) {
                    return {
                        statusCode: 403,
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: false, message: 'Access denied: Cross-origin requests from external domains are disabled.' })
                    };
                }
            } catch (e) {}
        }

        if (event.httpMethod === 'OPTIONS') {
            return {
                statusCode: 200,
                headers: getCorsHeaders(headers),
                body: ''
            };
        }

        if (isRateLimited(headers)) {
            return {
                statusCode: 429,
                headers: { 'Content-Type': 'application/json', ...getCorsHeaders(headers) },
                body: JSON.stringify({ status: false, message: 'Terlalu banyak request, coba lagi sebentar' })
            };
        }

        const { req, res } = buildReqRes(event);
        try {
            await handler(req, res);
        } catch (err) {
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    ...getCorsHeaders(headers)
                },
                body: JSON.stringify({ status: false, message: 'Internal error: ' + err.message })
            };
        }
        return {
            statusCode: res.statusCode || 200,
            headers: res._headers,
            body: res._body || ''
        };
    };
}

module.exports = { wrap };
