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
const { clean, fetchText, parseInteger, DEFAULT_USER_AGENT, PACKAGE_VERSION } = require('./lib/utils');

const VERSION = PACKAGE_VERSION;
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
    let body = data;
    if (path.basename(file) === 'index.html') {
      body = data.toString('utf8').replace(/\{\{__VERSION__\}\}/g, VERSION);
    }
    send(res, 200, body, { 'Content-Type': mime(file) });
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

async function parseAndInject(text, sourceUrl, mihomo, meta = {}) {
  const result = parser.parseSubscription(text || '');
  result.ok = true;
  if (sourceUrl) result.sourceUrl = sourceUrl;
  if (meta.fetchDiagnostics) {
    result.fetchDiagnostics = Object.assign({}, meta.fetchDiagnostics, {
      parsedNodeCount: result.summary && result.summary.total || (result.nodes || []).length || 0,
    });
  }
  if (!result.summary || !result.summary.total) {
    result.warning = meta.fetchDiagnostics && meta.fetchDiagnostics.looksLikeHtml
      ? 'subscription fetch returned HTML/error page; try another subscription client User-Agent'
      : 'subscription parsed, but no proxy nodes were found';
  }
  if (mihomo && result.nodes && result.nodes.length) {
    result.mihomo = await mihomo.injectNodes(result.nodes).catch(e => ({ ok: false, error: String(e && e.message || e) }));
    if (result.mihomo && result.mihomo.diagnostics) result.mihomoDiagnostics = result.mihomo.diagnostics;
  }
  return result;
}

const SUBSCRIPTION_CLIENTS = {
  mihomo: 'Mihomo/1.19.0',
  'clash-meta': 'Clash.Meta/1.19.0',
  clash: 'Clash/1.18.0',
  'sing-box': 'sing-box/1.10.0',
  surge: 'Surge/5.0',
  loon: 'Loon/3.0',
  stash: 'Stash/2.0',
  shadowrocket: 'Shadowrocket/2.2.0',
  'quantumult-x': 'Quantumult%20X/1.0.30',
  subviz: DEFAULT_USER_AGENT,
};

function normalizeClientName(v) {
  v = clean(v).toLowerCase();
  if (v === 'clashmeta' || v === 'clash.meta') return 'clash-meta';
  if (v === 'singbox') return 'sing-box';
  if (v === 'quanx' || v === 'quantumultx') return 'quantumult-x';
  return v || 'mihomo';
}

function subscriptionUserAgent(client, customUA) {
  client = normalizeClientName(client);
  if (client === 'custom' && clean(customUA)) return clean(customUA);
  return SUBSCRIPTION_CLIENTS[client] || SUBSCRIPTION_CLIENTS.mihomo;
}

function looksLikeHtml(text, headers) {
  const ct = String((headers && (headers['content-type'] || headers['Content-Type'])) || '').toLowerCase();
  const sample = String(text || '').trim().slice(0, 500).toLowerCase();
  return ct.includes('text/html') || sample.startsWith('<!doctype html') || sample.startsWith('<html') || /<html[\s>]/i.test(sample);
}

function fetchDiagnostics(sourceUrl, fetched, client, ua) {
  const body = fetched && fetched.body || '';
  const headers = fetched && fetched.headers || {};
  return {
    url: sourceUrl,
    status: fetched && fetched.status || 0,
    statusText: fetched && fetched.statusText || '',
    contentType: headers['content-type'] || headers['Content-Type'] || '',
    bytes: Buffer.byteLength(body, 'utf8'),
    userAgent: ua,
    client,
    looksLikeHtml: looksLikeHtml(body, headers),
    bodyPreview: String(body || '').slice(0, 240),
  };
}

async function fetchSubscription(sourceUrl, client, customUA) {
  client = normalizeClientName(client);
  const tryClients = client === 'auto'
    ? ['mihomo', 'clash-meta', 'clash', 'sing-box', 'surge', 'loon', 'stash', 'shadowrocket', 'subviz']
    : [client];
  let last = null;
  for (const c of tryClients) {
    const ua = subscriptionUserAgent(c, customUA);
    const fetched = await fetchText(sourceUrl, {
      timeout: 30000,
      headers: {
        'User-Agent': ua,
        'Accept': '*/*',
        'Cache-Control': 'no-cache',
      },
    });
    const diag = fetchDiagnostics(sourceUrl, fetched, c, ua);
    last = { fetched, diagnostics: diag };
    if (fetched.status >= 400) continue;
    if (!diag.looksLikeHtml) return last;
  }
  return last;
}

async function routeAPI(req, res, ctx, url) {
  const { mihomo } = ctx;
  const p = url.pathname;
  if (req.method === 'GET' && p === '/api/health') {
    const ready = await mihomo.isReady();
    let inventory = null;
    if (ready) {
      inventory = await mihomo.getProxyInventory(1000).catch(() => null);
    }
    return sendJSON(res, {
      ok: true,
      name: 'SubViz',
      version: VERSION,
      host: DEFAULT_HOST,
      port: DEFAULT_PORT,
      mihomo: {
        ready,
        error: ready ? '' : (mihomo.lastError || ''),
        controller: mihomo.controllerBaseURL ? mihomo.controllerBaseURL() : ('http://' + (mihomo.host || '127.0.0.1') + ':' + (mihomo.apiPort || 19090)),
        ports: { mixed: mihomo.mixedPort, socks: mihomo.socksPort, http: mihomo.httpPort, api: mihomo.apiPort },
        proxies: inventory ? { total: inventory.total, nodeCount: inventory.nodeCount } : null,
      },
    });
  }

  if (req.method === 'GET' && p === '/api/mihomo-debug') {
    const debug = mihomo.describeController ? await mihomo.describeController().catch(e => ({ ok: false, error: String(e && e.message || e) })) : { ok: false, error: 'mihomo debug is not available for this manager' };
    return sendJSON(res, debug, debug.ok === false ? 502 : 200);
  }

  if (req.method === 'GET' && p === '/api/sample') {
    const sampleFile = path.join(DATA_DIR, 'sample.yaml');
    const text = fs.existsSync(sampleFile) ? fs.readFileSync(sampleFile, 'utf8') : '';
    return sendJSON(res, await parseAndInject(text, '', mihomo));
  }

  if (req.method === 'GET' && p === '/api/analyze') {
    const sourceUrl = clean(url.searchParams.get('url'));
    const client = normalizeClientName(url.searchParams.get('client') || 'mihomo');
    const customUA = clean(url.searchParams.get('ua') || url.searchParams.get('userAgent'));
    if (!sourceUrl) return sendJSON(res, { ok: false, error: 'missing url' }, 400);
    try {
      const fetchedResult = await fetchSubscription(sourceUrl, client, customUA);
      const fetched = fetchedResult && fetchedResult.fetched || { status: 0, body: '', headers: {} };
      const diag = fetchedResult && fetchedResult.diagnostics || fetchDiagnostics(sourceUrl, fetched, client, subscriptionUserAgent(client, customUA));
      if (fetched.status >= 400) {
        return sendJSON(res, { ok: false, error: 'remote subscription HTTP ' + fetched.status, status: fetched.status, sourceUrl, fetchDiagnostics: diag, bodyPreview: String(fetched.body || '').slice(0, 240) }, 502);
      }
      return sendJSON(res, await parseAndInject(fetched.body || '', sourceUrl, mihomo, { fetchDiagnostics: diag }));
    } catch (e) {
      return sendJSON(res, { ok: false, error: String(e && e.message || e), sourceUrl }, 502);
    }
  }

  if (req.method === 'POST' && p === '/api/analyze-url') {
    try {
      const body = parseJSONBody(await readBody(req, 1024 * 1024));
      const sourceUrl = clean(body.url);
      const client = normalizeClientName(body.client || 'mihomo');
      const customUA = clean(body.userAgent || body.ua);
      if (!sourceUrl) return sendJSON(res, { ok: false, error: 'missing url' }, 400);
      const fetchedResult = await fetchSubscription(sourceUrl, client, customUA);
      const fetched = fetchedResult && fetchedResult.fetched || { status: 0, body: '', headers: {} };
      const diag = fetchedResult && fetchedResult.diagnostics || fetchDiagnostics(sourceUrl, fetched, client, subscriptionUserAgent(client, customUA));
      if (fetched.status >= 400) return sendJSON(res, { ok: false, error: 'remote subscription HTTP ' + fetched.status, status: fetched.status, sourceUrl, fetchDiagnostics: diag }, 502);
      return sendJSON(res, await parseAndInject(fetched.body || '', sourceUrl, mihomo, { fetchDiagnostics: diag }));
    } catch (e) {
      return sendJSON(res, { ok: false, error: String(e && e.message || e) }, e.statusCode || 502);
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
      const statusCode = (r.ok || r.shouldCountAsDead === false) ? 200 : 502;
      return sendJSON(res, r, statusCode);
    } catch (e) { return sendJSON(res, { ok: false, alive: false, category: 'api_error', shouldCountAsDead: true, error: String(e && e.message || e), statusCode: e.statusCode || e.status || 0 }, e.statusCode || 500); }
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
