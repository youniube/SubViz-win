#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const BUNDLE = path.join(ROOT, 'subviz.js');
const code = fs.readFileSync(BUNDLE, 'utf8');
const store = Object.create(null);
const calls = [];
let mockMode = 'create';

function atob(input) { return Buffer.from(String(input || ''), 'base64').toString('binary'); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function json(resp) { return JSON.parse(resp.body || '{}'); }
function makeResp(status) { return { status, statusCode: status }; }
function mockHttp(method, opt, cb) {
  calls.push({ method, url: opt.url, body: opt.body || '' });
  if (/\/gists\?per_page=1$/.test(opt.url)) return cb(null, makeResp(200), '[]');
  if (/\/gists\?per_page=100/.test(opt.url)) {
    if (mockMode === 'update') return cb(null, makeResp(200), JSON.stringify([{ id:'gist_existing', description:'subviz-share', files:{} }]));
    return cb(null, makeResp(200), '[]');
  }
  if (method === 'POST' && /\/gists$/.test(opt.url)) {
    const body = JSON.parse(opt.body || '{}');
    const filename = Object.keys(body.files || {})[0] || 'mihomo.yaml';
    return cb(null, makeResp(201), JSON.stringify({ id:'gist_created', description:body.description, html_url:'https://gist.github.com/u/gist_created', updated_at:'2026-01-01T00:00:00Z', files:{ [filename]:{ raw_url:'https://gist.githubusercontent.com/u/gist_created/raw/abcdef1234567890/' + filename } } }));
  }
  if (method === 'PATCH' && /\/gists\/gist_existing$/.test(opt.url)) {
    const body = JSON.parse(opt.body || '{}');
    const filename = Object.keys(body.files || {})[0] || 'mihomo.yaml';
    return cb(null, makeResp(200), JSON.stringify({ id:'gist_existing', description:body.description, html_url:'https://gist.github.com/u/gist_existing', updated_at:'2026-01-01T00:00:00Z', files:{ [filename]:{ raw_url:'https://gist.githubusercontent.com/u/gist_existing/raw/abcdef1234567890/' + filename } } }));
  }
  return cb(new Error('unexpected mock request: ' + method + ' ' + opt.url));
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
    $request: { url:'http://subviz.store' + pathname, method:options.method || 'GET', body:options.body || '' },
    $done(payload) { result = payload; },
    $persistentStore: {
      read(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
      write(value, key) { store[key] = String(value || ''); return true; }
    },
    $httpClient: {
      get(opt, cb) { return mockHttp('GET', opt, cb); },
      post(opt, cb) { return mockHttp('POST', opt, cb); },
      patch(opt, cb) { return mockHttp('PATCH', opt, cb); }
    },
    $utils: {}
  };
  vm.runInNewContext(code, sandbox, { filename:'subviz.js', timeout:1000 });
  if (!result || !result.response) throw new Error('No $done response for ' + pathname);
  return result.response;
}

assert(json(request('/api/gist-token/status')).hasToken === false, 'initial token status should be false');
assert(json(request('/api/gist-token/save', { method:'POST', body:JSON.stringify({ token:'github_pat_fixture_token_1234567890' }) })).ok === true, 'token save failed');
assert(json(request('/api/gist-token/status')).hasToken === true, 'token status should be true after save');
assert(json(request('/api/gist-token/test', { method:'POST', body:'{}' })).ok === true, 'token test failed');

mockMode = 'create';
let upload = json(request('/api/gist-upload', { method:'POST', body:JSON.stringify({ gistName:'subviz-share', filename:'mihomo.yaml', content:'proxies: []\n', public:false }) }));
assert(upload.ok === true && upload.action === 'created', 'gist create upload failed');
assert(upload.rawUrl === 'https://gist.githubusercontent.com/u/gist_created/raw/mihomo.yaml', 'stable raw url normalization failed: ' + upload.rawUrl);

mockMode = 'update';
upload = json(request('/api/gist-upload', { method:'POST', body:JSON.stringify({ gistName:'subviz-share', filename:'mihomo.yaml', content:'proxies: []\n', public:false }) }));
assert(upload.ok === true && upload.action === 'updated', 'gist update upload failed');
assert(calls.some((c) => c.method === 'PATCH' && /gist_existing$/.test(c.url)), 'gist update did not call PATCH');

assert(json(request('/api/gist-token/delete', { method:'POST', body:'{}' })).ok === true, 'token delete failed');
assert(json(request('/api/gist-token/status')).hasToken === false, 'token status should be false after delete');

console.log('SubViz Gist API tests passed.');
