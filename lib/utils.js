'use strict';

function clean(value) {
  if (value === null || value === undefined) return '';
  let v = String(value).trim();
  if ((v[0] === '"' && v[v.length - 1] === '"') || (v[0] === "'" && v[v.length - 1] === "'")) {
    v = v.slice(1, -1);
  }
  return v;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function nowIso() {
  try { return new Date().toISOString(); } catch (_) { return ''; }
}

function jsonStringify(obj, space = 2) {
  return JSON.stringify(obj, null, space);
}

function readJSONSafe(text, fallback = null) {
  try { return JSON.parse(text); } catch (_) { return fallback; }
}

function createAbortSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, Number(timeoutMs) || 10000));
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

async function fetchText(url, options = {}) {
  const timeout = Number(options.timeout || 15000);
  const { signal, cancel } = createAbortSignal(timeout);
  const started = Date.now();
  try {
    const resp = await fetch(url, {
      method: options.method || 'GET',
      headers: options.headers || { 'User-Agent': 'SubViz/0.2.0-node' },
      body: options.body,
      signal,
      redirect: options.redirect || 'follow',
    });
    const body = await resp.text();
    return {
      ok: resp.ok,
      status: resp.status,
      statusText: resp.statusText,
      headers: Object.fromEntries(resp.headers.entries()),
      body,
      latency: Date.now() - started,
    };
  } finally {
    cancel();
  }
}

function parseInteger(v, def, min, max) {
  let n = parseInt(v, 10);
  if (!Number.isFinite(n)) n = def;
  if (min !== undefined) n = Math.max(min, n);
  if (max !== undefined) n = Math.min(max, n);
  return n;
}

module.exports = { clean, sleep, nowIso, jsonStringify, readJSONSafe, createAbortSignal, fetchText, parseInteger };
