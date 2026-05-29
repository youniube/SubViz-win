'use strict';

const { clean, fetchText, DEFAULT_USER_AGENT } = require('./utils');
const { COUNTRY, countryInfo } = require('./country');

function normalizeGeoResult(obj, provider, host) {
  obj = obj || {};
  provider = String(provider || '').toLowerCase();
  let ok = false;
  let code = '';
  let country = '';
  let city = '';
  let region = '';
  let isp = '';
  let org = '';
  let asn = '';
  let query = host || '';

  if (provider.includes('ip-api')) {
    ok = obj.status === 'success';
    code = clean(obj.countryCode).toUpperCase();
    country = clean(obj.country);
    city = clean(obj.city);
    region = clean(obj.regionName);
    isp = clean(obj.isp);
    org = clean(obj.org);
    asn = clean(obj.as);
    query = clean(obj.query || host || '');
  } else if (provider.includes('ipinfo')) {
    ok = !!(obj.ip && obj.country);
    code = clean(obj.country).toUpperCase();
    city = clean(obj.city);
    region = clean(obj.region);
    org = clean(obj.org);
    isp = org;
    asn = org;
    query = clean(obj.ip || host || '');
  } else if (provider.includes('myip')) {
    ok = !!(obj.ip && (obj.cc || obj.country));
    code = clean(obj.cc || obj.country_code || obj.countryCode).toUpperCase();
    country = clean(obj.country);
    query = clean(obj.ip || host || '');
  } else if (provider.includes('ip.sb') || provider.includes('ipsb')) {
    ok = !!(obj.ip && (obj.country_code || obj.country));
    code = clean(obj.country_code || obj.countryCode).toUpperCase();
    country = clean(obj.country);
    city = clean(obj.city);
    region = clean(obj.region);
    isp = clean(obj.isp || obj.organization || obj.org);
    org = clean(obj.organization || obj.org);
    asn = clean((obj.asn && (obj.asn.asn || obj.asn)) || obj.as);
    query = clean(obj.ip || host || '');
  } else {
    ok = obj.success !== false && !!(obj.ip || obj.country_code || obj.country || obj.countryCode);
    code = clean(obj.country_code || obj.countryCode || obj.cc).toUpperCase();
    country = clean(obj.country || obj.country_name);
    city = clean(obj.city);
    region = clean(obj.region || obj.regionName);
    isp = clean((obj.connection && obj.connection.isp) || obj.isp || obj.organization);
    org = clean((obj.connection && obj.connection.org) || obj.org || obj.organization);
    asn = clean((obj.connection && obj.connection.asn) || obj.asn || obj.as);
    query = clean(obj.ip || obj.query || host || '');
  }

  if (!ok || !code) return null;
  const ci = COUNTRY[code]
    ? countryInfo(code, 'geoip', 78)
    : { countryCode: code, country: country || code, countrySource: 'geoip', countryConfidence: 70 };
  return {
    ok: true,
    host,
    query,
    countryCode: code,
    country: ci.country || country || code,
    countrySource: 'geoip',
    countryConfidence: ci.countryConfidence || 78,
    provider,
    city,
    region,
    isp,
    org,
    asn,
  };
}

async function geoLookup(host, options = {}) {
  host = clean(host).replace(/^\[/, '').replace(/\]$/, '');
  if (!host) return { ok: false, error: 'missing host' };
  const timeout = Number(options.timeout || 12000);
  const providers = [
    { name: 'ipwho.is', url: 'https://ipwho.is/' + encodeURIComponent(host) + '?lang=zh-CN' },
    { name: 'ip-api', url: 'http://ip-api.com/json/' + encodeURIComponent(host) + '?lang=zh-CN&fields=status,message,country,countryCode,regionName,city,isp,org,as,query' },
  ];
  let lastError = '';
  for (const p of providers) {
    try {
      const resp = await fetchText(p.url, { timeout, headers: { 'User-Agent': DEFAULT_USER_AGENT } });
      if (!resp.ok) {
        lastError = 'HTTP ' + resp.status;
        continue;
      }
      const obj = JSON.parse(resp.body || '{}');
      const r = normalizeGeoResult(obj, p.name, host);
      if (r) return r;
      lastError = obj.message || 'geoip lookup failed';
    } catch (e) {
      lastError = e && e.name === 'AbortError' ? 'timeout' : String(e && e.message || e);
    }
  }
  return { ok: false, host, error: lastError || 'geoip lookup failed' };
}

module.exports = { normalizeGeoResult, geoLookup };
