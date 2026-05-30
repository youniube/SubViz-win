'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

process.env.SUBVIZ_NO_MIHOMO = '1';

const parser = require('../lib/parser');
const { normalizeGeoResult } = require('../lib/geo');
const { MihomoManager, nodeToMihomoProxy } = require('../lib/mihomo-manager');
const { availabilityStatusOK, firstExpectedStatus, availabilityCheck } = require('../lib/availability');
const { createSubVizServer } = require('../server');
const store = require('../lib/store');
const landing = require('../lib/landing');

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
  assert(yaml.includes('MATCH,subviz-select'));
  assert(!yaml.includes('MATCH,DIRECT'));
  assert(!yaml.includes('port: 7890'));
}

async function assertAvailability() {
  assert(availabilityStatusOK(204, '204'));
  assert(availabilityStatusOK(200, '2xx'));
  assert(availabilityStatusOK(299, '200-299'));
  assert(!availabilityStatusOK(404, '2xx'));
  assert.equal(firstExpectedStatus('2xx'), 200);
  const fake = {
    isReady: async () => true,
    getProxyInventory: async () => ({ total: 2, nodeCount: 1, nameSet: new Set(['node-a']), nodeNameSet: new Set(['node-a']) }),
    findLoadedProxyName: () => ({ found: true, name: 'node-a', candidates: ['node-a'] }),
    controllerBaseURL: () => 'http://127.0.0.1:19090',
    delayRequestPath: (name, url) => '/proxies/' + encodeURIComponent(name) + '/delay?url=' + encodeURIComponent(url),
    requestViaNode: async () => ({ status: 204, latency: 12, body: '' }),
  };
  const ok = await availabilityCheck({ name: 'node-a', protocol: 'vmess', server: 'example.com', port: 443 }, { mihomoManager: fake, statusExpr: '204' });
  assert.equal(ok.ok, true);
  assert.equal(ok.status, 204);
  const badFake = Object.assign({}, fake, { requestViaNode: async () => ({ status: 200, latency: 12, body: '' }) });
  const bad = await availabilityCheck({ name: 'node-a', protocol: 'vmess', server: 'example.com', port: 443 }, { mihomoManager: badFake, statusExpr: '204', retries: 0 });
  assert.equal(bad.ok, false);
  assert.equal(bad.category, 'bad_status');
}

async function assertLandingDoesNotInject() {
  let injected = 0;
  const fake = {
    isReady: async () => true,
    getProxyInventory: async () => ({ total: 2, nodeCount: 1, nameSet: new Set(['node-a']), nodeNameSet: new Set(['node-a']) }),
    findLoadedProxyName: () => ({ found: true, name: 'node-a', candidates: ['node-a'] }),
    injectNodes: async () => { injected++; throw new Error('should not inject during landing'); },
    requestViaNode: async () => ({ status: 200, latency: 10, body: JSON.stringify({ success: true, ip: '8.8.8.8', country_code: 'US', country: 'United States' }) }),
  };
  const r = await landing.landingLookup({ name: 'node-a', protocol: 'vmess', server: 'example.com', port: 443 }, { mihomoManager: fake, api: 'https://ipwho.is/?lang=zh-CN', retries: 0 });
  assert.equal(injected, 0);
  assert.equal(r.ok, true);
}


function captureConsoleLogs() {
  const logs = [];
  const orig = console.log;
  console.log = function () {
    logs.push(Array.prototype.slice.call(arguments).join(' '));
  };
  return { logs, restore: () => { console.log = orig; } };
}

async function withRemoteSubscription(body, headers, fn) {
  const server = http.createServer((req, res) => {
    res.writeHead(200, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, headers || {}));
    res.end(body);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    return await fn('http://127.0.0.1:' + server.address().port + '/sub');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}


async function withUserAgentRemote(fn) {
  const requests = [];
  const body = 'ss://YWVzLTEyOC1nY206cGFzc0AxLjEuMS4xOjQ0Mw#HK%2001';
  const server = http.createServer((req, res) => {
    const ua = String(req.headers['user-agent'] || '');
    requests.push(ua);
    if (ua.includes('Mihomo/')) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<html>not found</html>');
      return;
    }
    if (ua.includes('Clash.Meta/')) {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(body);
      return;
    }
    if (ua.includes('Shadowrocket/')) {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(body);
      return;
    }
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('blocked');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    return await fn('http://127.0.0.1:' + server.address().port + '/sub', requests);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

async function assertAutoUserAgentShortCircuit() {
  let injected = 0;
  const fake = {
    isReady: async () => false,
    lastError: 'disabled in test',
    mixedPort: 17890,
    socksPort: 17891,
    httpPort: 17892,
    apiPort: 19090,
    injectNodes: async nodes => {
      injected++;
      return { ok: true, count: nodes.length, writtenCount: nodes.length, diagnostics: {
        parsedCount: nodes.length,
        writtenCount: nodes.length,
        mihomoNodeCount: nodes.length + 1,
        testableCount: nodes.length,
        missingCount: 0,
        conversionSkippedCount: 0,
        conversionSkippedReasons: {},
      } };
    },
  };
  const server = createSubVizServer({ mihomoManager: fake });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    await withUserAgentRemote(async (remoteUrl, requests) => {
      const cap = captureConsoleLogs();
      try {
        const pulled = await fetch(`http://127.0.0.1:${port}/api/analyze?url=${encodeURIComponent(remoteUrl)}&client=auto`).then(r => r.json());
        assert.equal(pulled.ok, true);
        assert.equal(pulled.selectedFetchClientName, 'Clash.Meta');
        assert.equal(injected, 1, 'auto UA should inject into Mihomo only once');
        assert.equal(requests.length, 2, 'auto UA should stop after Clash.Meta succeeds');
        assert(requests[0].includes('Mihomo/'), 'first candidate should be Mihomo');
        assert(requests[1].includes('Clash.Meta/'), 'second candidate should be Clash.Meta');
        assert(!requests.some(ua => ua.includes('Shadowrocket/')), 'must not continue to Shadowrocket after success');
        assert(cap.logs.some(l => l.includes('自动 UA 命中：Clash.Meta')), 'auto UA hit log should identify Clash.Meta');
      } finally {
        cap.restore();
      }
    });
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

async function assertFixedUserAgentNoFallback() {
  const fake = {
    isReady: async () => false,
    injectNodes: async nodes => ({ ok: true, count: nodes.length, writtenCount: nodes.length, diagnostics: { parsedCount: nodes.length, writtenCount: nodes.length, mihomoNodeCount: nodes.length + 1, testableCount: nodes.length, missingCount: 0, conversionSkippedCount: 0 } }),
  };
  const server = createSubVizServer({ mihomoManager: fake });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    await withUserAgentRemote(async (remoteUrl, requests) => {
      const pulled = await fetch(`http://127.0.0.1:${port}/api/analyze?url=${encodeURIComponent(remoteUrl)}&client=clash-meta`).then(r => r.json());
      assert.equal(pulled.ok, true);
      assert.equal(requests.length, 1, 'fixed UA mode must request once only');
      assert(requests[0].includes('Clash.Meta/'), 'fixed client should use Clash.Meta UA');
    });
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

function assertSurgeParserHelpers() {
  const r = parser.parseSubscription('[Proxy]\nHK 01 = ss, 1.1.1.1, 443, encrypt-method=aes-128-gcm, password=p');
  assert.equal(r.summary.total, 1, 'Surge parser should not throw splitProxyParts is not defined');
  assert.equal(r.nodes[0].protocol, 'ss');
}

async function assertServerRoutes() {
  const fake = {
    isReady: async () => false,
    lastError: 'disabled in test',
    mixedPort: 17890,
    socksPort: 17891,
    httpPort: 17892,
    apiPort: 19090,
    injectNodes: async nodes => ({ ok: true, count: nodes.length, writtenCount: nodes.length, diagnostics: {
      parsedCount: nodes.length,
      writtenCount: nodes.length,
      mihomoNodeCount: nodes.length + 1,
      testableCount: nodes.length,
      missingCount: 0,
      conversionSkippedCount: 0,
      conversionSkippedReasons: {},
    } }),
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

    await withRemoteSubscription('ss://YWVzLTEyOC1nY206cGFzc0AxLjEuMS4xOjQ0Mw#HK%2001', {}, async (remoteUrl) => {
      const cap = captureConsoleLogs();
      try {
        const pulled = await fetch(`http://127.0.0.1:${port}/api/analyze?url=${encodeURIComponent(remoteUrl)}&client=mihomo`).then(r => r.json());
        assert.equal(pulled.ok, true);
        assert(cap.logs.some(l => l.includes('[subviz:fetch] 订阅拉取成功：HTTP 200，客户端 mihomo')), 'fetch diagnostics should be logged to console');
        assert(cap.logs.some(l => l.includes('[subviz:mihomo] 订阅已加载：解析节点 1，写入配置 1，API 可见 2，可测匹配 1，未匹配 0，转换跳过 0')), 'mihomo summary should be logged to console');
      } finally {
        cap.restore();
      }
    });
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
  assertSurgeParserHelpers();
  assertGeo();
  assertMihomoMapping();
  await assertAvailability();
  await assertLandingDoesNotInject();
  await assertAutoUserAgentShortCircuit();
  await assertFixedUserAgentNoFallback();
  assertStore();
  await assertServerRoutes();
  console.log('node-app-test ok');
})().catch(err => {
  console.error(err && err.stack || err);
  process.exit(1);
});
