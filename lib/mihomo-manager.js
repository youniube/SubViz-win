'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const net = require('net');
const tls = require('tls');
const { spawn } = require('child_process');
const { URL } = require('url');
const { clean, sleep, fetchText } = require('./utils');

class AsyncQueue {
  constructor() {
    this.queue = [];
    this.running = false;
  }

  enqueue(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.running || !this.queue.length) return;
    this.running = true;
    const item = this.queue.shift();
    try { item.resolve(await item.fn()); }
    catch (e) { item.reject(e); }
    finally {
      this.running = false;
      this.process();
    }
  }
}

class MihomoManager {
  constructor(options = {}) {
    this.rootDir = options.rootDir || path.join(__dirname, '..');
    this.configDir = options.configDir || path.join(this.rootDir, 'mihomo');
    this.binaryPath = options.binaryPath || path.join(this.configDir, process.platform === 'win32' ? 'mihomo.exe' : 'mihomo');
    this.host = options.host || '127.0.0.1';
    this.mixedPort = Number(options.mixedPort || 17890);
    this.socksPort = Number(options.socksPort || 17891);
    this.httpPort = Number(options.httpPort || 17892);
    this.apiPort = Number(options.apiPort || 19090);
    this.apiSecret = options.apiSecret || 'subviz-internal';
    this.groupName = options.groupName || 'subviz-select';
    this.process = null;
    this.ready = false;
    this.lastError = '';
    this.nodeNameMap = new Map();
    this.nodeFingerprintMap = new Map();
    this.currentNodes = [];
    this.queue = new AsyncQueue();
    this.autoRestart = options.autoRestart !== false;
    this.disabled = !!options.disabled || process.env.SUBVIZ_NO_MIHOMO === '1';
  }

  get configPath() {
    return path.join(this.configDir, 'config.yaml');
  }

  async start() {
    if (this.disabled) {
      this.lastError = 'mihomo disabled by SUBVIZ_NO_MIHOMO';
      this.ready = false;
      await this.writeConfig([]);
      return false;
    }
    fs.mkdirSync(this.configDir, { recursive: true });
    await this.writeConfig(this.currentNodes);
    if (!fs.existsSync(this.binaryPath)) {
      this.lastError = '未找到 mihomo 二进制：' + this.binaryPath;
      this.ready = false;
      return false;
    }
    if (this.process && !this.process.killed) {
      this.ready = await this.isReady();
      return this.ready;
    }
    try {
      this.process = spawn(this.binaryPath, ['-d', this.configDir], {
        cwd: this.configDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
      this.process.stdout.on('data', d => {
        if (process.env.SUBVIZ_DEBUG_MIHOMO) process.stdout.write('[mihomo] ' + d.toString());
      });
      this.process.stderr.on('data', d => {
        const msg = d.toString();
        this.lastError = msg.trim() || this.lastError;
        if (process.env.SUBVIZ_DEBUG_MIHOMO) process.stderr.write('[mihomo] ' + msg);
      });
      this.process.on('exit', (code, signal) => {
        this.ready = false;
        if (code || signal) this.lastError = 'mihomo 已退出：' + (signal || code);
        this.process = null;
        if (this.autoRestart && !this.disabled) {
          setTimeout(() => this.start().catch(() => {}), 1500);
        }
      });
      this.ready = await this.waitReady(10000);
      return this.ready;
    } catch (e) {
      this.ready = false;
      this.lastError = String(e && e.message || e);
      return false;
    }
  }

  async stop() {
    this.autoRestart = false;
    if (this.process && !this.process.killed) {
      const p = this.process;
      await new Promise(resolve => {
        const timer = setTimeout(resolve, 1500);
        p.once('exit', () => { clearTimeout(timer); resolve(); });
        try { p.kill(); } catch (_) { resolve(); }
      });
    }
    this.process = null;
    this.ready = false;
  }

  async isReady() {
    try {
      const r = await fetchText(`http://${this.host}:${this.apiPort}/`, {
        timeout: 1000,
        headers: this.apiHeaders(),
      });
      this.ready = r.status >= 200 && r.status < 500;
      return this.ready;
    } catch (e) {
      this.ready = false;
      if (!this.lastError) this.lastError = String(e && e.message || e);
      return false;
    }
  }

  async waitReady(timeoutMs) {
    const deadline = Date.now() + Number(timeoutMs || 10000);
    while (Date.now() < deadline) {
      if (await this.isReady()) return true;
      await sleep(250);
    }
    this.lastError = this.lastError || 'mihomo API 启动超时';
    return false;
  }

  apiHeaders(extra = {}) {
    return Object.assign({
      'User-Agent': 'SubViz/0.2.0-node',
      'Authorization': 'Bearer ' + this.apiSecret,
    }, extra);
  }

  async apiFetch(method, apiPath, bodyObj, timeout = 5000) {
    const headers = this.apiHeaders();
    let body;
    if (bodyObj !== undefined && bodyObj !== null) {
      headers['Content-Type'] = 'application/json; charset=utf-8';
      body = JSON.stringify(bodyObj);
    }
    const r = await fetchText(`http://${this.host}:${this.apiPort}${apiPath}`, { method, headers, body, timeout });
    let obj = null;
    try { obj = r.body ? JSON.parse(r.body) : null; } catch (_) { obj = r.body; }
    if (r.status < 200 || r.status >= 300) {
      const msg = obj && obj.message ? obj.message : r.body;
      throw new Error('mihomo API HTTP ' + r.status + (msg ? '：' + msg : ''));
    }
    return obj;
  }

  async injectNodes(nodes) {
    nodes = Array.isArray(nodes) ? nodes : [];
    this.currentNodes = nodes.slice();
    await this.writeConfig(nodes);
    if (!(await this.isReady())) return { ok: false, error: this.lastError || 'mihomo not ready' };
    try {
      await this.apiFetch('PUT', '/configs?force=true', { path: this.configPath }, 8000);
      await sleep(300);
      return { ok: true, count: this.currentNodes.length };
    } catch (e) {
      this.lastError = String(e && e.message || e);
      return { ok: false, error: this.lastError };
    }
  }

  buildProxies(nodes) {
    const proxies = [];
    this.nodeNameMap.clear();
    this.nodeFingerprintMap.clear();
    const seen = new Map();
    for (const node of nodes || []) {
      const p = this.nodeToMihomoProxy(node);
      if (!p || !p.name || !p.server || !p.port) continue;
      const originalName = p.name;
      const baseName = originalName || `${p.server}:${p.port}`;
      let uniqueName = baseName;
      const count = seen.get(baseName) || 0;
      if (count > 0) uniqueName = `${baseName} (${count + 1})`;
      seen.set(baseName, count + 1);
      p.name = uniqueName;
      proxies.push(p);
      if (!this.nodeNameMap.has(originalName)) this.nodeNameMap.set(originalName, uniqueName);
      if (node && node.fingerprint) this.nodeFingerprintMap.set(node.fingerprint, uniqueName);
    }
    return proxies;
  }

  async writeConfig(nodes) {
    fs.mkdirSync(this.configDir, { recursive: true });
    const proxies = this.buildProxies(nodes);
    const names = proxies.map(p => p.name);
    const config = {
      'mixed-port': this.mixedPort,
      'socks-port': this.socksPort,
      'port': this.httpPort,
      'external-controller': `${this.host}:${this.apiPort}`,
      secret: this.apiSecret,
      'allow-lan': false,
      mode: 'rule',
      'log-level': 'warning',
      ipv6: false,
      proxies,
      'proxy-groups': [{ name: this.groupName, type: 'select', proxies: ['DIRECT'].concat(names) }],
      rules: ['MATCH,DIRECT'],
    };
    fs.writeFileSync(this.configPath, toYAML(config), 'utf8');
    return this.configPath;
  }

  resolveNodeName(name, node) {
    if (node && node.fingerprint && this.nodeFingerprintMap.has(node.fingerprint)) return this.nodeFingerprintMap.get(node.fingerprint);
    return this.nodeNameMap.get(name) || name;
  }

  nodeToMihomoProxy(node) {
    return nodeToMihomoProxy(node);
  }

  async requestViaNode(nodeName, targetURL, options = {}) {
    return this.queue.enqueue(async () => {
      if (!(await this.isReady())) throw new Error(this.lastError || 'mihomo 未启动或 API 不可用');
      const actualName = this.resolveNodeName(nodeName, options.node);
      if (!actualName) throw new Error('missing node name');
      await this.apiFetch('PUT', '/proxies/' + encodeURIComponent(this.groupName), { name: actualName }, 5000);
      await sleep(80);
      return fetchThroughHttpProxy(targetURL, {
        proxyHost: this.host,
        proxyPort: this.httpPort || this.mixedPort,
        timeout: options.timeout || 5000,
        headers: options.headers || { 'User-Agent': 'SubViz/0.2.0-node' },
        method: options.method || 'GET',
        body: options.body,
      });
    });
  }

  async testDelay(nodeName, testURL, timeout, node) {
    if (!(await this.isReady())) throw new Error(this.lastError || 'mihomo 未启动或 API 不可用');
    const actualName = this.resolveNodeName(nodeName, node);
    const api = '/proxies/' + encodeURIComponent(actualName) + '/delay?url=' + encodeURIComponent(testURL) + '&timeout=' + encodeURIComponent(String(timeout || 3000));
    const started = Date.now();
    const obj = await this.apiFetch('GET', api, null, Number(timeout || 3000) + 1500);
    const latency = Number(obj && (obj.delay || obj.latency)) || (Date.now() - started);
    return { ok: true, alive: true, latency, nodeName: actualName, raw: obj };
  }
}

function truthy(v) {
  return v === true || v === 1 || String(v).toLowerCase() === 'true' || String(v).toLowerCase() === 'tls' || String(v).toLowerCase() === '1';
}

function cleanObj(obj) {
  const out = {};
  Object.keys(obj || {}).forEach(k => {
    const v = obj[k];
    if (v === undefined || v === null || v === '') return;
    if (Array.isArray(v) && !v.length) return;
    if (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length) return;
    out[k] = v;
  });
  return out;
}

function intPort(value) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : 0;
}

function nodeToMihomoProxy(node) {
  node = node || {};
  const e = node.extra || {};
  const protocol = clean(node.protocol || e.type).toLowerCase();
  const network = clean(e.network || node.network || e.net).toLowerCase();
  const tlsOn = truthy(e.tls || node.tls || e.security) || clean(e.security).toLowerCase() === 'reality';
  const base = {
    name: clean(node.name || e.name || `${node.server}:${node.port}`),
    server: clean(node.server || e.server),
    port: intPort(node.port || e.port),
  };

  switch (protocol) {
    case 'ss':
    case 'shadowsocks': {
      const out = { ...base, type: 'ss', cipher: clean(e.cipher || e.method), password: clean(e.password), udp: true };
      if (network === 'ws') {
        out.plugin = 'v2ray-plugin';
        out['plugin-opts'] = { mode: 'websocket', host: clean(e.Host || e.host), path: clean(e.path || '/'), tls: tlsOn };
      }
      return cleanObj(out);
    }
    case 'vmess': {
      const out = { ...base, type: 'vmess', uuid: clean(e.uuid || e.id), alterId: parseInt(e.alterId || e.aid || '0', 10) || 0, cipher: clean(e.cipher) || 'auto', udp: true, tls: tlsOn, servername: clean(e.sni || e.servername), 'skip-cert-verify': truthy(e['skip-cert-verify'] || e.insecure), network: network || 'tcp' };
      if (out.network === 'ws') out['ws-opts'] = { path: clean(e.path || '/'), headers: cleanObj({ Host: clean(e.Host || e.host) }) };
      if (out.network === 'grpc') out['grpc-opts'] = { 'grpc-service-name': clean(e['grpc-service-name'] || e.serviceName) };
      return cleanObj(out);
    }
    case 'vless': {
      const reality = clean(e.security).toLowerCase() === 'reality' || clean(e['reality-public-key']);
      const out = { ...base, type: 'vless', uuid: clean(e.uuid || e.id), udp: true, tls: tlsOn || reality, servername: clean(e.sni || e.servername), 'skip-cert-verify': truthy(e['skip-cert-verify'] || e.insecure), network: network || 'tcp', flow: clean(e.flow) };
      if (out.network === 'ws') out['ws-opts'] = { path: clean(e.path || '/'), headers: cleanObj({ Host: clean(e.Host || e.host) }) };
      if (out.network === 'grpc') out['grpc-opts'] = { 'grpc-service-name': clean(e['grpc-service-name'] || e.serviceName) };
      if (reality) {
        out['reality-opts'] = { 'public-key': clean(e['reality-public-key'] || e['public-key'] || e.pbk), 'short-id': clean(e['reality-short-id'] || e['short-id'] || e.sid) };
        out['client-fingerprint'] = clean(e['client-fingerprint'] || e.fingerprint || e.fp || 'chrome');
      }
      return cleanObj(out);
    }
    case 'trojan': {
      const out = { ...base, type: 'trojan', password: clean(e.password), udp: true, sni: clean(e.sni || e.servername), 'skip-cert-verify': truthy(e['skip-cert-verify'] || e.insecure) };
      if (network === 'ws') Object.assign(out, { network: 'ws', 'ws-opts': { path: clean(e.path || '/'), headers: cleanObj({ Host: clean(e.Host || e.host) }) } });
      if (network === 'grpc') Object.assign(out, { network: 'grpc', 'grpc-opts': { 'grpc-service-name': clean(e['grpc-service-name'] || e.serviceName) } });
      return cleanObj(out);
    }
    case 'hysteria2':
    case 'hy2': {
      const out = { ...base, type: 'hysteria2', password: clean(e.password || e.auth), sni: clean(e.sni || e.servername), 'skip-cert-verify': truthy(e['skip-cert-verify'] || e.insecure) };
      if (e.obfs) { out.obfs = clean(e.obfs); out['obfs-password'] = clean(e['obfs-password'] || e.obfsPassword); }
      return cleanObj(out);
    }
    case 'tuic': {
      const alpn = e.alpn ? (Array.isArray(e.alpn) ? e.alpn : String(e.alpn).split(/[|,]/).map(clean).filter(Boolean)) : ['h3'];
      return cleanObj({ ...base, type: 'tuic', uuid: clean(e.uuid || e.id), password: clean(e.password), sni: clean(e.sni || e.servername), 'skip-cert-verify': truthy(e['skip-cert-verify'] || e.insecure), alpn });
    }
    case 'snell':
      return cleanObj({ ...base, type: 'snell', psk: clean(e.psk || e.password), version: parseInt(e.version || '4', 10) || 4, 'obfs-opts': e.mode ? { mode: clean(e.mode), host: clean(e.Host || e.host) } : undefined });
    case 'socks':
    case 'socks5':
      return cleanObj({ ...base, type: 'socks5', username: clean(e.username), password: clean(e.password), udp: true, 'skip-cert-verify': truthy(e['skip-cert-verify'] || e.insecure) });
    case 'http':
    case 'https':
      return cleanObj({ ...base, type: 'http', username: clean(e.username), password: clean(e.password), tls: protocol === 'https', 'skip-cert-verify': truthy(e['skip-cert-verify'] || e.insecure) });
    case 'anytls':
      return cleanObj({ ...base, type: 'anytls', password: clean(e.password), sni: clean(e.sni || e.servername), 'skip-cert-verify': truthy(e['skip-cert-verify'] || e.insecure) });
    default:
      return null;
  }
}

function yamlQuote(value) {
  if (value === '') return '""';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  const s = String(value);
  if (/^[A-Za-z0-9_.:@/+,-]+$/.test(s) && !/^(true|false|null|yes|no|on|off)$/i.test(s)) return s;
  return JSON.stringify(s);
}

function toYAML(value, indent = 0) {
  const sp = ' '.repeat(indent);
  if (Array.isArray(value)) {
    if (!value.length) return '[]\n';
    return value.map(item => {
      if (item && typeof item === 'object') {
        const rendered = toYAML(item, indent + 2).replace(/\n$/, '').split('\n');
        const first = rendered[0].slice(indent + 2);
        return sp + '- ' + first + (rendered.length > 1 ? '\n' + rendered.slice(1).join('\n') : '');
      }
      return sp + '- ' + yamlQuote(item);
    }).join('\n') + '\n';
  }
  if (value && typeof value === 'object') {
    const lines = [];
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;
      if (Array.isArray(v)) {
        if (!v.length) lines.push(sp + k + ': []');
        else lines.push(sp + k + ':\n' + toYAML(v, indent + 2).replace(/\n$/, ''));
      } else if (v && typeof v === 'object') {
        lines.push(sp + k + ':\n' + toYAML(v, indent + 2).replace(/\n$/, ''));
      } else {
        lines.push(sp + k + ': ' + yamlQuote(v));
      }
    }
    return lines.join('\n') + '\n';
  }
  return sp + yamlQuote(value) + '\n';
}

function fetchThroughHttpProxy(targetURL, options = {}) {
  const url = new URL(targetURL);
  const started = Date.now();
  const timeout = Number(options.timeout || 5000);
  const method = options.method || 'GET';
  const headers = Object.assign({}, options.headers || {});
  const proxyHost = options.proxyHost || '127.0.0.1';
  const proxyPort = Number(options.proxyPort || 17892);

  if (url.protocol === 'http:') {
    return new Promise((resolve, reject) => {
      const req = http.request({
        host: proxyHost,
        port: proxyPort,
        method,
        path: targetURL,
        headers: Object.assign({ Host: url.host }, headers),
        timeout,
      }, res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8'), latency: Date.now() - started }));
      });
      req.on('timeout', () => req.destroy(new Error('timeout')));
      req.on('error', reject);
      if (options.body) req.write(options.body);
      req.end();
    });
  }

  if (url.protocol === 'https:') {
    return new Promise((resolve, reject) => {
      const socket = net.connect(proxyPort, proxyHost);
      let settled = false;
      const fail = err => {
        if (settled) return;
        settled = true;
        try { socket.destroy(); } catch (_) {}
        reject(err);
      };
      socket.setTimeout(timeout, () => fail(new Error('timeout')));
      socket.once('error', fail);
      socket.once('connect', () => {
        socket.write(`CONNECT ${url.hostname}:${url.port || 443} HTTP/1.1\r\nHost: ${url.hostname}:${url.port || 443}\r\nProxy-Connection: Keep-Alive\r\n\r\n`);
      });
      let handshake = Buffer.alloc(0);
      socket.on('data', chunk => {
        if (settled) return;
        handshake = Buffer.concat([handshake, chunk]);
        const idx = handshake.indexOf('\r\n\r\n');
        if (idx < 0) return;
        const head = handshake.slice(0, idx).toString('latin1');
        const rest = handshake.slice(idx + 4);
        if (!/^HTTP\/1\.[01] 200/i.test(head)) return fail(new Error('proxy CONNECT failed: ' + head.split('\r\n')[0]));
        socket.removeAllListeners('data');
        socket.removeAllListeners('error');
        const secure = tls.connect({ socket, servername: url.hostname, rejectUnauthorized: false }, () => {
          const reqPath = (url.pathname || '/') + (url.search || '');
          const req = https.request({
            createConnection: () => secure,
            host: url.hostname,
            servername: url.hostname,
            port: url.port || 443,
            method,
            path: reqPath,
            headers: Object.assign({ Host: url.host, Connection: 'close' }, headers),
            timeout,
            rejectUnauthorized: false,
          }, res => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
              settled = true;
              resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8'), latency: Date.now() - started });
            });
          });
          req.on('timeout', () => req.destroy(new Error('timeout')));
          req.on('error', fail);
          if (rest.length) secure.unshift(rest);
          if (options.body) req.write(options.body);
          req.end();
        });
        secure.once('error', fail);
      });
    });
  }

  return Promise.reject(new Error('unsupported target protocol: ' + url.protocol));
}

module.exports = { MihomoManager, AsyncQueue, nodeToMihomoProxy, toYAML, fetchThroughHttpProxy };
