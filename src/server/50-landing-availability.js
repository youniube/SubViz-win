  function landingApiName(url) {
    url = String(url || '').toLowerCase();
    if (url.indexOf('ip-api.com') >= 0) return 'ip-api';
    if (url.indexOf('ipwho.is') >= 0) return 'ipwho.is';
    if (url.indexOf('api.ip.sb') >= 0 || url.indexOf('ip.sb') >= 0) return 'ip.sb';
    if (url.indexOf('ipinfo.io') >= 0) return 'ipinfo.io';
    if (url.indexOf('api.myip.com') >= 0) return 'api.myip.com';
    if (url.indexOf('checkip.amazonaws.com') >= 0) return 'internal-checkip';
    return 'custom';
  }
  function splitLandingApis(s) {
    return String(s || '').split(/[\n|,]+/).map(function (x) { return clean(x); }).filter(Boolean);
  }
  function landingDefaultApis() {
    return [
      'https://ipwho.is/?lang=zh-CN',
      'http://ip-api.com/json?lang=zh-CN&fields=status,message,country,countryCode,regionName,city,isp,org,as,query',
      'https://api.ip.sb/geoip',
      'https://ipinfo.io/json',
      'https://api.myip.com'
    ];
  }
  function timeoutToSeconds(raw, defaultMs) {
    var n = Number(raw);
    if (!isFinite(n) || n <= 0) n = Number(defaultMs || 3000);
    if (!isFinite(n) || n <= 0) n = 3000;
    if (n >= 200) n = n / 1000;
    if (n < 0.2) n = 0.2;
    if (n > 30) n = 30;
    return n;
  }
  function landingTimeoutSeconds() {
    return timeoutToSeconds(getQuery(getURL(), 'timeout'), 5000);
  }
  function getBodyIP(data) {
    var t = clean(String(data || ''));
    try {
      var obj = JSON.parse(t);
      return clean(obj.ip || obj.query || obj.origin || obj.address || '');
    } catch (e) {}
    var m = t.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/);
    return m ? m[0] : '';
  }
  function internalGeoFromIP(ip, provider) {
    if (typeof $utils === 'undefined' || typeof $utils.geoip === 'undefined') return null;
    var code = clean($utils.geoip(ip) || '').toUpperCase();
    if (!code) return null;
    var aso = '';
    var asn = '';
    try { if (typeof $utils.ipaso !== 'undefined') aso = clean($utils.ipaso(ip) || ''); } catch (e) {}
    try { if (typeof $utils.ipasn !== 'undefined') asn = clean($utils.ipasn(ip) || ''); } catch (e) {}
    return normalizeGeoResult({ ip: ip, countryCode: code, aso: aso, asn: asn }, provider || 'internal', ip);
  }
  function getObjPath(o, path) {
    var cur = o || {}, parts = String(path || '').split('.');
    for (var i = 0; i < parts.length; i++) {
      if (!parts[i]) continue;
      cur = cur[parts[i]];
      if (cur === undefined || cur === null) return '';
    }
    return cur;
  }
  function formatLandingName(format, proxy, api) {
    if (!format) return '';
    return String(format).replace(/\{\{\s*([^}]+?)\s*\}\}/g, function (_, key) {
      key = String(key || '').trim();
      if (key.indexOf('api.') === 0) return clean(getObjPath(api, key.slice(4)));
      if (key.indexOf('proxy.') === 0) return clean(getObjPath(proxy, key.slice(6)));
      return '';
    }).trim();
  }
  function landingLookup() {
    var body = ($request && $request.body) || '';
    var node = null;
    try { node = JSON.parse(body || '{}'); } catch (e) { return respondJSON({ ok:false, error:'节点数据不是有效 JSON：'+String(e), errorCode:'invalid_node_json' }, 400); }
    var built = nodePolicyDescriptor(node);
    if (!built.ok) return respondJSON(built, 400);
    var internal = getQuery(getURL(), 'internal') === '1' || getQuery(getURL(), 'internal') === 'true';
    var timeout = landingTimeoutSeconds();
    var retries = Math.max(0, Math.min(3, parseInt(getQuery(getURL(), 'retries') || '1', 10) || 0));
    var retryDelay = Math.max(0, Math.min(5000, parseInt(getQuery(getURL(), 'retry_delay') || '800', 10) || 0));
    var format = getQuery(getURL(), 'format') || '';
    var customApis = splitLandingApis(getQuery(getURL(), 'api'));
    var apis = internal ? (customApis.length ? customApis : ['http://checkip.amazonaws.com']) : (customApis.length ? customApis : landingDefaultApis());
    var errors = [];
    var attemptNo = 0;
    var startedAll = Date.now();
    var descriptorList = [].concat(built.descriptors || [built.descriptor], built.namedDescriptors || [built.namedDescriptor]).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
    function tryAPI(apiIndex, retryNo, descIndex) {
      descIndex = descIndex || 0;
      if (apiIndex >= apis.length) return respondJSON({ ok:false, error:'落地查询失败：所有备用接口或临时代理尝试均失败', errorCode:'landing_lookup_failed', errors: errors.slice(-10), attempts: attemptNo, descriptorProtocol: built.protocol, server: built.server, port: built.port, descriptor: built.descriptor }, 502);
      if (descIndex >= descriptorList.length) return tryAPI(apiIndex + 1, 0, 0);
      var api = apis[apiIndex];
      var provider = internal ? 'internal' : landingApiName(api);
      var started = Date.now();
      var descUse = descriptorList[descIndex];
      var opt = { url: api, timeout: timeout, insecure: true, headers: { 'User-Agent': 'SubViz/' + VERSION }, 'policy-descriptor': descUse, node: descUse };
      attemptNo++;
      $httpClient.get(opt, function (err, resp, data) {
        var status = Number((resp && (resp.status || resp.statusCode)) || 0);
        if (err || (status && status >= 400)) {
          errors.push({ api: api, provider: provider, descriptorMode: descIndex === 0 ? 'raw' : 'named', error: String(err || ('HTTP ' + status)), retry: retryNo });
          if (retryNo < retries) return setTimeout(function () { tryAPI(apiIndex, retryNo + 1, descIndex); }, retryDelay || 0);
          return tryAPI(apiIndex, 0, descIndex + 1);
        }
        try {
          var r = null, rawObj = null;
          if (internal) {
            var ip = getBodyIP(data);
            r = internalGeoFromIP(ip, provider);
            if (!r) errors.push({ api: api, provider: provider, descriptorMode: descIndex === 0 ? 'raw' : 'named', error: '内部 GEOIP 查询失败：当前环境可能不支持 $utils.geoip 或没有 GEOIP 数据库', ip: ip });
          } else {
            try { rawObj = JSON.parse(data || '{}'); } catch (e1) { rawObj = { ip: getBodyIP(data) }; }
            r = normalizeGeoResult(rawObj, provider, built.server);
            if (!r) errors.push({ api: api, provider: provider, descriptorMode: descIndex === 0 ? 'raw' : 'named', error: (rawObj && (rawObj.message || rawObj.error)) || '查询接口返回内容解析失败', raw: String(data || '').slice(0, 160) });
          }
          if (!r) {
            if (retryNo < retries) return setTimeout(function () { tryAPI(apiIndex, retryNo + 1, descIndex); }, retryDelay || 0);
            return tryAPI(apiIndex, 0, descIndex + 1);
          }
          r.landing = true;
          r.landingIP = r.query;
          r.entryServer = built.server;
          r.entryPort = built.port;
          r.descriptorProtocol = built.protocol;
          r.usedAPI = api;
          r.landingAPI = api;
          r.attempts = attemptNo;
          r.latency = Date.now() - started;
          r.totalLatency = Date.now() - startedAll;
          r.format = format;
          r.formattedName = formatLandingName(format, node, r);
          return respondJSON(r);
        } catch (e) {
          errors.push({ api: api, provider: provider, descriptorMode: descIndex === 0 ? 'raw' : 'named', error: String(e), raw: String(data || '').slice(0, 160) });
          if (retryNo < retries) return setTimeout(function () { tryAPI(apiIndex, retryNo + 1, descIndex); }, retryDelay || 0);
          return tryAPI(apiIndex, 0, descIndex + 1);
        }
      });
    }
    tryAPI(0, 0);
  }



  function availabilityStatusOK(status, expr) {
    status = Number(status || 0);
    expr = clean(expr || '204');
    if (!expr) expr = '204';
    var parts = expr.split(/[|,，\s]+/).filter(Boolean);
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (/^\d{3}$/.test(p) && status === Number(p)) return true;
      if (/^\dxx$/i.test(p) && Math.floor(status / 100) === Number(p[0])) return true;
      var m = p.match(/^(\d{3})-(\d{3})$/);
      if (m && status >= Number(m[1]) && status <= Number(m[2])) return true;
    }
    return false;
  }
  function availabilityLookup() {
    var body = ($request && $request.body) || '';
    var node = null;
    try { node = JSON.parse(body || '{}'); } catch (e) { return respondJSON({ ok:false, alive:false, error:'节点数据不是有效 JSON：'+String(e), errorCode:'invalid_node_json' }, 400); }
    var built = nodePolicyDescriptor(node);
    if (!built.ok) return respondJSON({ ok:false, alive:false, error: built.error || '当前协议不支持测活', errorCode: built.errorCode || 'descriptor_failed', protocol: built.protocol || node.protocol }, 400);
    var url = getQuery(getURL(), 'url') || 'http://connectivitycheck.platform.hicloud.com/generate_204';
    var statusExpr = getQuery(getURL(), 'status') || '204';
    var timeout = timeoutToSeconds(getQuery(getURL(), 'timeout'), 3000);
    var retries = Math.max(0, Math.min(3, parseInt(getQuery(getURL(), 'retries') || '1', 10) || 0));
    var retryDelay = Math.max(0, Math.min(5000, parseInt(getQuery(getURL(), 'retry_delay') || '1000', 10) || 0));
    var startedAll = Date.now();
    var attempts = 0;
    var descriptors = [].concat(built.descriptors || [built.descriptor], built.namedDescriptors || [built.namedDescriptor]).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
    function tryOnce(descIndex, retryNo) {
      descIndex = descIndex || 0;
      if (descIndex >= descriptors.length) return respondJSON({ ok:false, alive:false, error:'Surge 临时代理策略创建失败：该节点参数可能不兼容', errorCode:'policy_descriptor_failed', attempts: attempts, latency: Date.now()-startedAll, protocol: built.protocol, server: built.server, port: built.port }, 502);
      attempts++;
      var started = Date.now();
      var descUse = descriptors[descIndex];
      var opt = { url: url, timeout: timeout, insecure: true, headers: { 'User-Agent': 'SubViz/' + VERSION }, 'policy-descriptor': descUse, node: descUse };
      $httpClient.get(opt, function (err, resp, data) {
        var latency = Date.now() - started;
        var totalLatency = Date.now() - startedAll;
        var status = Number((resp && (resp.status || resp.statusCode)) || 0);
        if (!err && availabilityStatusOK(status, statusExpr)) return respondJSON({ ok:true, alive:true, status:status, latency:latency, totalLatency:totalLatency, attempts:attempts, protocol:built.protocol, server:built.server, port:built.port, url:url });
        var msg = err ? String(err) : ('状态码不匹配：返回 '+status+'，期望 '+statusExpr);
        if (retryNo < retries) return setTimeout(function(){ tryOnce(descIndex, retryNo+1); }, retryDelay || 0);
        if (descIndex + 1 < descriptors.length) return tryOnce(descIndex+1, 0);
        return respondJSON({ ok:false, alive:false, error: msg, status:status, expected:statusExpr, latency:latency, totalLatency:totalLatency, attempts:attempts, protocol:built.protocol, server:built.server, port:built.port, url:url }, 502);
      });
    }
    tryOnce(0,0);
  }
