#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE_DIR = path.join(ROOT, 'test', 'fixtures');
const BUNDLE = path.join(ROOT, 'subviz.js');
const code = fs.readFileSync(BUNDLE, 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'manifest.json'), 'utf8'));

function atob(input) { return Buffer.from(String(input || ''), 'base64').toString('binary'); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function getByPath(obj, dotted) {
  return String(dotted || '').split('.').reduce((cur, key) => cur == null ? undefined : cur[key], obj);
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
    $httpClient: { get: function (_opt, cb) { cb(new Error('network disabled in fixture test')); } },
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

(manifest.fixtures || []).forEach((fixture) => {
  const text = fs.readFileSync(path.join(FIXTURE_DIR, fixture.file), 'utf8');
  const analyzed = json(request('/api/analyze-text', { method: 'POST', body: text }));
  assert(analyzed.ok === true, fixture.file + ': analyze-text not ok');
  assert(analyzed.summary.total === fixture.expectedTotal, fixture.file + ': expected total ' + fixture.expectedTotal + ', got ' + analyzed.summary.total);
  if (fixture.expectedUnique != null) assert(analyzed.summary.unique === fixture.expectedUnique, fixture.file + ': unexpected unique count');
  if (fixture.expectedDuplicates != null) assert(analyzed.summary.duplicates === fixture.expectedDuplicates, fixture.file + ': unexpected duplicate count');
  (fixture.protocols || []).forEach((protocol) => {
    assert(analyzed.nodes.some((n) => n.protocol === protocol), fixture.file + ': missing protocol ' + protocol);
  });
  (fixture.checks || []).forEach((check) => {
    const n = analyzed.nodes.find((node) => node.protocol === check.protocol);
    assert(n, fixture.file + ': missing checked protocol ' + check.protocol);
    const value = getByPath(n, check.path);
    assert(String(value) === String(check.equals), fixture.file + ': ' + check.path + ' expected ' + check.equals + ', got ' + value);
  });
});

console.log('SubViz fixture regression tests passed.');
