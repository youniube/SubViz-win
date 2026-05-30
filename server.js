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


function subvizDebugEnabled() {
  const v = String(process.env.SUBVIZ_DEBUG || '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function logConsoleDiag(scope, message, data) {
  const line = '[subviz:' + scope + '] ' + message;
  if (data !== undefined && data !== null) console.log(line, data);
  else console.log(line);
}

function parsedNodeCount(text) {
  try {
    const r = parser.parseSubscription(text || '');
    return r && r.summary && Number(r.summary.total) || (r && r.nodes && r.nodes.length) || 0;
  } catch (_) {
    return 0;
  }
}

function summarizeReasonMap(map, limit = 5) {
  const entries = Object.keys(map || {}).sort((a, b) => (map[b] || 0) - (map[a] || 0)).slice(0, limit);
  return entries.map(k => k + ' ' + (map[k] || 0) + ' 个').join('，');
}

function summarizeSamples(items, limit = 5) {
  return (items || []).slice(0, limit).map(item => {
    if (typeof item === 'string') return item;
    return clean(item && (item.displayName || item.name || item.rawName || item.server)) || JSON.stringify(item).slice(0, 80);
  }).filter(Boolean).join('；');
}

function logFetchDiagnostics(diag) {
  if (!diag) return;
  const status = diag.status || 0;
  const ct = diag.contentType || 'unknown';
  if (status >= 400) {
    logConsoleDiag('fetch', '订阅拉取失败：HTTP ' + status + '，可能需要更换客户端 UA');
  } else if (diag.looksLikeHtml) {
    logConsoleDiag('fetch', '订阅内容疑似 HTML 页面，可能被机场拦截或需要指定代理软件 UA');
  } else {
    logConsoleDiag('fetch', '订阅拉取成功：HTTP ' + status + '，客户端 ' + (diag.client || 'unknown') + '，' + (diag.bytes || 0) + ' bytes，Content-Type ' + ct);
  }
  if (subvizDebugEnabled() && diag.bodyPreview) {
    logConsoleDiag('fetch', '响应预览：' + String(diag.bodyPreview).replace(/\s+/g, ' ').slice(0, 240));
  }
}

function logMihomoDiagnostics(result) {
  const summaryTotal = result && result.summary && Number(result.summary.total) || (result && result.nodes && result.nodes.length) || 0;
  const mihomoResult = result && result.mihomo;
  const m = result && (result.mihomoDiagnostics || (mihomoResult && mihomoResult.diagnostics));
  if (m) {
    logConsoleDiag('mihomo', '订阅已加载：解析节点 ' + (m.parsedCount || summaryTotal) + '，写入配置 ' + (m.writtenCount || 0) + '，API 可见 ' + (m.mihomoNodeCount || 0) + '，可测匹配 ' + (m.testableCount || 0) + '，未匹配 ' + (m.missingCount || 0) + '，转换跳过 ' + (m.conversionSkippedCount || 0));
    const parts = [];
    if (m.conversionSkippedCount) parts.push('节点转换跳过：' + (summarizeReasonMap(m.conversionSkippedReasons) || (m.conversionSkippedCount + ' 个')));
    if (m.missingCount) parts.push('节点名称未匹配：' + m.missingCount + ' 个');
    if (parts.length) logConsoleDiag('mihomo', parts.join('；'));
    if (subvizDebugEnabled()) {
      const skipped = summarizeSamples(m.conversionSkippedSample);
      const missing = summarizeSamples(m.missingSample);
      if (skipped) logConsoleDiag('mihomo', '转换跳过样例：' + skipped);
      if (missing) logConsoleDiag('mihomo', '未匹配样例：' + missing);
    }
    return;
  }
  if (mihomoResult && mihomoResult.ok === false) {
    logConsoleDiag('mihomo', '订阅加载失败：' + (mihomoResult.error || 'mihomo not ready'));
  } else if (mihomoResult && mihomoResult.ok) {
    logConsoleDiag('mihomo', '订阅已加载：解析节点 ' + summaryTotal + '，写入配置 ' + (mihomoResult.writtenCount || mihomoResult.count || 0));
  }
}

function logAnalysisDiagnostics(result, meta) {
  if (meta && meta.fetchDiagnostics && !meta.skipFetchLog) logFetchDiagnostics(meta.fetchDiagnostics);
  logMihomoDiagnostics(result);
}

async function parseAndInject(text, sourceUrl, mihomo, meta = {}) {
  const result = meta.parsedResult || parser.parseSubscription(text || '');
  result.ok = true;
  if (sourceUrl) result.sourceUrl = sourceUrl;
  if (meta.fetchDiagnostics) {
    result.fetchDiagnostics = Object.assign({}, meta.fetchDiagnostics, {
      parsedNodeCount: result.summary && result.summary.total || (result.nodes || []).length || 0,
    });
    meta.fetchDiagnostics = result.fetchDiagnostics;
  }
  if (!result.summary || !result.summary.total) {
    result.warning = meta.fetchDiagnostics && meta.fetchDiagnostics.looksLikeHtml
      ? 'subscription fetch returned HTML/error page; try another subscription client User-Agent'
      : 'subscription parsed, but no proxy nodes were found';
  }
  const summary = result.summary || {};
  const rawTotal = Number(summary.total || ((result.nodes || []).length) || 0);
  const uniqueTotal = Number(summary.unique || rawTotal);
  const duplicateTotal = Number(summary.duplicates || Math.max(0, rawTotal - uniqueTotal));
  logConsoleDiag('analyze', '节点统计：原始 ' + rawTotal + '，唯一 ' + uniqueTotal + '，重复 ' + duplicateTotal + '，当前显示 ' + uniqueTotal);
  if (mihomo && result.nodes && result.nodes.length) {
    result.mihomo = await mihomo.injectNodes(result.nodes).catch(e => ({ ok: false, error: String(e && e.message || e) }));
    if (result.mihomo && result.mihomo.diagnostics) result.mihomoDiagnostics = result.mihomo.diagnostics;
  }
  logAnalysisDiagnostics(result, meta);
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

const SUBSCRIPTION_CLIENT_LABELS = {
  mihomo: 'Mihomo',
  'clash-meta': 'Clash.Meta',
  clash: 'Clash',
  'sing-box': 'sing-box',
  surge: 'Surge',
  loon: 'Loon',
  stash: 'Stash',
  shadowrocket: 'Shadowrocket',
  'quantumult-x': 'Quantumult X',
  subviz: 'SubViz',
  custom: '自定义 UA',
};

function normalizeClientName(v) {
  v = clean(v).toLowerCase();
  if (v === 'clashmeta' || v === 'clash.meta') return 'clash-meta';
  if (v === 'singbox') return 'sing-box';
  if (v === 'quanx' || v === 'quantumultx') return 'quantumult-x';
  return v || 'mihomo';
}

function clientDisplayName(v) {
  v = normalizeClientName(v);
  return SUBSCRIPTION_CLIENT_LABELS[v] || v || 'Mihomo';
}

function subscriptionUserAgent(client, customUA) {
  client = normalizeClientName(client);
  if (client === 'custom' && clean(customUA)) return clean(customUA);
  return SUBSCRIPTION_CLIENTS[client] || SUBSCRIPTION_CLIENTS.mihomo;
}

function contentTypeLooksLikeHtml(headers) {
  const ct = String((headers && (headers['content-type'] || headers['Content-Type'])) || '').toLowerCase();
  return ct.includes('text/html');
}

function htmlSample(text, limit = 1000) {
  return String(text || '').replace(/^\uFEFF/, '').trim().slice(0, limit);
}

function bodyLooksLikeHtml(text) {
  const sample = htmlSample(text, 1000).toLowerCase();
  if (!sample) return false;
  return sample.startsWith('<!doctype html')
    || sample.startsWith('<html')
    || /^<(?:head|body|title|script|style|meta|div|main|section|form|center)(?:\s|>|\/)/i.test(sample)
    || /<html[\s>]/i.test(sample.slice(0, 500));
}

function bodyLooksLikeErrorPage(text) {
  const sample = htmlSample(text, 1000);
  const lower = sample.toLowerCase();
  if (!lower) return false;
  if (bodyLooksLikeHtml(sample)) return true;
  if (/^\s*\{[\s\S]{0,300}"(?:error|message|msg|detail)"\s*:/i.test(sample)
      && /(?:login|sign in|登录|登陆|forbidden|unauthorized|not found|access denied|invalid token|token)/i.test(sample)) return true;
  return /^(?:error|forbidden|unauthorized|not found|access denied|invalid token|token expired|请登录|登录后|登陆后|未授权|无权限)(?:\b|[:：\s])/i.test(lower);
}

function looksLikeHtml(text, headers) {
  return bodyLooksLikeHtml(text);
}

function looksLikeErrorPage(text, headers) {
  return bodyLooksLikeErrorPage(text);
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
    clientName: clientDisplayName(client),
    looksLikeHtml: looksLikeHtml(body, headers),
    contentTypeLooksLikeHtml: contentTypeLooksLikeHtml(headers),
    looksLikeErrorPage: looksLikeErrorPage(body, headers),
    bodyPreview: String(body || '').slice(0, 240),
  };
}

function parsedCountFromResult(result) {
  return result && result.summary && Number(result.summary.total) || (result && result.nodes && result.nodes.length) || 0;
}

async function tryFetchCandidate(sourceUrl, client, customUA) {
  client = normalizeClientName(client);
  const ua = subscriptionUserAgent(client, customUA);
  const label = clientDisplayName(client);
  const out = { ok:false, client, clientName:label, userAgent:ua, status:0, statusText:'', contentType:'', bytes:0, looksLikeHtml:false, looksLikeErrorPage:false, parsedNodeCount:0, text:'', parsedResult:null, fetched:null, diagnostics:null, error:'' };
  try {
    const fetched = await fetchText(sourceUrl, { timeout: 30000, headers: { 'User-Agent': ua, 'Accept': '*/*', 'Cache-Control': 'no-cache' } });
    const diag = fetchDiagnostics(sourceUrl, fetched, client, ua);
    Object.assign(out, { fetched, diagnostics: diag, status: diag.status, statusText: diag.statusText, contentType: diag.contentType, bytes: diag.bytes, looksLikeHtml: diag.looksLikeHtml, looksLikeErrorPage: diag.looksLikeErrorPage, text: fetched && fetched.body || '' });
    if (out.status >= 400) { out.error = 'HTTP ' + out.status; return out; }
    if (out.looksLikeHtml) { out.error = '内容疑似 HTML 页面'; return out; }
    if (out.looksLikeErrorPage) { out.error = '内容疑似错误页'; return out; }
    try {
      out.parsedResult = parser.parseSubscription(out.text || '');
      out.parsedNodeCount = parsedCountFromResult(out.parsedResult);
      diag.parsedNodeCount = out.parsedNodeCount;
      out.ok = out.parsedNodeCount > 0;
      if (!out.ok) {
        if (diag.contentTypeLooksLikeHtml) { out.looksLikeHtml = true; diag.looksLikeHtml = true; out.error = '内容疑似 HTML 页面'; }
        else out.error = '解析节点 0';
      }
      return out;
    } catch (e) {
      out.error = String(e && e.message || e);
      diag.parseError = out.error;
      return out;
    }
  } catch (e) {
    out.error = String(e && e.message || e);
    out.diagnostics = { url: sourceUrl, status: 0, statusText: '', contentType: '', bytes: 0, userAgent: ua, client, clientName: label, looksLikeHtml: false, looksLikeErrorPage: false, parsedNodeCount: 0, error: out.error };
    return out;
  }
}

function logCandidateFailure(result) {
  if (!result) return;
  const name = result.clientName || clientDisplayName(result.client);
  if (result.status >= 400) return logConsoleDiag('fetch', 'UA ' + name + ' 失败：HTTP ' + result.status + '，可能需要更换客户端 UA');
  if (result.looksLikeHtml || result.looksLikeErrorPage) return logConsoleDiag('fetch', 'UA ' + name + ' 失败：内容疑似 HTML 页面');
  if (result.error && result.diagnostics && result.diagnostics.parseError) return logConsoleDiag('fetch', 'UA ' + name + ' 解析异常：' + result.error);
  if (result.error) return logConsoleDiag('fetch', 'UA ' + name + ' 失败：' + result.error);
  logConsoleDiag('fetch', 'UA ' + name + ' 失败：解析节点 ' + (result.parsedNodeCount || 0));
}

function makeFetchFailureResponse(fetchedResult, sourceUrl) {
  const selected = fetchedResult && (fetchedResult.selected || fetchedResult.last);
  const diag = selected && selected.diagnostics || null;
  return { ok: false, error: 'subscription fetch failed', sourceUrl, fetchDiagnostics: diag, candidates: fetchedResult && fetchedResult.candidateResults ? fetchedResult.candidateResults.map(r => ({ client:r.client, clientName:r.clientName, status:r.status, contentType:r.contentType, bytes:r.bytes, looksLikeHtml:r.looksLikeHtml, contentTypeLooksLikeHtml:r.diagnostics && r.diagnostics.contentTypeLooksLikeHtml, looksLikeErrorPage:r.looksLikeErrorPage, parsedNodeCount:r.parsedNodeCount, error:r.error })) : [] };
}

async function fetchSubscription(sourceUrl, client, customUA) {
  client = normalizeClientName(client);
  const autoMode = client === 'auto';
  const tryClients = autoMode ? ['mihomo', 'clash-meta', 'clash', 'sing-box', 'surge', 'loon', 'stash', 'shadowrocket', 'quantumult-x', 'subviz'] : [client];
  const candidateResults = [];
  let selected = null;
  let last = null;
  for (const c of tryClients) {
    const result = await tryFetchCandidate(sourceUrl, c, customUA);
    candidateResults.push(result);
    last = result;
    if (result.ok && result.parsedNodeCount > 0) {
      selected = result;
      if (autoMode) logConsoleDiag('fetch', '自动 UA 命中：' + result.clientName + '，HTTP ' + result.status + '，解析节点 ' + result.parsedNodeCount + '，停止重试');
      break;
    }
    if (autoMode) logCandidateFailure(result);
  }
  return { ok: !!selected, autoMode, selected, last, candidateResults, error: selected ? '' : 'no candidate parsed proxy nodes' };
}

async function analyzeFetchedSubscription(fetchedResult, sourceUrl, mihomo) {
  if (!fetchedResult || !fetchedResult.ok || !fetchedResult.selected) {
    if (fetchedResult && !fetchedResult.autoMode) logCandidateFailure(fetchedResult.last);
    return { status: 502, body: makeFetchFailureResponse(fetchedResult, sourceUrl) };
  }
  const selected = fetchedResult.selected;
  const diag = selected.diagnostics || fetchDiagnostics(sourceUrl, selected.fetched, selected.client, selected.userAgent);
  diag.parsedNodeCount = selected.parsedNodeCount;
  const body = await parseAndInject(selected.text || '', sourceUrl, mihomo, { fetchDiagnostics: diag, parsedResult: selected.parsedResult, skipFetchLog: !!fetchedResult.autoMode });
  if (fetchedResult.autoMode) { body.selectedFetchClient = selected.client; body.selectedFetchClientName = selected.clientName; body.autoUserAgent = true; }
  return { status: 200, body };
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
      const analyzed = await analyzeFetchedSubscription(fetchedResult, sourceUrl, mihomo);
      return sendJSON(res, analyzed.body, analyzed.status);
    } catch (e) {
      logConsoleDiag('fetch', '订阅拉取失败：' + String(e && e.message || e));
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
      const analyzed = await analyzeFetchedSubscription(fetchedResult, sourceUrl, mihomo);
      return sendJSON(res, analyzed.body, analyzed.status);
    } catch (e) {
      logConsoleDiag('fetch', '订阅拉取失败：' + String(e && e.message || e));
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
    const abortController = new AbortController();
    req.on('aborted', () => abortController.abort());
    req.on('close', () => { if (!res.writableEnded && req.destroyed) abortController.abort(); });
    res.on('close', () => { if (!res.writableEnded) abortController.abort(); });
    try {
      const body = parseJSONBody(await readBody(req, 1024 * 1024));
      if (abortController.signal.aborted) return;
      const r = await availability.availabilityCheck(body, {
        mihomoManager: mihomo,
        url: url.searchParams.get('url') || body.url,
        statusExpr: url.searchParams.get('status') || body.status || body.statusExpr,
        timeout: parseInteger(url.searchParams.get('timeout') || body.timeout, 3000, 200, 30000),
        retries: parseInteger(url.searchParams.get('retries') || body.retries, 1, 0, 3),
        retryDelay: parseInteger(url.searchParams.get('retry_delay') || body.retryDelay, 1000, 0, 5000),
        signal: abortController.signal,
      });
      if (abortController.signal.aborted || (r && r.cancelled)) return sendJSON(res, r || { ok: false, cancelled: true }, 499);
      const statusCode = (r.ok || r.shouldCountAsDead === false) ? 200 : 502;
      return sendJSON(res, r, statusCode);
    } catch (e) {
      if (abortController.signal.aborted) return sendJSON(res, { ok: false, cancelled: true, alive: false, category: 'cancelled', shouldCountAsDead: false, error: '测活已取消' }, 499);
      return sendJSON(res, { ok: false, alive: false, category: 'api_error', shouldCountAsDead: true, error: String(e && e.message || e), statusCode: e.statusCode || e.status || 0 }, e.statusCode || 500);
    }
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

module.exports = { createSubVizServer, parseAndInject, fetchSubscription, tryFetchCandidate, analyzeFetchedSubscription, VERSION };
