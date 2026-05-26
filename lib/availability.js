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

async function availabilityCheck(node, options = {}) {
  if (!node || typeof node !== 'object') return { ok: false, alive: false, error: 'missing node' };
  const mihomoManager = options.mihomoManager;
  if (!mihomoManager) return { ok: false, alive: false, error: 'missing mihomo manager' };
  const url = options.url || 'http://connectivitycheck.platform.hicloud.com/generate_204';
  const statusExpr = options.statusExpr || options.status || '204';
  const timeout = Number(options.timeout || 3000);
  const retries = Math.max(0, Number(options.retries || 0));
  const retryDelay = Math.max(0, Number(options.retryDelay || options.retry_delay || 1000));
  let last = '';
  const startedAll = Date.now();

  try { await mihomoManager.injectNodes([node]); } catch (_) {}

  for (let i = 0; i <= retries; i++) {
    const started = Date.now();
    try {
      // mihomo delay API is parallel-safe and much faster than switching a shared proxy group.
      const d = await mihomoManager.testDelay(node.name, url, timeout, node);
      const status = firstExpectedStatus(statusExpr);
      if (d && d.alive !== false) {
        return {
          ok: true,
          alive: true,
          status,
          latency: d.latency || (Date.now() - started),
          totalLatency: Date.now() - startedAll,
          attempts: i + 1,
          protocol: node.protocol,
          server: node.server,
          port: node.port,
          url,
        };
      }
      last = d && d.error || 'delay failed';
    } catch (e) {
      last = e && e.name === 'AbortError' ? 'timeout' : String(e && e.message || e);
    }
    if (i < retries && retryDelay) await sleep(retryDelay);
  }
  return {
    ok: false,
    alive: false,
    error: last || '检测失败',
    latency: Date.now() - startedAll,
    totalLatency: Date.now() - startedAll,
    attempts: retries + 1,
    protocol: node.protocol,
    server: node.server,
    port: node.port,
    url,
    expected: statusExpr,
  };
}

module.exports = { availabilityStatusOK, availabilityCheck, firstExpectedStatus };
