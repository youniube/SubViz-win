#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const BUNDLE = path.join(ROOT, 'subviz.js');
const code = fs.readFileSync(BUNDLE, 'utf8');

function atob(input) { return Buffer.from(String(input || ''), 'base64').toString('binary'); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

function request(pathname, options) {
  options = options || {};
  let result;
  const sandbox = {
    console, atob, Buffer, setTimeout, clearTimeout, Date, JSON,
    encodeURIComponent, decodeURIComponent, escape, unescape,
    $request: { url: 'http://subviz.store' + pathname, method: options.method || 'GET', body: options.body || '' },
    $done: function (payload) { result = payload; },
    $httpClient: { get: function (_opt, cb) { cb(new Error('network disabled')); } },
    $utils: {}
  };
  vm.runInNewContext(code, sandbox, { filename: 'subviz.js', timeout: 2000 });
  if (!result || !result.response) throw new Error('No $done response');
  return result.response;
}

function json(resp) { return JSON.parse(resp.body); }

// --- Edge case tests ---

// 1. Empty input
(function () {
  const r = json(request('/api/analyze-text', { method: 'POST', body: '' }));
  assert(r.ok === true, 'empty input should return ok');
  assert(r.summary.total === 0, 'empty input: total should be 0');
  console.log('PASS: empty input');
})();

// 2. Pure comments / no nodes
(function () {
  const r = json(request('/api/analyze-text', { method: 'POST', body: '# just a comment\n; another comment\n' }));
  assert(r.ok === true, 'comment-only should be ok');
  assert(r.summary.total === 0, 'comment-only: total should be 0');
  console.log('PASS: comment-only input');
})();

// 3. XSS payload in node name — should parse without crashing
(function () {
  const malicious = 'trojan://pass@1.2.3.4:443#<script>alert(1)</script>';
  const r = json(request('/api/analyze-text', { method: 'POST', body: malicious }));
  assert(r.ok === true, 'XSS name should parse ok');
  assert(r.summary.total === 1, 'XSS name: 1 node');
  assert(r.nodes[0].name.indexOf('<script>') >= 0 || r.nodes[0].name.indexOf('&lt;') >= 0, 'XSS name preserved or escaped');
  console.log('PASS: XSS payload in node name');
})();

// 4. SS URI with special chars in password (@ : # space)
(function () {
  const pw = encodeURIComponent('p@ss:w#rd 123');
  const uri = 'ss://' + Buffer.from('aes-128-gcm:p@ss:w#rd 123').toString('base64').replace(/=+$/, '') + '@5.6.7.8:8388#SpecialPW';
  const r = json(request('/api/analyze-text', { method: 'POST', body: uri }));
  assert(r.ok === true, 'special char SS should parse');
  assert(r.summary.total >= 1, 'special char SS: at least 1 node');
  const n = r.nodes.find(n => n.protocol === 'ss');
  assert(n, 'should find SS node');
  assert(n.extra && n.extra.cipher === 'aes-128-gcm', 'SS cipher correct, got: ' + (n.extra && n.extra.cipher));
  console.log('PASS: SS with special chars in password');
})();

// 5. SS 2022 with colon in password
(function () {
  const uri = 'ss://2022-blake3-aes-256-gcm:c2VydmVyS2V5:dXNlcktleQ@9.8.7.6:8388#SS2022';
  const r = json(request('/api/analyze-text', { method: 'POST', body: uri }));
  assert(r.ok === true, 'SS 2022 should parse');
  const n = r.nodes[0];
  assert(n.extra.cipher === '2022-blake3-aes-256-gcm', 'SS2022 cipher correct');
  assert(n.extra.password === 'c2VydmVyS2V5:dXNlcktleQ', 'SS2022 password with colon preserved');
  console.log('PASS: SS 2022 with colon in password');
})();

// 6. Malformed base64 — should not crash
(function () {
  const bad = 'dGhpcyBpcyBub3QgdmFsaWQ!!!not-base64%%%';
  const r = json(request('/api/analyze-text', { method: 'POST', body: bad }));
  assert(r.ok === true, 'bad base64 should not crash');
  console.log('PASS: malformed base64 does not crash');
})();

// 7. Extremely long node name
(function () {
  const longName = 'A'.repeat(2000);
  const uri = 'trojan://pass@1.2.3.4:443#' + longName;
  const r = json(request('/api/analyze-text', { method: 'POST', body: uri }));
  assert(r.ok === true, 'long name should parse');
  assert(r.summary.total === 1, 'long name: 1 node');
  console.log('PASS: extremely long node name');
})();

// 8. Clash YAML with only proxy-groups (no real nodes)
(function () {
  const yaml = 'proxy-groups:\n  - name: AutoSelect\n    type: url-test\n    proxies:\n      - DIRECT\n';
  const r = json(request('/api/analyze-text', { method: 'POST', body: yaml }));
  assert(r.ok === true, 'proxy-groups only should be ok');
  assert(r.summary.total === 0, 'proxy-groups only: 0 real nodes');
  console.log('PASS: Clash YAML with only proxy-groups');
})();

// 9. Duplicate nodes across Clash + URI in same input are deduped in URI pass
(function () {
  const yaml = 'proxies:\n  - name: dup\n    type: trojan\n    server: dup.example.com\n    port: 443\n    password: pass\n';
  const uri = '\ntrojan://pass@dup.example.com:443#dup-uri';
  const r = json(request('/api/analyze-text', { method: 'POST', body: yaml + uri }));
  assert(r.ok === true, 'mixed dup should parse');
  // The same server:port:protocol should only appear once in nodes
  const matching = r.nodes.filter(n => n.server === 'dup.example.com' && n.protocol === 'trojan');
  assert(matching.length === 1, 'cross-format duplicate should be deduped to 1, got ' + matching.length);
  console.log('PASS: cross-format dedup (Clash + URI)');
})();

// 10. IPv6 address without port
(function () {
  const uri = 'trojan://pass@[::1]:443#ipv6test';
  const r = json(request('/api/analyze-text', { method: 'POST', body: uri }));
  assert(r.ok === true, 'IPv6 should parse');
  const n = r.nodes[0];
  assert(n.server === '::1', 'IPv6 host parsed, got: ' + n.server);
  assert(n.port === '443', 'IPv6 port parsed, got: ' + n.port);
  console.log('PASS: IPv6 address parsing');
})();

console.log('\nSubViz edge-case tests passed.');
