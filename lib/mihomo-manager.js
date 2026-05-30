'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const net = require('net');
const tls = require('tls');
const { spawn } = require('child_process');
const { URL } = require('url');
const { clean, sleep, fetchText, DEFAULT_USER_AGENT } = require('./utils');

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
    this.proxyInventoryCache = { ts: 0, data: null };
    this.lastBuiltProxyNames = [];
    this.lastBuiltProxyCount = 0;
    this.lastConversionSkipped = [];
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
      'User-Agent': DEFAULT_USER_AGENT,
      'Authorization': 'Bearer ' + this.apiSecret,
    }, extra);
  }

  controllerBaseURL() {
    return `http://${this.host}:${this.apiPort}`;
  }

  invalidateProxyInventory() {
    this.proxyInventoryCache = { ts: 0, data: null };
  }

  async apiFetch(method, apiPath, bodyObj, timeout = 5000, options = {}) {
    const headers = this.apiHeaders();
    let body;
    if (bodyObj !== undefined && bodyObj !== null) {
      headers['Content-Type'] = 'application/json; charset=utf-8';
      body = JSON.stringify(bodyObj);
    }
    const requestUrl = `${this.controllerBaseURL()}${apiPath}`;
    const r = await fetchText(requestUrl, { method, headers, body, timeout, signal: options.signal });
    let obj = null;
    try { obj = r.body ? JSON.parse(r.body) : null; } catch (_) { obj = r.body; }
    if (r.status < 200 || r.status >= 300) {
      const msg = obj && obj.message ? obj.message : r.body;
      const err = new Error('mihomo API HTTP ' + r.status + (msg ? '：' + msg : ''));
      err.statusCode = r.status;
      err.status = r.status;
      err.statusText = r.statusText;
      err.apiPath = apiPath;
      err.requestUrl = requestUrl;
      err.responseBody = typeof obj === 'string' ? obj : r.body;
      throw err;
    }
    return obj;
  }

  async getVersion() {
    return this.apiFetch('GET', '/version', null, 2000);
  }

  async getConfigs() {
    return this.apiFetch('GET', '/configs', null, 3000);
  }

  async getProxies() {
    return this.apiFetch('GET', '/proxies', null, 5000);
  }

  parseProxyInventory(raw) {
    const proxiesObj = raw && raw.proxies && typeof raw.proxies === 'object' ? raw.proxies : {};
    const names = Object.keys(proxiesObj);
    const entries = names.map(name => {
      const descriptor = proxiesObj[name] || {};
      return { name, type: String(descriptor.type || ''), descriptor };
    });
    const nodeEntries = entries.filter(e => isDelayTestableProxy(e.name, e.descriptor));
    const nodeNames = nodeEntries.map(e => e.name);
    const normalizedNameMap = new Map();
    const normalizedNodeNameMap = new Map();
    names.forEach(name => { const key = normalizeProxyNameKey(name); if (key && !normalizedNameMap.has(key)) normalizedNameMap.set(key, name); });
    nodeNames.forEach(name => { const key = normalizeProxyNameKey(name); if (key && !normalizedNodeNameMap.has(key)) normalizedNodeNameMap.set(key, name); });
    return {
      ok: true,
      fetchedAt: new Date().toISOString(),
      total: names.length,
      nodeCount: nodeNames.length,
      names,
      nodeNames,
      nameSet: new Set(names),
      nodeNameSet: new Set(nodeNames),
      normalizedNameMap,
      normalizedNodeNameMap,
      entries,
      nodeEntries,
      raw,
    };
  }

  async getProxyInventory(maxAgeMs = 1000) {
    const age = Date.now() - (this.proxyInventoryCache.ts || 0);
    if (this.proxyInventoryCache.data && age >= 0 && age <= Number(maxAgeMs || 0)) return this.proxyInventoryCache.data;
    const raw = await this.getProxies();
    const data = this.parseProxyInventory(raw);
    this.proxyInventoryCache = { ts: Date.now(), data };
    return data;
  }

  findLoadedProxyName(name, node, inventory) {
    const inv = inventory || this.proxyInventoryCache.data || { nameSet: new Set(), nodeNameSet: new Set(), normalizedNameMap: new Map(), normalizedNodeNameMap: new Map() };
    const nodeSet = inv.nodeNameSet || new Set();
    const allSet = inv.nameSet || new Set();
    const normalizedNodeMap = inv.normalizedNodeNameMap || new Map();
    const normalizedAllMap = inv.normalizedNameMap || new Map();
    const candidates = [];
    const add = value => {
      value = clean(value);
      if (value && !candidates.includes(value)) candidates.push(value);
    };
    const addResolved = value => {
      value = clean(value);
      if (!value) return;
      add(this.resolveNodeName(value, node));
      add(value);
    };
    addResolved(name);
    if (node && typeof node === 'object') {
      addResolved(node.name);
      addResolved(node.originalName);
      addResolved(node.rawName);
      addResolved(node.nameBeforeAlive);
      if (node.extra) addResolved(node.extra.name);
    }
    const foundNode = candidates.find(v => nodeSet.has(v));
    const normalizedNode = foundNode || candidates.map(v => normalizedNodeMap.get(normalizeProxyNameKey(v))).find(Boolean);
    const foundAnyExact = normalizedNode || candidates.find(v => allSet.has(v));
    const normalizedAny = foundAnyExact || candidates.map(v => normalizedAllMap.get(normalizeProxyNameKey(v))).find(Boolean);
    const foundAny = foundAnyExact || normalizedAny;
    return {
      found: !!normalizedNode,
      foundAny: !!foundAny,
      name: normalizedNode || foundAny || candidates[0] || '',
      candidates,
      displayName: clean(node && node.name || name),
      rawName: clean(node && (node.rawName || node.originalName || node.nameBeforeAlive) || name),
    };
  }

  delayRequestPath(proxyName, testURL, timeout) {
    return '/proxies/' + encodeURIComponent(proxyName) + '/delay?url=' + encodeURIComponent(testURL) + '&timeout=' + encodeURIComponent(String(timeout || 3000));
  }

  async describeController() {
    const out = {
      ok: true,
      controller: this.controllerBaseURL(),
      ports: { mixed: this.mixedPort, socks: this.socksPort, http: this.httpPort, api: this.apiPort },
      secretConfigured: !!this.apiSecret,
    };
    const [version, configs, inventory] = await Promise.allSettled([this.getVersion(), this.getConfigs(), this.getProxyInventory(0)]);
    out.version = version.status === 'fulfilled' ? version.value : { error: String(version.reason && version.reason.message || version.reason) };
    out.configs = configs.status === 'fulfilled' ? configs.value : { error: String(configs.reason && configs.reason.message || configs.reason) };
    out.proxies = inventory.status === 'fulfilled' ? { total: inventory.value.total, nodeCount: inventory.value.nodeCount, sample: inventory.value.nodeNames.slice(0, 20) } : { error: String(inventory.reason && inventory.reason.message || inventory.reason) };
    return out;
  }

  async diagnoseNodes(nodes) {
    nodes = Array.isArray(nodes) ? nodes : [];
    const inventory = await this.getProxyInventory(0);
    let matched = 0;
    let exact = 0;
    const missing = [];
    const matchedNames = new Set();
    for (const node of nodes) {
      const match = this.findLoadedProxyName(node && node.name, node, inventory);
      if (match.found) {
        matched++;
        matchedNames.add(match.name);
        if (match.name === clean(node && node.name)) exact++;
      } else {
        missing.push({
          displayName: clean(node && node.name),
          rawName: clean(node && (node.rawName || node.originalName || node.nameBeforeAlive)),
          mihomoApiName: match.name,
          candidates: match.candidates.slice(0, 5),
          protocol: node && node.protocol,
          server: node && node.server,
          port: node && node.port,
        });
      }
    }
    const loadedButUnmatched = inventory.nodeNames.filter(name => !matchedNames.has(name));
    const skipped = this.lastConversionSkipped || [];
    const skippedReasons = {};
    skipped.forEach(item => { skippedReasons[item.reason || 'unknown'] = (skippedReasons[item.reason || 'unknown'] || 0) + 1; });
    return {
      parsedCount: nodes.length,
      writtenCount: this.lastBuiltProxyCount,
      mihomoProxyTotal: inventory.total,
      mihomoNodeCount: inventory.nodeCount,
      testableCount: matched,
      missingCount: missing.length,
      loadedButUnmatchedCount: loadedButUnmatched.length,
      exactNameMatchCount: exact,
      suspectedNameMismatchCount: Math.max(0, matched - exact),
      conversionSkippedCount: skipped.length,
      conversionSkippedReasons: skippedReasons,
      conversionSkippedSample: skipped.slice(0, 20),
      missingSample: missing.slice(0, 20),
      loadedButUnmatchedSample: loadedButUnmatched.slice(0, 20),
    };
  }

  async injectNodes(nodes) {
    nodes = Array.isArray(nodes) ? nodes : [];
    this.currentNodes = nodes.slice();
    this.invalidateProxyInventory();
    await this.writeConfig(nodes);
    if (!(await this.isReady())) return { ok: false, error: this.lastError || 'mihomo not ready' };
    try {
      await this.apiFetch('PUT', '/configs?force=true', { path: this.configPath }, 8000);
      this.invalidateProxyInventory();
      await sleep(500);
      const diagnostics = await this.diagnoseNodes(nodes).catch(e => ({ error: String(e && e.message || e) }));
      logMihomoDebug('订阅已加载到 Mihomo：解析节点 ' + nodes.length + '，写入配置 ' + this.lastBuiltProxyCount + '，API 节点 ' + (diagnostics.mihomoNodeCount || 0) + '，可匹配测速 ' + (diagnostics.testableCount || 0) + '，未加载/未匹配 ' + (diagnostics.missingCount || 0));
      if (diagnostics.missingCount) logMihomoDebug('未加载/未匹配节点样例', diagnostics.missingSample);
      return { ok: true, count: this.currentNodes.length, writtenCount: this.lastBuiltProxyCount, diagnostics };
    } catch (e) {
      this.lastError = String(e && e.message || e);
      return { ok: false, error: this.lastError, parsedCount: nodes.length, writtenCount: this.lastBuiltProxyCount };
    }
  }

  buildProxies(nodes) {
    const proxies = [];
    const skipped = [];
    this.nodeNameMap.clear();
    this.nodeFingerprintMap.clear();
    const seen = new Map();
    for (const node of nodes || []) {
      const p = this.nodeToMihomoProxy(node);
      let reason = '';
      if (!p) reason = 'unsupported_protocol';
      else if (!p.name) reason = 'missing_name';
      else if (!p.server) reason = 'missing_server';
      else if (!p.port) reason = 'missing_port';
      if (reason) {
        skipped.push({
          reason,
          name: clean(node && node.name),
          rawName: clean(node && (node.rawName || node.originalName || node.nameBeforeAlive)),
          protocol: clean(node && node.protocol),
          server: clean(node && node.server),
          port: clean(node && node.port),
        });
        continue;
      }
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
    this.lastConversionSkipped = skipped;
    return proxies;
  }

  async writeConfig(nodes) {
    fs.mkdirSync(this.configDir, { recursive: true });
    const proxies = this.buildProxies(nodes);
    const names = proxies.map(p => p.name);
    this.lastBuiltProxyNames = names.slice();
    this.lastBuiltProxyCount = names.length;
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
      rules: ['MATCH,' + this.groupName],
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
      if (options.signal && options.signal.aborted) {
        const err = new Error('aborted');
        err.name = 'AbortError';
        throw err;
      }
      if (!(await this.isReady())) throw new Error(this.lastError || 'mihomo 未启动或 API 不可用');
      const actualName = this.resolveNodeName(nodeName, options.node);
      if (!actualName) throw new Error('missing node name');
      await this.apiFetch('PUT', '/proxies/' + encodeURIComponent(this.groupName), { name: actualName }, 5000, { signal: options.signal });
      await sleep(80);
      return fetchThroughHttpProxy(targetURL, {
        proxyHost: this.host,
        proxyPort: this.httpPort || this.mixedPort,
        timeout: options.timeout || 5000,
        headers: Object.assign({ 'User-Agent': DEFAULT_USER_AGENT }, options.headers || {}),
        method: options.method || 'GET',
        body: options.body,
        signal: options.signal,
      });
    });
  }

  async testDelay(nodeName, testURL, timeout, node, options = {}) {
    if (options.signal && options.signal.aborted) {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    }
    if (!(await this.isReady())) throw new Error(this.lastError || 'mihomo 未启动或 API 不可用');
    const actualName = this.resolveNodeName(nodeName, node);
    const api = this.delayRequestPath(actualName, testURL, timeout);
    const started = Date.now();
    const obj = await this.apiFetch('GET', api, null, Number(timeout || 3000) + 1500, { signal: options.signal });
    const latency = Number(obj && (obj.delay || obj.latency)) || (Date.now() - started);
    return { ok: true, alive: true, latency, nodeName: actualName, requestPath: api, requestUrl: this.controllerBaseURL() + api, raw: obj };
  }
}

function truthy(v) {
  if (v === true || v === 1) return true;
  const s = String(v == null ? '' : v).trim().toLowerCase();
  if (/^(true|1|yes|y|on|tls|reality)$/i.test(s)) return true;
  if (/^(false|0|no|n|off)$/i.test(s)) return false;
  return false;
}

function logMihomoDebug(message, data, force) {
  if (!force && !process.env.SUBVIZ_DEBUG_MIHOMO && !process.env.SUBVIZ_DEBUG) return;
  const line = '[subviz:mihomo] ' + message;
  if (data !== undefined && data !== null) console.log(line, data);
  else console.log(line);
}

function normalizeProxyNameKey(name) {
  let v = clean(name).toLowerCase();
  try { v = v.normalize('NFKC'); } catch (_) {}
  return v
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/[\uD83C-\uDBFF][\uDC00-\uDFFF]/g, '')
    .replace(/[\s\-_#：:|｜/\\()[\]{}<>《》【】,，.;；]+/g, '')
    .trim();
}

function isBuiltInProxyName(name) {
  return ['DIRECT', 'REJECT', 'REJECT-DROP', 'GLOBAL', 'PASS'].includes(String(name || '').toUpperCase());
}

function isProxyGroupDescriptor(desc) {
  desc = desc || {};
  if (Array.isArray(desc.all)) return true;
  const type = String(desc.type || '').toLowerCase().replace(/[\s_-]+/g, '');
  return ['selector', 'select', 'urltest', 'fallback', 'loadbalance', 'loadbalancing', 'relay', 'ssid', 'fallback'].includes(type);
}

function isDelayTestableProxy(name, desc) {
  if (!name || isBuiltInProxyName(name)) return false;
  if (isProxyGroupDescriptor(desc)) return false;
  return true;
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
    case 'hysteria': {
      const out = {
        ...base,
        type: 'hysteria',
        'auth-str': clean(e['auth-str'] || e.authStr || e.auth || e.password),
        obfs: clean(e.obfs),
        protocol: clean(e.protocol) || 'udp',
        up: clean(e.up || e.upmbps || e['up-mbps']),
        down: clean(e.down || e.downmbps || e['down-mbps']),
        sni: clean(e.sni || e.servername),
        alpn: Array.isArray(e.alpn) ? e.alpn : (e.alpn ? String(e.alpn).split(/[|,]/).map(clean).filter(Boolean) : undefined),
        'skip-cert-verify': truthy(e['skip-cert-verify'] || e.insecure),
      };
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
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : JSON.stringify(String(value));
  if (typeof value === 'boolean') return String(value);
  // Always quote strings when generating Mihomo YAML.
  // The old plain-scalar shortcut left values such as passwords beginning with
  // "@" unquoted, which makes Mihomo reject the whole generated config with:
  // "yaml: found character that cannot start any token".  A rejected config
  // means /proxies never contains the subscription nodes, so every availability
  // check becomes node_not_found_in_mihomo even when the nodes are actually valid.
  return JSON.stringify(String(value == null ? '' : value));
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
  const signal = options.signal;
  const abortError = () => { const err = new Error('aborted'); err.name = 'AbortError'; return err; };

  if (url.protocol === 'http:') {
    return new Promise((resolve, reject) => {
      if (signal && signal.aborted) return reject(abortError());
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
        res.on('end', () => {
          cleanup();
          resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8'), latency: Date.now() - started });
        });
      });
      const abort = () => req.destroy(abortError());
      const cleanup = () => { if (signal && signal.removeEventListener) signal.removeEventListener('abort', abort); };
      if (signal && signal.addEventListener) signal.addEventListener('abort', abort, { once: true });
      req.on('timeout', () => req.destroy(new Error('timeout')));
      req.on('error', err => { cleanup(); reject(err); });
      if (options.body) req.write(options.body);
      req.end();
    });
  }

  if (url.protocol === 'https:') {
    return new Promise((resolve, reject) => {
      if (signal && signal.aborted) return reject(abortError());
      const socket = net.connect(proxyPort, proxyHost);
      let settled = false;
      let secure = null;
      let req = null;
      const cleanup = () => { if (signal && signal.removeEventListener) signal.removeEventListener('abort', abort); };
      const fail = err => {
        if (settled) return;
        settled = true;
        cleanup();
        try { if (req) req.destroy(); } catch (_) {}
        try { if (secure) secure.destroy(); } catch (_) {}
        try { socket.destroy(); } catch (_) {}
        reject(err);
      };
      const abort = () => fail(abortError());
      if (signal && signal.addEventListener) signal.addEventListener('abort', abort, { once: true });
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
        secure = tls.connect({ socket, servername: url.hostname, rejectUnauthorized: false }, () => {
          const reqPath = (url.pathname || '/') + (url.search || '');
          req = https.request({
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
              if (settled) return;
              settled = true;
              cleanup();
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
