#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const clientPath = path.join(ROOT, 'src', 'client', 'app.js');
let code = fs.readFileSync(clientPath, 'utf8');
const cut = code.indexOf('function aliveErr');
if (cut < 0) throw new Error('Unable to locate export helper boundary in client app');
code = code.slice(0, cut) + '\nwindow.__setExportTestData=function(d,s,type){DATA=d;SELECTED=s||{};document.__els.exportType.value=type||"clash";};\nwindow.__toClashYAML=toClashYAML;\nwindow.__toURIText=toURIText;\nwindow.__buildExportPayload=buildExportPayload;\n';

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function makeEl(value) { return { value: value || '', textContent: '', innerHTML: '', checked: false }; }
const doc = {
  __els: { status: makeEl(''), exportType: makeEl('clash') },
  getElementById(id) { if (!this.__els[id]) this.__els[id] = makeEl(''); return this.__els[id]; },
  createElement() { return { style: {}, setAttribute(){}, select(){}, setSelectionRange(){}, click(){}, remove(){}, appendChild(){}, classList:{add(){}} }; },
  body: { appendChild(){} }
};
const sandbox = {
  window: {},
  document: doc,
  URL: { createObjectURL(){ return 'blob:test'; }, revokeObjectURL(){} },
  Blob: function(parts, opt){ this.parts = parts; this.opt = opt; },
  navigator: {},
  btoa(s) { return Buffer.from(String(s), 'binary').toString('base64'); },
  encodeURIComponent,
  decodeURIComponent,
  escape,
  unescape,
  setTimeout,
  clearTimeout,
  console
};
sandbox.window = sandbox.window || {};
vm.runInNewContext(code, sandbox, { filename: 'src/client/app.js', timeout: 1000 });

const nodes = [
  { _sid:'n1', id:'demo-password', name:'SG Trojan WS', protocol:'trojan', server:'trojan.example.com', port:'443', network:'ws', tls:'true', extra:{ type:'trojan', server:'trojan.example.com', port:'443', password:'demo-password', network:'ws', tls:true, sni:'edge.example.com', 'ws-opts':{ path:'/trojan', headers:{ Host:'cdn.example.com' } } } },
  { _sid:'n2', id:'11111111-1111-1111-1111-111111111111', name:'US VLESS Reality', protocol:'vless', server:'reality.example.com', port:'443', network:'tcp', tls:'true', extra:{ type:'vless', server:'reality.example.com', port:'443', uuid:'11111111-1111-1111-1111-111111111111', tls:true, flow:'xtls-rprx-vision', servername:'www.microsoft.com', 'client-fingerprint':'chrome', 'reality-opts':{ 'public-key':'fixture-public-key', 'short-id':'abcd' } } },
  { _sid:'n3', id:'22222222-2222-2222-2222-222222222222', name:'DE VMess gRPC', protocol:'vmess', server:'grpc.example.com', port:'443', network:'grpc', tls:'true', extra:{ type:'vmess', server:'grpc.example.com', port:'443', uuid:'22222222-2222-2222-2222-222222222222', tls:true, network:'grpc', 'grpc-opts':{ 'grpc-service-name':'fixtureGrpc' } } },
  { _sid:'n4', id:'demo-password', name:'JP Hy2', protocol:'hysteria2', server:'hy2.example.com', port:'443', extra:{ type:'hysteria2', server:'hy2.example.com', port:'443', password:'demo-password', sni:'hy2.example.com' } },
  { _sid:'n5', id:'33333333-3333-3333-3333-333333333333', name:'HK TUIC', protocol:'tuic', server:'tuic.example.com', port:'443', extra:{ type:'tuic', server:'tuic.example.com', port:'443', uuid:'33333333-3333-3333-3333-333333333333', password:'demo-password', sni:'tuic.example.com', alpn:['h3'] } },
  { _sid:'n6', id:'demo-psk', name:'GB Snell', protocol:'snell', server:'snell.example.com', port:'44046', extra:{ type:'snell', server:'snell.example.com', port:'44046', psk:'demo-psk', version:'4', obfs:'tls', 'obfs-host':'bing.com' } },
  { _sid:'n7', id:'demo-password', name:'NL AnyTLS', protocol:'anytls', server:'anytls.example.com', port:'443', extra:{ type:'anytls', server:'anytls.example.com', port:'443', password:'demo-password', sni:'anytls.example.com' } }
];
const selected = Object.fromEntries(nodes.map((n) => [n._sid, 1]));
sandbox.window.__setExportTestData({ ok:true, summary:{ total:nodes.length }, nodes }, selected, 'clash');
const yaml = sandbox.window.__toClashYAML();
assert(/ws-opts:\n\s+path: "\/trojan"\n\s+headers:\n\s+Host: "cdn\.example\.com"/.test(yaml), 'Clash export did not keep nested ws-opts');
assert(/grpc-opts:\n\s+grpc-service-name: "fixtureGrpc"/.test(yaml), 'Clash export did not keep nested grpc-opts');
assert(/reality-opts:\n\s+public-key: "fixture-public-key"\n\s+short-id: "abcd"/.test(yaml), 'Clash export did not keep nested reality-opts');
assert(!/ws-opts: "\{/.test(yaml), 'Clash export stringified ws-opts as JSON');
assert(!/grpc-opts: "\{/.test(yaml), 'Clash export stringified grpc-opts as JSON');

sandbox.window.__setExportTestData({ ok:true, summary:{ total:nodes.length }, nodes }, selected, 'uri');
const uris = sandbox.window.__toURIText();
['trojan://','vless://','vmess://','hysteria2://','tuic://','snell://','anytls://'].forEach((prefix) => assert(uris.includes(prefix), 'URI export missing ' + prefix));
assert(/vless:\/\/[^\n]+security=reality/.test(uris), 'VLESS Reality URI missing security=reality');
assert(/pbk=fixture-public-key/.test(uris), 'VLESS Reality URI missing pbk');

sandbox.window.__setExportTestData({ ok:true, summary:{ total:nodes.length }, nodes }, selected, 'json');
const payload = sandbox.window.__buildExportPayload();
assert(payload.label.indexOf('JSON') >= 0, 'JSON export payload label missing');
assert(JSON.parse(payload.text).nodes.length === nodes.length, 'JSON export payload count mismatch');

console.log('SubViz client export tests passed.');
