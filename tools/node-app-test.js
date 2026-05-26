'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.SUBVIZ_NO_MIHOMO = '1';

const parser = require('../lib/parser');
const { normalizeGeoResult } = require('../lib/geo');
const { MihomoManager, nodeToMihomoProxy } = require('../lib/mihomo-manager');
const { availabilityStatusOK, firstExpectedStatus } = require('../lib/availability');
const { createSubVizServer } = require('../server');
const store = require('../lib/store');

function assertParser() {
  const fixture = fs.readFileSync(path.join(__dirname, '..', 'test/fixtures/clash-mixed.yaml'), 'utf8');
  const result = parser.parseSubscription(fixture);
  assert(result.summary.total >= 4, 'fixture should parse multiple nodes');
  assert(result.nodes.some(n => n.protocol === 'vless'), 'vless should be parsed');
  assert(result.nodes.some(n => n.protocol === 'vmess'), 'vmess should be parsed');
}

function assertGeo() {
  const r = normalizeGeoResult({ success: true, ip: '8.8.8.8', country_code: 'US', country: 'United States', city: 'Mountain View', connection: { isp: 'Google', asn: 15169 } }, 'ipwho.is', '8.8.8.8');
  assert(r.ok);
  assert.equal(r.countryCode, 'US');
  assert.equal(r.country, '美国');
  assert.equal(r.city, 'Mountain View');
}

function assertMihomoMapping() {
  const vless = nodeToMihomoProxy({ name: 'US 01', protocol: 'vless', server: 'example.com', port: '443', extra: { uuid: 'uuid', security: 'reality', network: 'grpc', 'grpc-service-name': 'svc', 'reality-public-key': 'pk', 'reality-short-id': 'sid', 'client-fingerprint': 'chrome' } });
  assert.equal(vless.type, 'vless');
  assert.equal(vless.tls, true);
  assert.equal(vless['reality-opts']['public-key'], 'pk');
  assert.equal(vless['grpc-opts']['grpc-service-name'], 'svc');

  const vmess = nodeToMihomoProxy({ name: 'HK 01', protocol: 'vmess', server: 'h.example.com', port: '443', extra: { uuid: 'uuid', network: 'ws', tls: 'true', path: '/ws', Host: 'host.example.com' } });
  assert.equal(vmess.type, 'vmess');
  assert.equal(vmess['ws-opts'].headers.Host, 'host.example.com');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'subviz-mihomo-'));
  const m = new MihomoManager({ configDir: tmp, disabled: true });
  m.writeConfig([
    { name: 'dup', protocol: 'ss', server: '1.1.1.1', port: '443', extra: { cipher: 'aes-128-gcm', password: 'p' }, fingerprint: 'a' },
    { name: 'dup', protocol: 'ss', server: '1.1.1.2', port: '443', extra: { cipher: 'aes-128-gcm', password: 'p2' }, fingerprint: 'b' },
  ]);
  const yaml = fs.readFileSync(path.join(tmp, 'config.yaml'), 'utf8');
  assert(yaml.includes('mixed-port: 17890'));
  assert(yaml.includes('socks-port: 17891'));
  assert(yaml.includes('port: 17892'));
  assert(yaml.includes('external-controller: 127.0.0.1:19090'));
  assert(yaml.includes('name: "dup (2)"'));
  assert(!yaml.includes('port: 7890'));
}

function assertAvailability() {
  assert(availabilityStatusOK(204, '204'));
  assert(availabilityStatusOK(200, '2xx'));
  assert(availabilityStatusOK(299, '200-299'));
  assert(!availabilityStatusOK(404, '2xx'));
  assert.equal(firstExpectedStatus('2xx'), 200);
}

async function assertServerRoutes() {
  const fake = {
    isReady: async () => false,
    lastError: 'disabled in test',
    mixedPort: 17890,
    socksPort: 17891,
    httpPort: 17892,
    apiPort: 19090,
    injectNodes: async nodes => ({ ok: true, count: nodes.length }),
  };
  const server = createSubVizServer({ mihomoManager: fake });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    const health = await fetch(`http://127.0.0.1:${port}/api/health`).then(r => r.json());
    assert.equal(health.ok, true);
    assert.equal(health.mihomo.ports.api, 19090);
    const result = await fetch(`http://127.0.0.1:${port}/api/analyze-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: 'ss://YWVzLTEyOC1nY206cGFzc0AxLjEuMS4xOjQ0Mw#HK%2001',
    }).then(r => r.json());
    assert.equal(result.ok, true);
    assert.equal(result.summary.total, 1);
    assert.equal(result.nodes[0].countryCode, 'HK');
    const html = await fetch(`http://127.0.0.1:${port}/`).then(r => r.text());
    assert(html.includes('Local Node UI'));
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

function assertStore() {
  const tmp = path.join(os.tmpdir(), 'subviz-store-' + Date.now() + '.json');
  store.setStorePath(tmp);
  assert.equal(store.read('x'), '');
  store.write('x', 'y');
  assert.equal(store.read('x'), 'y');
  store.remove('x');
  assert.equal(store.read('x'), '');
}

(async () => {
  assertParser();
  assertGeo();
  assertMihomoMapping();
  assertAvailability();
  assertStore();
  await assertServerRoutes();
  console.log('node-app-test ok');
})().catch(err => {
  console.error(err && err.stack || err);
  process.exit(1);
});
