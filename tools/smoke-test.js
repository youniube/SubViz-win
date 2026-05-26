#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const BUNDLE = path.join(ROOT, 'subviz.js');
const code = fs.readFileSync(BUNDLE, 'utf8');

function atob(input) {
  return Buffer.from(String(input || ''), 'base64').toString('binary');
}

function request(pathname, options) {
  options = options || {};
  let result;
  const sandbox = {
    console,
    atob,
    Buffer,
    setTimeout,
    clearTimeout,
    Date,
    JSON,
    encodeURIComponent,
    decodeURIComponent,
    escape,
    unescape,
    $request: {
      url: 'http://subviz.store' + pathname,
      method: options.method || 'GET',
      body: options.body || ''
    },
    $done: function (payload) { result = payload; },
    $httpClient: {
      get: function (_opt, cb) { cb(new Error('network disabled in smoke test')); }
    },
    $utils: {}
  };
  vm.runInNewContext(code, sandbox, { filename: 'subviz.js', timeout: 1000 });
  if (!result || !result.response) throw new Error('No $done response for ' + pathname);
  return result.response;
}

function json(resp) {
  if (!resp || !resp.body) throw new Error('Missing response body');
  return JSON.parse(resp.body);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

const health = json(request('/api/health'));
assert(health.ok === true, 'health ok failed');
assert(health.version === '0.1.45', 'unexpected version: ' + health.version);
assert(health.marker === 'SUBVIZ_SURGE_0_1_45', 'unexpected marker: ' + health.marker);

const app = request('/app.js?v=0.1.45');
assert(/function\s+analyzeURL/.test(app.body), 'client app missing analyzeURL');
new vm.Script(app.body, { filename: 'src/client/app.js' });

const sample = json(request('/api/sample'));
assert(sample.ok === true, 'sample ok failed');
assert(sample.summary && sample.summary.total >= 6, 'sample node count too low');

const text = `proxies:
  - { name: "DE grpc demo", type: vmess, server: de.example.com, port: 443, uuid: 11111111-1111-1111-1111-111111111111, alterId: 0, cipher: auto, tls: true, network: grpc, grpc-opts: { grpc-service-name: demoService } }
  - name: "US reality demo"
    type: vless
    server: us.example.com
    port: 443
    uuid: 22222222-2222-2222-2222-222222222222
    tls: true
    flow: xtls-rprx-vision
    client-fingerprint: chrome
    reality-opts:
      public-key: abcdefg
      short-id: 1234
`;
const analyzed = json(request('/api/analyze-text', { method: 'POST', body: text }));
assert(analyzed.ok === true, 'analyze-text ok failed');
assert(analyzed.summary.total === 2, 'unexpected analyze-text count: ' + analyzed.summary.total);
assert(analyzed.nodes.some(n => n.protocol === 'vless' && n.extra && n.extra['reality-public-key'] === 'abcdefg'), 'reality flatten failed');
assert(analyzed.nodes.some(n => n.protocol === 'vmess' && n.extra && n.extra['grpc-opts'] && n.extra['grpc-opts']['grpc-service-name'] === 'demoService'), 'grpc flow-style parse failed');

console.log('SubViz smoke tests passed.');
