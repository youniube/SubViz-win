  function fetchURL(url) {
    if (!url) return respondJSON({ ok: false, error: 'missing url' }, 400);
    $httpClient.get({ url: url, timeout: 30, headers: { 'User-Agent': 'SubViz/' + VERSION } }, function (err, resp, data) {
      if (err) return respondJSON({ ok: false, error: String(err), sourceUrl: url }, 502);
      var status = Number(resp && (resp.status || resp.statusCode) || 0);
      if (status >= 400) {
        return respondJSON({ ok: false, error: 'remote subscription HTTP ' + status, status: status, sourceUrl: url, bodyPreview: String(data || '').slice(0, 240) }, 502);
      }
      try {
        var result = parseSubscription(data || ''); result.ok = true; result.sourceUrl = url;
        if (!result.summary || !result.summary.total) result.warning = 'remote subscription fetched, but no proxy nodes were parsed';
        respondJSON(result);
      }
      catch (e) { respondJSON({ ok: false, error: String(e && e.stack || e), sourceUrl: url }, 500); }
    });
  }
  function sampleText() {
    return '%%SAMPLE_YAML%%';
  }

  function normalizeGeoResult(obj, provider, host) {
    obj = obj || {};
    provider = String(provider || '').toLowerCase();
    var ok = false, code = '', country = '', city = '', region = '', isp = '', org = '', asn = '', query = host || '';
    if (provider.indexOf('ip-api') >= 0) {
      ok = obj.status === 'success';
      code = clean(obj.countryCode || '').toUpperCase();
      country = clean(obj.country || '');
      city = clean(obj.city || '');
      region = clean(obj.regionName || '');
      isp = clean(obj.isp || '');
      org = clean(obj.org || '');
      asn = clean(obj.as || '');
      query = clean(obj.query || host || '');
    } else if (provider.indexOf('ipinfo') >= 0) {
      ok = !!(obj.ip && obj.country);
      code = clean(obj.country || '').toUpperCase();
      country = '';
      city = clean(obj.city || '');
      region = clean(obj.region || '');
      org = clean(obj.org || '');
      isp = org;
      asn = org;
      query = clean(obj.ip || host || '');
    } else if (provider.indexOf('myip') >= 0) {
      ok = !!(obj.ip && (obj.cc || obj.country));
      code = clean(obj.cc || obj.country_code || obj.countryCode || '').toUpperCase();
      country = clean(obj.country || '');
      query = clean(obj.ip || host || '');
    } else if (provider.indexOf('ip.sb') >= 0 || provider.indexOf('ipsb') >= 0) {
      ok = !!(obj.ip && (obj.country_code || obj.country));
      code = clean(obj.country_code || obj.countryCode || '').toUpperCase();
      country = clean(obj.country || '');
      city = clean(obj.city || '');
      region = clean(obj.region || '');
      isp = clean(obj.isp || obj.organization || obj.org || '');
      org = clean(obj.organization || obj.org || '');
      asn = clean((obj.asn && (obj.asn.asn || obj.asn)) || obj.as || '');
      query = clean(obj.ip || host || '');
    } else if (provider.indexOf('internal') >= 0) {
      ok = !!(obj.ip && obj.countryCode);
      code = clean(obj.countryCode || '').toUpperCase();
      country = clean(obj.country || '');
      isp = clean(obj.isp || obj.aso || '');
      org = clean(obj.org || obj.aso || '');
      asn = clean(obj.asn || '');
      query = clean(obj.ip || host || '');
    } else {
      ok = obj.success !== false && (obj.ip || obj.country_code || obj.country || obj.countryCode);
      code = clean(obj.country_code || obj.countryCode || obj.cc || '').toUpperCase();
      country = clean(obj.country || obj.country_name || '');
      city = clean(obj.city || '');
      region = clean(obj.region || obj.regionName || '');
      isp = clean((obj.connection && obj.connection.isp) || obj.isp || obj.organization || '');
      org = clean((obj.connection && obj.connection.org) || obj.org || obj.organization || '');
      asn = clean((obj.connection && obj.connection.asn) || obj.asn || obj.as || '');
      query = clean(obj.ip || obj.query || host || '');
    }
    if (!ok || !code) return null;
    var ci = COUNTRY[code] ? countryInfo(code, 'geoip', CONFIDENCE_GEOIP) : { countryCode: code, country: country || code, countrySource: 'geoip', countryConfidence: CONFIDENCE_GEOIP_WEAK };
    return { ok: true, host: host, query: query, countryCode: code, country: ci.country || country || code, countrySource: 'geoip', countryConfidence: ci.countryConfidence || CONFIDENCE_GEOIP, provider: provider, city: city, region: region, isp: isp, org: org, asn: asn };
  }
  function fallbackGeoLookup(host, reason) {
    var u = 'http://ip-api.com/json/' + encodeURIComponent(host) + '?lang=zh-CN&fields=status,message,country,countryCode,regionName,city,isp,org,as,query';
    $httpClient.get({ url: u, timeout: 12, headers: { 'User-Agent': 'SubViz/' + VERSION } }, function (err, resp, data) {
      if (err) return respondJSON({ ok:false, host: host, error: String(err), fallbackReason: reason || '' }, 502);
      try {
        var obj = JSON.parse(data || '{}');
        var r = normalizeGeoResult(obj, 'ip-api', host);
        if (!r) return respondJSON({ ok:false, host: host, error: obj.message || 'geoip lookup failed', fallbackReason: reason || '' }, 502);
        return respondJSON(r);
      } catch (e) { return respondJSON({ ok:false, host: host, error: String(e), fallbackReason: reason || '' }, 500); }
    });
  }
  function geoLookup(host) {
    host = clean(host || '').replace(/^\[/, '').replace(/\]$/, '');
    if (!host) return respondJSON({ ok:false, error:'missing host' }, 400);
    var u = 'https://ipwho.is/' + encodeURIComponent(host) + '?lang=zh-CN';
    $httpClient.get({ url: u, timeout: 12, headers: { 'User-Agent': 'SubViz/' + VERSION } }, function (err, resp, data) {
      if (err) return fallbackGeoLookup(host, String(err));
      try {
        var obj = JSON.parse(data || '{}');
        var r = normalizeGeoResult(obj, 'ipwho.is', host);
        if (!r) return fallbackGeoLookup(host, obj.message || 'ipwho.is failed');
        return respondJSON(r);
      } catch (e) { return fallbackGeoLookup(host, String(e)); }
    });
  }

