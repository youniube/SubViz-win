'use strict';

const { sleep } = require('./utils');

function availabilityStatusOK(status, expr) {
  status = Number(status || 0);
  expr = String(expr || '204').trim();
  if (!expr) return status >= 200 && status < 400;
  const parts = expr.split(/[|,\s]+/).filter(Boolean);
  for (const p of parts) {
    if (/^\d{3}$/.test(p) && status === Number(p)) return true;
    if (/^[1-5]xx$/i.test(p)) {
      const start = Number(p[0]) * 100;
      if (status >= start && status <= start + 99) return true;
    }
    const m = p.match(/^(\d{3})-(\d{3})$/);
    if (m && status >= Number(m[1]) && status <= Number(m[2])) return true;
  }
  return false;
}

function firstExpectedStatus(expr) {
  expr = String(expr || '204');
  const code = expr.match(/\b\d{3}\b/);
  if (code) return Number(code[0]);
  const klass = expr.match(/\b([1-5])xx\b/i);
  if (klass) return Number(klass[1]) * 100;
  return 204;
}

function httpStatusFromError(e) {
  if (!e) return 0;
  if (e.statusCode) return Number(e.statusCode) || 0;
  if (e.status) return Number(e.status) || 0;
  const m = String(e.message || e).match(/HTTP\s+(\d{3})/i);
  return m ? Number(m[1]) : 0;
}

function classifyDelayError(e) {
  const statusCode = httpStatusFromError(e);
  const text = String((e && e.message) || e || '检测失败');
  const lower = text.toLowerCase();
  if (statusCode === 404) {
    return {
      category: 'api_not_found',
      reason: 'node_not_found_in_mihomo',
      statusCode,
      shouldCountAsDead: false,
      error: 'node_not_found_in_mihomo',
      rawError: text,
    };
  }
  if (lower.includes('timeout') || text.includes('超时') || (e && e.name === 'AbortError')) {
    return {
      category: 'timeout',
      statusCode,
      shouldCountAsDead: true,
      error: '测速超时',
      rawError: text,
    };
  }
  if (statusCode === 503) {
    return {
      category: 'unavailable',
      statusCode,
      shouldCountAsDead: true,
      error: text,
      rawError: text,
    };
  }
  return {
    category: statusCode ? 'api_error' : 'unknown_error',
    statusCode,
    shouldCountAsDead: true,
    error: text,
    rawError: text,
  };
}

function availabilityDebugLog(message, payload) {
  if (!process.env.SUBVIZ_DEBUG_MIHOMO && !process.env.SUBVIZ_DEBUG) return;
  if (payload !== undefined) console.log('[subviz:availability] ' + message, payload);
  else console.log('[subviz:availability] ' + message);
}

function availabilityLogSample(index, total) {
  if (process.env.SUBVIZ_DEBUG === '1' || process.env.SUBVIZ_DEBUG_MIHOMO === '1') return true;
  index = Number(index || 0);
  total = Number(total || 0);
  if (!total) return true;
  return index <= 3 || index === total || index % 10 === 0;
}

function availabilityMihomoLog(message, options) {
  options = options || {};
  if (!availabilityLogSample(options.requestIndex, options.requestTotal)) return;
  console.log('[subviz:availability:mihomo] ' + message);
}
function isAborted(signal) { return !!(signal && signal.aborted); }

function sleepOrAbort(ms, signal) {
  if (!ms || ms <= 0 || !signal) return sleep(ms);
  if (isAborted(signal)) return Promise.resolve();
  return new Promise(resolve => {
    let timer = null;
    const done = () => {
      if (timer) clearTimeout(timer);
      if (signal && signal.removeEventListener) signal.removeEventListener('abort', done);
      resolve();
    };
    timer = setTimeout(done, Math.max(0, Number(ms) || 0));
    if (signal && signal.addEventListener) signal.addEventListener('abort', done, { once: true });
  });
}
function cancelledResult(node, startedAll) { return { ok: false, alive: false, cancelled: true, category: 'cancelled', error: '测活已取消', shouldCountAsDead: false, latency: Date.now() - (startedAll || Date.now()), totalLatency: Date.now() - (startedAll || Date.now()), attempts: 0, protocol: node && node.protocol, server: node && node.server, port: node && node.port }; }

async function availabilityCheck(node, options = {}) {
  if (!node || typeof node !== 'object') return { ok: false, alive: false, category: 'invalid_node', error: 'missing node', shouldCountAsDead: false };
  const mihomoManager = options.mihomoManager;
  if (!mihomoManager) return { ok: false, alive: false, category: 'internal_error', error: 'missing mihomo manager', shouldCountAsDead: true };
  const url = options.url || 'http://connectivitycheck.platform.hicloud.com/generate_204';
  const statusExpr = options.statusExpr || options.status || '204';
  const timeout = Number(options.timeout || 3000);
  const retries = Math.max(0, Number(options.retries || 0));
  const retryDelay = Math.max(0, Number(options.retryDelay || options.retry_delay || 1000));
  const startedAll = Date.now();
  const signal = options.signal;
  const requestIndex = options.requestIndex || 0;
  const requestTotal = options.requestTotal || 0;
  if (isAborted(signal)) return cancelledResult(node, startedAll);
  const displayName = String(node.name || '');
  const rawName = String(node.rawName || node.originalName || node.nameBeforeAlive || node.name || '');

  let inventory;
  let match;
  try {
    if (isAborted(signal)) return cancelledResult(node, startedAll);
    if (!(await mihomoManager.isReady())) throw new Error(mihomoManager.lastError || 'mihomo 未启动或 API 不可用');
    inventory = await mihomoManager.getProxyInventory(1000);
    if (isAborted(signal)) return cancelledResult(node, startedAll);
    match = mihomoManager.findLoadedProxyName(node.name, node, inventory);
  } catch (e) {
    const info = classifyDelayError(e);
    availabilityMihomoLog('delay failed: node=' + (displayName || rawName || '<unnamed>') + ' reason=' + (info.error || info.category || 'api_error'), { requestIndex, requestTotal });
    return {
      ok: false,
      alive: false,
      category: info.category === 'api_not_found' ? 'api_not_found' : 'api_error',
      reason: info.category || 'api_error',
      error: info.error,
      rawError: info.rawError,
      statusCode: info.statusCode,
      shouldCountAsDead: info.shouldCountAsDead,
      latency: Date.now() - startedAll,
      totalLatency: Date.now() - startedAll,
      attempts: 0,
      protocol: node.protocol,
      server: node.server,
      port: node.port,
      url,
    };
  }

  const requestPath = match && match.name ? mihomoManager.delayRequestPath(match.name, url, timeout) : '';
  const debug = {
    displayName,
    rawName,
    mihomoApiName: match && match.name,
    requestUrl: requestPath ? mihomoManager.controllerBaseURL() + requestPath : '',
    mihomoProxyTotal: inventory && inventory.total,
    mihomoNodeTotal: inventory && inventory.nodeCount,
    candidates: match && match.candidates,
  };

  if (!match || !match.found) {
    availabilityDebugLog('API 未找到节点，跳过测速', debug);
    availabilityMihomoLog('delay failed: node=' + (displayName || rawName || '<unnamed>') + ' reason=node_not_found_in_mihomo', { requestIndex, requestTotal });
    return {
      ok: false,
      alive: false,
      skipped: true,
      category: 'api_not_found',
      reason: 'node_not_found_in_mihomo',
      error: 'node_not_found_in_mihomo',
      rawError: 'proxy name not found in current Mihomo /proxies',
      statusCode: 404,
      shouldCountAsDead: false,
      latency: Date.now() - startedAll,
      totalLatency: Date.now() - startedAll,
      attempts: 0,
      protocol: node.protocol,
      server: node.server,
      port: node.port,
      url,
      displayName,
      rawName,
      mihomoApiName: match && match.name,
      requestUrl: debug.requestUrl,
      debug,
    };
  }

  let last = null;
  for (let i = 0; i <= retries; i++) {
    if (isAborted(signal)) return cancelledResult(node, startedAll);
    const started = Date.now();
    try {
      // 使用 Mihomo 原生 /proxies/{name}/delay 接口检测单个节点。
      // 旧实现会反复切换同一个 selector 后再走 HTTP 代理，请求被全局串行化，
      // 当前前端即使按 5 并发派发，第一批节点也可能长时间全部不返回，导致进度停在 0 / N。
      // /delay 是按具体代理名测活，不需要切换选择器，多个单节点请求可以真正并发返回进度。
      availabilityMihomoLog('delay start: node=' + match.name, { requestIndex, requestTotal });
      const resp = await mihomoManager.testDelay(match.name, url, timeout, node, { signal });
      const latency = resp && resp.latency || (Date.now() - started);
      availabilityMihomoLog('delay done: node=' + match.name + ' latency=' + latency, { requestIndex, requestTotal });
      const status = firstExpectedStatus(statusExpr);
      const result = {
        ok: true,
        alive: true,
        category: 'available',
        status,
        statusCode: status,
        latency,
        totalLatency: Date.now() - startedAll,
        attempts: i + 1,
        protocol: node.protocol,
        server: node.server,
        port: node.port,
        url,
        expected: statusExpr,
        displayName,
        rawName,
        mihomoApiName: resp.nodeName || match.name,
        requestUrl: resp.requestUrl || debug.requestUrl || url,
        delayRequestPath: resp.requestPath,
      };
      availabilityDebugLog('测活成功', result);
      return result;
    } catch (e) {
      if (isAborted(signal) || (e && e.name === 'AbortError')) return cancelledResult(node, startedAll);
      last = classifyDelayError(e);
      last.requestUrl = e && e.requestUrl || debug.requestUrl || url;
      last.apiPath = e && e.apiPath;
      availabilityMihomoLog('delay failed: node=' + (match.name || displayName || rawName || '<unnamed>') + ' reason=' + (last.error || last.category || 'unknown_error'), { requestIndex, requestTotal });
      // 404 是名称/加载问题，不是节点真实不可用；继续重试没有意义。
      if (last.category === 'api_not_found') break;
    }
    if (i < retries && retryDelay) {
      if (isAborted(signal)) return cancelledResult(node, startedAll);
      await sleepOrAbort(retryDelay, signal);
    }
  }

  const out = {
    ok: false,
    alive: false,
    category: last && last.category || 'unknown_error',
    reason: last && (last.reason || last.category) || 'unknown_error',
    error: last && last.error || '检测失败',
    rawError: last && last.rawError || '',
    statusCode: last && last.statusCode || 0,
    shouldCountAsDead: last ? last.shouldCountAsDead !== false : true,
    latency: Date.now() - startedAll,
    totalLatency: Date.now() - startedAll,
    attempts: retries + 1,
    protocol: node.protocol,
    server: node.server,
    port: node.port,
    url,
    expected: statusExpr,
    displayName,
    rawName,
    mihomoApiName: match.name,
    requestUrl: last && last.requestUrl || debug.requestUrl,
    debug,
  };
  availabilityDebugLog('测速失败', out);
  return out;
}

module.exports = { availabilityStatusOK, availabilityCheck, firstExpectedStatus, classifyDelayError };
