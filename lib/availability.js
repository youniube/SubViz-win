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
      statusCode,
      shouldCountAsDead: false,
      error: 'Mihomo API 未找到该节点 / 节点未加载 / 名称不匹配',
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
function isAborted(signal) { return !!(signal && signal.aborted); }
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
    return {
      ok: false,
      alive: false,
      category: info.category === 'api_not_found' ? 'api_not_found' : 'api_error',
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
    return {
      ok: false,
      alive: false,
      skipped: true,
      category: 'api_not_found',
      error: 'Mihomo API 未找到该节点 / 节点未加载 / 名称不匹配',
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
      // 使用真实 HTTP 请求检测目标 URL，并按用户配置的状态码表达式判断。
      // 注意：不能每个节点重新 reload 单节点配置，必须基于当前 /proxies 中已经加载的真实节点名。
      const resp = await mihomoManager.requestViaNode(match.name, url, { timeout, node, signal });
      const status = Number(resp && resp.status) || 0;
      const latency = resp && resp.latency || (Date.now() - started);
      if (availabilityStatusOK(status, statusExpr)) {
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
          mihomoApiName: match.name,
          requestUrl: url,
        };
        availabilityDebugLog('测活成功', result);
        return result;
      }
      last = {
        category: 'bad_status',
        statusCode: status,
        shouldCountAsDead: true,
        error: '状态码不匹配：实际 ' + status + '，期望 ' + statusExpr,
        rawError: 'HTTP ' + status,
        requestUrl: url,
      };
    } catch (e) {
      if (isAborted(signal) || (e && e.name === 'AbortError')) return cancelledResult(node, startedAll);
      last = classifyDelayError(e);
      last.requestUrl = e && e.requestUrl || debug.requestUrl || url;
      last.apiPath = e && e.apiPath;
      // 404 是名称/加载问题，不是节点真实不可用；继续重试没有意义。
      if (last.category === 'api_not_found') break;
    }
    if (i < retries && retryDelay) {
      if (isAborted(signal)) return cancelledResult(node, startedAll);
      await sleep(retryDelay);
    }
  }

  const out = {
    ok: false,
    alive: false,
    category: last && last.category || 'unknown_error',
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
