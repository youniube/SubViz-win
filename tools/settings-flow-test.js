#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const clientCode = fs.readFileSync(path.join(ROOT, 'src', 'client', 'app.js'), 'utf8') + `
apply=function(){};
render=function(d){DATA=d;};
recalc=function(d){return d;};
st=function(s){window.__lastStatus=String(s||'');};
window.__svSettingsTest={
  setData:function(d,s){DATA=d;SELECTED=s||{};},
  getData:function(){return DATA;},
  setSelected:function(s){SELECTED=s||{};},
  setLoadJSON:function(fn){loadJSON=fn;},
  aliveTest:function(){ return window.aliveTest(); },
  landingTest:landingTest,
  cleanNames:cleanNames,
  buildExportPayload:buildExportPayload,
  getAliveSettings:getAliveSettings,
  getLandingSettings:getLandingSettings,
  aliveQS:aliveQS,
  landingQS:landingQS,
  getGistSettings:getGistSettings,
  gistUploadCurrent:gistUploadCurrent,
  isRunning:function(){return GEO_RUNNING;}
};
`;
const bundleCode = fs.readFileSync(path.join(ROOT, 'subviz.js'), 'utf8');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
async function waitFor(fn, label) {
  const started = Date.now();
  while (!fn()) {
    if (Date.now() - started > 1500) throw new Error('Timed out waiting for ' + label);
    await wait(10);
  }
}
function parseQuery(url) {
  const out = {};
  const q = String(url || '').split('?')[1] || '';
  q.split('&').forEach((part) => {
    if (!part) return;
    const eq = part.indexOf('=');
    const k = decodeURIComponent(eq >= 0 ? part.slice(0, eq) : part);
    const v = decodeURIComponent(eq >= 0 ? part.slice(eq + 1) : '');
    out[k] = v;
  });
  return out;
}
function makeEl(value) {
  return {
    value: value || '', checked: false, textContent: '', innerHTML: '', dataset: {}, style: {}, parentNode: null,
    addEventListener() {}, setAttribute(k, v) { this[k] = v; }, getAttribute(k) { return this[k]; },
    appendChild(c) { c.parentNode = this; return c; }, insertBefore(c) { c.parentNode = this; return c; },
    classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
    closest() { return null; }
  };
}
function makeClientSandbox() {
  const els = {
    status: makeEl(''), q: makeEl(''), pf: makeEl(''), cf: makeEl(''), unique: makeEl(''), exportType: makeEl('clash'),
    aliveUrl: makeEl('http://connectivitycheck.platform.hicloud.com/generate_204'), aliveStatus: makeEl('204'), aliveCon: makeEl('5'), aliveTimeout: makeEl('3000'), aliveRetries: makeEl('1'), aliveRetryDelay: makeEl('1000'), aliveShowLatency: makeEl(''),
    landingCon: makeEl('2'), landingTimeout: makeEl('5000'), landingRetries: makeEl('1'), landingFormat: makeEl(''), landingInternal: makeEl(''), landingApis: makeEl(''),
    dropWords: makeEl(''), keepTags: makeEl(''), nameTpl: makeEl('{flag} {code}-{country} {index} {tags}'),
    gistToken: makeEl(''), gistName: makeEl('subviz-share'), gistFilename: makeEl('mihomo.yaml'), gistId: makeEl(''), gistPublic: makeEl(''), gistRawUrl: makeEl(''), gistPageUrl: makeEl('')
  };
  const body = makeEl('body');
  body.appendChild = function (c) { c.parentNode = body; return c; };
  const doc = {
    __els: els,
    body,
    head: makeEl('head'),
    getElementById(id) { if (!els[id]) els[id] = makeEl(''); return els[id]; },
    createElement(tag) { const el = makeEl(''); el.tagName = tag || 'div'; el.remove = function(){}; el.click = function(){}; el.select = function(){}; el.setSelectionRange = function(){}; return el; },
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
  const sandbox = {
    window: { addEventListener() {} }, document: doc, navigator: {}, console,
    URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} }, Blob: function(parts, opt) { this.parts = parts; this.opt = opt; },
    btoa(s) { return Buffer.from(String(s), 'binary').toString('base64'); },
    encodeURIComponent, decodeURIComponent, escape, unescape, setTimeout, clearTimeout, Promise, Date, JSON, isFinite
  };
  vm.runInNewContext(clientCode, sandbox, { filename: 'src/client/app.js', timeout: 2000 });
  return sandbox;
}
function nodes(count) {
  return Array.from({ length: count }, (_, i) => ({
    _sid: 'n' + i, name: 'Node ' + i, protocol: 'trojan', server: 'example' + i + '.com', port: '443', countryCode: 'US', country: '美国',
    extra: { type: 'trojan', server: 'example' + i + '.com', port: '443', password: 'pass' + i }
  }));
}
function allSelected(ns) { return Object.fromEntries(ns.map((n) => [n._sid, 1])); }
async function runClientConcurrency(kind, limit) {
  const sandbox = makeClientSandbox();
  const api = sandbox.window.__svSettingsTest;
  const ns = nodes(12);
  api.setData({ ok: true, summary: { total: ns.length }, nodes: ns }, allSelected(ns));
  const els = sandbox.document.__els;
  let active = 0, maxActive = 0;
  const calls = [];
  if (kind === 'alive') {
    els.aliveCon.value = String(limit);
    els.aliveTimeout.value = '1000';
    els.aliveUrl.value = 'https://example.com/custom_204';
    els.aliveStatus.value = '200,204';
    els.aliveRetries.value = '0';
    els.aliveRetryDelay.value = '123';
    api.setLoadJSON((url) => {
      calls.push(url);
      active++; maxActive = Math.max(maxActive, active);
      return new Promise((resolve) => setTimeout(() => { active--; resolve({ ok: true, alive: true, status: 200, latency: 7 }); }, 15));
    });
    api.aliveTest();
  } else {
    els.landingCon.value = String(limit);
    els.landingTimeout.value = '5000';
    els.landingRetries.value = '2';
    els.landingApis.value = 'https://api-one.example/json\nhttps://api-two.example/json';
    els.landingFormat.value = '{flag} {code}-{country} {index}';
    els.landingInternal.checked = true;
    api.setLoadJSON((url) => {
      calls.push(url);
      active++; maxActive = Math.max(maxActive, active);
      return new Promise((resolve) => setTimeout(() => { active--; resolve({ ok: true, countryCode: 'JP', country: '日本', query: '1.2.3.4', latency: 9 }); }, 15));
    });
    api.landingTest();
  }
  await waitFor(() => !api.isRunning(), kind + ' completion');
  return { sandbox, maxActive, calls };
}
function requestBundle(pathname, options) {
  options = options || {};
  const captured = [];
  let result;
  const sandbox = {
    console, Buffer, Date, JSON, encodeURIComponent, decodeURIComponent, escape, unescape, setTimeout, clearTimeout,
    atob(input) { return Buffer.from(String(input || ''), 'base64').toString('binary'); },
    $request: { url: 'http://subviz.store' + pathname, method: options.method || 'GET', body: options.body || '' },
    $done(payload) { result = payload; },
    $httpClient: {
      get(opt, cb) {
        captured.push(opt);
        if (options.landingText) return cb(null, { status: 200, statusCode: 200 }, options.landingText);
        if (options.landingJson) return cb(null, { status: 200, statusCode: 200 }, JSON.stringify(options.landingJson));
        return cb(null, { status: options.status || 200, statusCode: options.status || 200 }, options.data || '');
      }
    },
    $utils: {
      geoip(ip) { return options.geoipCode || ''; },
      ipaso() { return 'Fixture ISP'; },
      ipasn() { return 'AS64500'; }
    }
  };
  vm.runInNewContext(bundleCode, sandbox, { filename: 'subviz.js', timeout: 2000 });
  if (!result || !result.response) throw new Error('No bundle response for ' + pathname);
  return { response: result.response, captured };
}
function jsonResponse(r) { return JSON.parse(r.response.body || '{}'); }

(async function main() {
  let r = await runClientConcurrency('alive', 8);
  assert(r.maxActive === 8, 'button-bound alive concurrency=8 should run 8 at most, got ' + r.maxActive);
  assert(/实际按 8 并发调度/.test(r.sandbox.window.__lastStatus), 'alive final status should report actual concurrency=8: ' + r.sandbox.window.__lastStatus);
  let q = parseQuery(r.calls[0]);
  assert(q.timeout === '1000', 'alive timeout should be sent as 1000ms');
  assert(q.url === 'https://example.com/custom_204', 'alive URL should use latest UI value');
  assert(q.status === '200,204', 'alive status codes should use latest UI value');
  assert(q.retry_delay === '123', 'alive retry delay should use latest UI value');

  r = await runClientConcurrency('alive', 3);
  assert(r.maxActive === 3, 'button-bound alive concurrency=3 should run 3 at most, got ' + r.maxActive);
  assert(/实际按 3 并发调度/.test(r.sandbox.window.__lastStatus), 'alive final status should report actual concurrency=3: ' + r.sandbox.window.__lastStatus);

  r = await runClientConcurrency('landing', 2);
  assert(r.maxActive === 2, 'landing concurrency=2 should run 2 at most, got ' + r.maxActive);
  q = parseQuery(r.calls[0]);
  assert(q.timeout === '5000', 'landing timeout should be sent as 5000ms');
  assert(q.retries === '2', 'landing retries should use latest UI value');
  assert(q.api === 'https://api-one.example/json|https://api-two.example/json', 'landing APIs should use UI list');
  assert(q.internal === '1', 'landing internal GEOIP switch should be sent');
  assert(q.format === '{flag} {code}-{country} {index}', 'landing format should be sent');
  assert(r.sandbox.window.__svSettingsTest.getData().nodes[0].name.indexOf('🇯🇵 JP-日本') === 0, 'landing format should rename nodes with current format');

  const cleanSandbox = makeClientSandbox();
  const cleanApi = cleanSandbox.window.__svSettingsTest;
  const cleanEls = cleanSandbox.document.__els;
  const cleanNodes = nodes(1);
  cleanNodes[0].name = 'VIP 美国 原生 1x';
  cleanNodes[0].originalName = cleanNodes[0].name;
  cleanNodes[0].rawName = cleanNodes[0].name;
  cleanNodes[0].extra.name = cleanNodes[0].name;
  cleanApi.setData({ ok: true, summary: { total: 1 }, nodes: cleanNodes }, {});
  cleanEls.dropWords.value = 'VIP';
  cleanEls.keepTags.value = '原生,1x';
  cleanEls.nameTpl.value = '{name} {tags}';
  cleanApi.cleanNames();
  const cleanedName = cleanApi.getData().nodes[0].name;
  assert(!/VIP/i.test(cleanedName), 'drop keyword should be removed from cleaned name: ' + cleanedName);
  assert(cleanedName.includes('原生') && cleanedName.includes('1x'), 'keep tags should remain in cleaned name: ' + cleanedName);
  cleanApi.setSelected({ n0: 1 });
  cleanEls.exportType.value = 'clash';
  const exported = cleanApi.buildExportPayload().text;
  assert(exported.includes(cleanedName), 'export should use cleaned node name');
  assert(!exported.includes('VIP 美国'), 'export should not use old dirty node name');

  const gistSandbox = makeClientSandbox();
  const gistApi = gistSandbox.window.__svSettingsTest;
  const gistEls = gistSandbox.document.__els;
  gistApi.setData({ ok: true, summary: { total: 1 }, nodes: nodes(1) }, { n0: 1 });
  const gistBodies = [];
  gistApi.setLoadJSON((_url, opt) => { gistBodies.push(JSON.parse(opt.body)); return Promise.resolve({ ok: true, action: 'updated', rawUrl: 'https://raw.example/sub', url: 'https://gist.example/page' }); });
  gistEls.gistToken.value = 'github_pat_first_fixture_token';
  gistEls.gistName.value = 'first-desc';
  gistEls.gistFilename.value = 'first.yaml';
  gistEls.gistPublic.checked = false;
  gistApi.gistUploadCurrent();
  await wait(0);
  gistEls.gistToken.value = 'github_pat_second_fixture_token';
  gistEls.gistName.value = 'second-desc';
  gistEls.gistFilename.value = 'second.yaml';
  gistEls.gistPublic.checked = true;
  gistApi.gistUploadCurrent();
  await wait(0);
  assert(gistBodies[0].filename === 'first.yaml' && gistBodies[0].gistName === 'first-desc' && gistBodies[0].public === false, 'first Gist upload should use first settings');
  assert(gistBodies[1].filename === 'second.yaml' && gistBodies[1].gistName === 'second-desc' && gistBodies[1].public === true, 'second Gist upload should use latest settings');
  assert(gistEls.gistRawUrl.value === 'https://raw.example/sub' && gistEls.gistPageUrl.value === 'https://gist.example/page', 'Gist success should update Raw URL and page URL');

  const serverNode = { name: 'Server Test', protocol: 'trojan', server: 'server.example.com', port: '443', extra: { type: 'trojan', server: 'server.example.com', port: '443', password: 'pass' } };
  let server = requestBundle('/api/availability?timeout=1000&url=' + encodeURIComponent('https://alive.example/204') + '&status=200&retries=0', { method: 'POST', body: JSON.stringify(serverNode), status: 200 });
  assert(server.captured[0].timeout === 1, 'server availability should convert 1000ms to 1s, got ' + server.captured[0].timeout);
  assert(jsonResponse(server).ok === true && jsonResponse(server).url === 'https://alive.example/204', 'server availability should use requested URL and status');

  server = requestBundle('/api/landing?timeout=5000&retries=0&api=' + encodeURIComponent('https://custom.example/geo') + '&format=' + encodeURIComponent('{flag} {code}') , { method: 'POST', body: JSON.stringify(serverNode), landingJson: { ip: '8.8.8.8', countryCode: 'US', country: 'United States' } });
  assert(server.captured[0].timeout === 5, 'server landing should convert 5000ms to 5s');
  assert(server.captured[0].url === 'https://custom.example/geo', 'server landing should use custom API list');

  server = requestBundle('/api/landing?timeout=1000&retries=0&internal=1&api=' + encodeURIComponent('https://ip.example/plain'), { method: 'POST', body: JSON.stringify(serverNode), landingText: '8.8.4.4', geoipCode: 'US' });
  const jr = jsonResponse(server);
  assert(server.captured[0].timeout === 1, 'server internal landing should convert 1000ms to 1s');
  assert(jr.ok === true && jr.provider === 'internal', 'internal GEOIP path should be used when switch is on');

  console.log('SubViz settings data-flow regression tests passed.');
})().catch((err) => {
  console.error(err && err.stack || err);
  process.exit(1);
});
