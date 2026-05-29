'use strict';

const { normalizeGeoResult } = require('./geo');
const { clean, sleep } = require('./utils');

const DEFAULT_LANDING_APIS = [
  'https://ipwho.is/?lang=zh-CN',
  'http://ip-api.com/json?lang=zh-CN&fields=status,message,country,countryCode,regionName,city,isp,org,as,query',
  'https://api.ip.sb/geoip',
  'https://ipinfo.io/json',
  'https://api.myip.com',
];

function providerFromURL(url) {
  const u = String(url || '').toLowerCase();
  if (u.includes('ip-api.com')) return 'ip-api';
  if (u.includes('ip.sb')) return 'ip.sb';
  if (u.includes('ipinfo.io')) return 'ipinfo';
  if (u.includes('myip.com')) return 'myip';
  if (u.includes('ipwho.is')) return 'ipwho.is';
  return u.replace(/^https?:\/\//, '').split('/')[0] || 'custom';
}

function parseAPIList(value) {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  return String(value || '')
    .split(/[|\n,]/)
    .map(clean)
    .filter(Boolean);
}

async function landingLookup(node, options = {}) {
  if (!node || typeof node !== 'object') return { ok: false, landing: false, error: 'missing node' };
  const mihomoManager = options.mihomoManager;
  if (!mihomoManager) return { ok: false, landing: false, error: 'missing mihomo manager' };
  const timeout = Number(options.timeout || 5000);
  const retries = Math.max(0, Number(options.retries || 0));
  const retryDelay = Math.max(0, Number(options.retryDelay || options.retry_delay || 800));
  const apis = parseAPIList(options.apis || options.api).length ? parseAPIList(options.apis || options.api) : DEFAULT_LANDING_APIS;

  const startedAll = Date.now();
  let inventory = null;
  let match = null;
  try {
    if (!(await mihomoManager.isReady())) throw new Error(mihomoManager.lastError || 'mihomo 未启动或 API 不可用');
    inventory = await mihomoManager.getProxyInventory(1000);
    match = mihomoManager.findLoadedProxyName(node.name, node, inventory);
  } catch (e) {
    return {
      ok: false,
      landing: false,
      category: 'api_error',
      error: String(e && e.message || e),
      attempts: 0,
      totalLatency: Date.now() - startedAll,
      entryServer: node.server || '',
      entryPort: node.port || '',
    };
  }
  if (!match || !match.found) {
    return {
      ok: false,
      landing: false,
      skipped: true,
      category: 'api_not_found',
      error: 'Mihomo API 未找到该节点 / 节点未加载 / 名称不匹配',
      rawError: 'proxy name not found in current Mihomo /proxies',
      attempts: 0,
      totalLatency: Date.now() - startedAll,
      entryServer: node.server || '',
      entryPort: node.port || '',
      mihomoApiName: match && match.name,
      candidates: match && match.candidates,
      mihomoProxyTotal: inventory && inventory.total,
      mihomoNodeTotal: inventory && inventory.nodeCount,
    };
  }

  let attempts = 0;
  let last = '';
  for (const api of apis) {
    for (let retryNo = 0; retryNo <= retries; retryNo++) {
      attempts++;
      const started = Date.now();
      try {
        const resp = await mihomoManager.requestViaNode(match.name, api, { timeout, node });
        if (resp.status < 200 || resp.status >= 300) {
          last = '查询接口返回 HTTP ' + resp.status;
          continue;
        }
        let obj;
        try { obj = JSON.parse(resp.body || '{}'); }
        catch (e) { last = '查询接口返回内容解析失败：' + String(e.message || e); continue; }
        const provider = providerFromURL(api);
        const geo = normalizeGeoResult(obj, provider, node.server || '');
        if (!geo) {
          last = (obj && (obj.message || obj.error)) || 'landing lookup failed';
          continue;
        }
        return Object.assign({}, geo, {
          ok: true,
          landing: true,
          landingIP: geo.query || obj.ip || obj.query || '',
          landingAPI: api,
          usedAPI: api,
          latency: resp.latency || (Date.now() - started),
          totalLatency: Date.now() - startedAll,
          attempts,
          entryServer: node.server || '',
          entryPort: node.port || '',
          mihomoApiName: match.name,
        });
      } catch (e) {
        last = e && e.name === 'AbortError' ? 'timeout' : String(e && e.message || e);
      }
      if (retryNo < retries && retryDelay) await sleep(retryDelay);
    }
  }
  return {
    ok: false,
    landing: false,
    error: last || '落地查询失败：所有备用接口均失败',
    attempts,
    totalLatency: Date.now() - startedAll,
    entryServer: node.server || '',
    entryPort: node.port || '',
  };
}

module.exports = { DEFAULT_LANDING_APIS, parseAPIList, providerFromURL, landingLookup };
