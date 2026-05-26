'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const parser = require('./lib/parser');
const geo = require('./lib/geo');
const gist = require('./lib/gist');
const { MihomoManager } = require('./lib/mihomo-manager');
const landing = require('./lib/landing');
const availability = require('./lib/availability');
const { clean, fetchText, parseInteger } = require('./lib/utils');

const VERSION = '0.2.0-node';
const DEFAULT_HOST = process.env.SUBVIZ_HOST || '127.0.0.1';
const DEFAULT_PORT = Number(process.env.SUBVIZ_PORT || 3456);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');

function mime(file) {
  const ext = path.extname(file).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
  }[ext] || 'application/octet-stream';
}

function corsHeaders(extra = {}) {
  return Object.assign({
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }, extra);
}

function send(res, status, body, headers = {}) {
  res.writeHead(status || 200, corsHeaders(headers));
  res.end(body || '');
}

function sendJSON(res, obj, status = 200) {
  send(res, status, JSON.stringify(obj, null, 2), { 'Content-Type': 'application/json; charset=utf-8' });
}

function sendFile(res, file) {
  fs.readFile(file, (err, data) => {
    if (err) return sendJSON(res, { ok: false, error: 'not found' }, 404);
    send(res, 200, data, { 'Content-Type': mime(file) });
  });
}

function safePublicPath(urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0] || '/');
  if (rel === '/') rel = '/index.html';
  if (rel === '/app.js') rel = '/app.js';
  const full = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!full.startsWith(PUBLIC_DIR)) return null;
  return full;
}

function readBody(req, limit = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > limit) {
        reject(new Error('request body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function parseJSONBody(text) {
  try { return text ? JSON.parse(text) : {}; }
  catch (e) { const err = new Error('请求体不是有效 JSON：' + String(e.message || e)); err.statusCode = 400; throw err; }
}

async function parseAndInject(text, sourceUrl, mihomo) {
  const result = parser.parseSubscription(text || '');
  result.ok = true;
  if (sourceUrl) result.sourceUrl = sourceUrl;
  if (!result.summary || !result.summary.total) result.warning = 'subscription parsed, but no proxy nodes were found';
  if (mihomo && result.nodes && result.nodes.length) {
    result.mihomo = await mihomo.injectNodes(result.nodes).catch(e => ({ ok: false, error: String(e && e.message || e) }));
  }
  return result;
}

async function routeAPI(req, res, ctx, url) {
  const { mihomo } = ctx;
  const p = url.pathname;
  if (req.method === 'GET' && p === '/api/health') {
    const ready = await mihomo.isReady();
    return sendJSON(res, {
      ok: true,
      name: 'SubViz',
      version: VERSION,
      host: DEFAULT_HOST,
      port: DEFAULT_PORT,
      mihomo: {
        ready,
        error: ready ? '' : (mihomo.lastError || ''),
        ports: { mixed: mihomo.mixedPort, socks: mihomo.socksPort, http: mihomo.httpPort, api: mihomo.apiPort },
      },
    });
  }

  if (req.method === 'GET' && p === '/api/sample') {
    const sampleFile = path.join(DATA_DIR, 'sample.yaml');
    const text = fs.existsSync(sampleFile) ? fs.readFileSync(sampleFile, 'utf8') : '';
    return sendJSON(res, await parseAndInject(text, '', mihomo));
  }

  if (req.method === 'GET' && p === '/api/analyze') {
    const sourceUrl = clean(url.searchParams.get('url'));
    if (!sourceUrl) return sendJSON(res, { ok: false, error: 'missing url' }, 400);
    try {
      const fetched = await fetchText(sourceUrl, { timeout: 30000, headers: { 'User-Agent': 'SubViz/0.2.0-node' } });
      if (fetched.status >= 400) {
        return sendJSON(res, { ok: false, error: 'remote subscription HTTP ' + fetched.status, status: fetched.status, sourceUrl, bodyPreview: String(fetched.body || '').slice(0, 240) }, 502);
      }
      return sendJSON(res, await parseAndInject(fetched.body || '', sourceUrl, mihomo));
    } catch (e) {
      return sendJSON(res, { ok: false, error: String(e && e.message || e), sourceUrl }, 502);
    }
  }

  if (req.method === 'POST' && p === '/api/analyze-text') {
    try {
      const body = await readBody(req);
      return sendJSON(res, await parseAndInject(body || '', '', mihomo));
    } catch (e) { return sendJSON(res, { ok: false, error: String(e && e.message || e) }, e.statusCode || 500); }
  }

  if (req.method === 'GET' && p === '/api/geoip') {
    return sendJSON(res, await geo.geoLookup(url.searchParams.get('host')));
  }

  if (req.method === 'POST' && p === '/api/landing') {
    try {
      const body = parseJSONBody(await readBody(req, 1024 * 1024));
      const apis = url.searchParams.get('api') || body.api || body.apis;
      const r = await landing.landingLookup(body, {
        mihomoManager: mihomo,
        timeout: parseInteger(url.searchParams.get('timeout') || body.timeout, 5000, 200, 30000),
        retries: parseInteger(url.searchParams.get('retries') || body.retries, 1, 0, 3),
        retryDelay: parseInteger(url.searchParams.get('retry_delay') || body.retryDelay, 800, 0, 5000),
        api: apis,
        format: url.searchParams.get('format') || body.format || '',
        internal: url.searchParams.get('internal') || body.internal,
      });
      return sendJSON(res, r, r.ok ? 200 : 502);
    } catch (e) { return sendJSON(res, { ok: false, landing: false, error: String(e && e.message || e) }, e.statusCode || 500); }
  }

  if (req.method === 'POST' && p === '/api/availability') {
    try {
      const body = parseJSONBody(await readBody(req, 1024 * 1024));
      const r = await availability.availabilityCheck(body, {
        mihomoManager: mihomo,
        url: url.searchParams.get('url') || body.url,
        statusExpr: url.searchParams.get('status') || body.status || body.statusExpr,
        timeout: parseInteger(url.searchParams.get('timeout') || body.timeout, 3000, 200, 30000),
        retries: parseInteger(url.searchParams.get('retries') || body.retries, 1, 0, 3),
        retryDelay: parseInteger(url.searchParams.get('retry_delay') || body.retryDelay, 1000, 0, 5000),
      });
      return sendJSON(res, r, r.ok ? 200 : 502);
    } catch (e) { return sendJSON(res, { ok: false, alive: false, error: String(e && e.message || e) }, e.statusCode || 500); }
  }

  if (req.method === 'GET' && p === '/api/gist-token/status') {
    return sendJSON(res, await gist.gistTokenStatus());
  }

  if (req.method === 'POST' && p === '/api/gist-token/save') {
    const body = parseJSONBody(await readBody(req, 1024 * 1024));
    const r = await gist.gistTokenSave(body.token);
    return sendJSON(res, r, r.ok ? 200 : 400);
  }

  if (req.method === 'POST' && p === '/api/gist-token/delete') {
    return sendJSON(res, await gist.gistTokenDelete());
  }

  if (req.method === 'POST' && p === '/api/gist-token/test') {
    const body = parseJSONBody(await readBody(req, 1024 * 1024));
    const r = await gist.gistTokenTest(body.token);
    return sendJSON(res, r, r.ok ? 200 : 502);
  }

  if (req.method === 'POST' && p === '/api/gist-upload') {
    const body = parseJSONBody(await readBody(req, 10 * 1024 * 1024));
    const r = await gist.gistUpload(body);
    return sendJSON(res, r, r.ok ? 200 : 502);
  }

  return sendJSON(res, { ok: false, error: 'unknown api route' }, 404);
}

function createSubVizServer(options = {}) {
  const mihomo = options.mihomoManager || new MihomoManager(options.mihomo || {});
  const ctx = { mihomo };
  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'OPTIONS') return send(res, 204, '');
      const url = new URL(req.url, 'http://' + (req.headers.host || '127.0.0.1'));
      if (url.pathname.startsWith('/api/')) return routeAPI(req, res, ctx, url);
      const file = safePublicPath(url.pathname);
      if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return sendJSON(res, { ok: false, error: 'not found' }, 404);
      return sendFile(res, file);
    } catch (e) {
      return sendJSON(res, { ok: false, error: String(e && e.stack || e) }, e.statusCode || 500);
    }
  });
  server.subviz = ctx;
  return server;
}

async function main() {
  const mihomo = new MihomoManager();
  await mihomo.start();
  const server = createSubVizServer({ mihomoManager: mihomo });
  server.listen(DEFAULT_PORT, DEFAULT_HOST, () => {
    console.log('SubViz listening on http://' + DEFAULT_HOST + ':' + DEFAULT_PORT);
    if (!mihomo.ready) console.log('[mihomo] ' + (mihomo.lastError || 'not ready; analyze/export still available'));
  });
  const stop = async () => { await mihomo.stop(); server.close(() => process.exit(0)); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

if (require.main === module) {
  main().catch(err => {
    console.error(err && err.stack || err);
    process.exitCode = 1;
  });
}

module.exports = { createSubVizServer, parseAndInject, VERSION };
