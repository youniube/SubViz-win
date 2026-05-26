var SUBVIZ_SURGE_0_1_45 = true;
var SubViz = (function () {
  'use strict';
  var VERSION = '0.1.45';
  var MARKER = 'SUBVIZ_SURGE_0_1_45';
  var ICON_BASE_URL = 'https://raw.githubusercontent.com/youniube/subviz/main/assets/';
  var FAVICON_URL = ICON_BASE_URL + 'favicon.ico?v=' + VERSION;
  var ICON_192_URL = ICON_BASE_URL + 'icon-192.png?v=' + VERSION;
  var ICON_512_URL = ICON_BASE_URL + 'icon-512.png?v=' + VERSION;
  var APPLE_TOUCH_ICON_URL = ICON_BASE_URL + 'apple-touch-icon.png?v=' + VERSION;
  var WEBMANIFEST_URL = ICON_BASE_URL + 'site.webmanifest?v=' + VERSION;
  function redirect(url) {
    respond(302, '', { 'Location': url, 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' });
  }

  function safeStringify(obj, space) {
    return JSON.stringify(obj, null, space || 0).replace(/[\u007f-\uffff]/g, function (c) {
      var s = c.charCodeAt(0).toString(16);
      return '\\u' + ('0000' + s).slice(-4);
    });
  }
  function respond(status, body, headers) {
    var h = {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };
    headers = headers || {};
    Object.keys(headers).forEach(function (k) { h[k] = headers[k]; });
    $done({ response: { status: status || 200, headers: h, body: body || '' } });
  }
  function respondJSON(obj, status) {
    respond(status || 200, safeStringify(obj, 2), { 'Content-Type': 'application/json; charset=utf-8' });
  }
  function nowIso() { try { return new Date().toISOString(); } catch (e) { return ''; } }
  function getURL() { return ($request && $request.url) || ''; }
  function getPath(url) { try { return url.replace(/^https?:\/\/[^\/]+/i, '').split('?')[0] || '/'; } catch (e) { return '/'; } }
  function getQuery(url, key) {
    var q = (url.split('?')[1] || '').split('#')[0];
    var arr = q.split('&');
    for (var i = 0; i < arr.length; i++) {
      var kv = arr[i].split('=');
      if (decodeURIComponent(kv[0] || '') === key) return decodeURIComponent((kv.slice(1).join('=') || '').replace(/\+/g, ' '));
    }
    return '';
  }
  function clean(v) {
    if (v === null || v === undefined) return '';
    v = String(v).trim();
    if ((v[0] === '"' && v[v.length - 1] === '"') || (v[0] === "'" && v[v.length - 1] === "'")) v = v.slice(1, -1);
    return v;
  }
  function decodeURIComponentSafe(s) { try { return decodeURIComponent(s); } catch (e) { return s || ''; } }
  function atobSafe(input) {
    input = String(input || '').trim().replace(/\s+/g, '');
    if (!input) return '';
    input = input.replace(/-/g, '+').replace(/_/g, '/');
    while (input.length % 4) input += '=';
    try {
      var bin = atob(input);
      try { return decodeURIComponent(escape(bin)); } catch (e1) { return bin; }
    } catch (e2) { return ''; }
  }
  function maybeDecodeBase64(text) {
    var t = String(text || '').trim();
    if (!t) return t;
    if (/^(vmess|vless|trojan|ss|ssr|hysteria2|hy2|hysteria|tuic|snell|socks5?|http):\/\//im.test(t)) return t;
    if (/proxies\s*:/i.test(t)) return t;
    if (/^[A-Za-z0-9+/_=-]+$/.test(t) && t.length > 40) {
      var d = atobSafe(t);
      if (d && d.length > 10) return d;
    }
    return t;
  }

  var CONFIDENCE_FLAG = 98;
  var CONFIDENCE_ISO = 92;
  var CONFIDENCE_NAME = 90;
  var CONFIDENCE_GEOIP = 78;
  var CONFIDENCE_GEOIP_WEAK = 70;
  var CONFIDENCE_CDN = 60;
  var COUNTRY = {
    HK:['Hong Kong','\u9999\u6e2f',['HK','HKG'],['\u9999\u6e2f','Hong Kong']],
    TW:['Taiwan','\u53f0\u6e7e',['TW','TWN'],['\u53f0\u6e7e','\u81fa\u7063','Taiwan']],
    MO:['Macau','\u6fb3\u95e8',['MO','MAC'],['\u6fb3\u95e8','\u6fb3\u9580','Macau','Macao']],
    US:['United States','\u7f8e\u56fd',['US','USA'],['\u7f8e\u56fd','\u7f8e\u897f','\u7f8e\u4e1c','\u7f8e\u5357','\u7f8e\u5317','United States','USA','America']],
    JP:['Japan','\u65e5\u672c',['JP','JPN'],['\u65e5\u672c','Japan','Tokyo','\u4e1c\u4eac','\u5927\u962a']],
    SG:['Singapore','\u65b0\u52a0\u5761',['SG','SGP'],['\u65b0\u52a0\u5761','\u72ee\u57ce','Singapore']],
    KR:['Korea','\u97e9\u56fd',['KR','KOR'],['\u97e9\u56fd','\u9996\u5c14','Korea','Seoul']],
    GB:['United Kingdom','\u82f1\u56fd',['GB','UK','GBR'],['\u82f1\u56fd','\u4f26\u6566','United Kingdom','Britain','London']],
    DE:['Germany','\u5fb7\u56fd',['DE','DEU'],['\u5fb7\u56fd','Germany','Frankfurt']],
    FR:['France','\u6cd5\u56fd',['FR','FRA'],['\u6cd5\u56fd','France','Paris']],
    NL:['Netherlands','\u8377\u5170',['NL','NLD'],['\u8377\u5170','Netherlands','Holland']],
    CA:['Canada','\u52a0\u62ff\u5927',['CA','CAN'],['\u52a0\u62ff\u5927','Canada']],
    AU:['Australia','\u6fb3\u5927\u5229\u4e9a',['AU','AUS'],['\u6fb3\u5927\u5229\u4e9a','\u6fb3\u6d32','Australia']],
    RU:['Russia','\u4fc4\u7f57\u65af',['RU','RUS'],['\u4fc4\u7f57\u65af','Russia','Moscow']],
    IN:['India','\u5370\u5ea6',['IN','IND'],['\u5370\u5ea6','India']],
    VN:['Vietnam','\u8d8a\u5357',['VN','VNM'],['\u8d8a\u5357','Vietnam']],
    TH:['Thailand','\u6cf0\u56fd',['TH','THA'],['\u6cf0\u56fd','Thailand']],
    MY:['Malaysia','\u9a6c\u6765\u897f\u4e9a',['MY','MYS'],['\u9a6c\u6765\u897f\u4e9a','Malaysia']],
    PH:['Philippines','\u83f2\u5f8b\u5bbe',['PH','PHL'],['\u83f2\u5f8b\u5bbe','Philippines']],
    TR:['Turkey','\u571f\u8033\u5176',['TR','TUR'],['\u571f\u8033\u5176','Turkey']],
    ES:['Spain','\u897f\u73ed\u7259',['ES','ESP'],['\u897f\u73ed\u7259','Spain']],
    IT:['Italy','\u610f\u5927\u5229',['IT','ITA'],['\u610f\u5927\u5229','Italy']],
    SE:['Sweden','\u745e\u5178',['SE','SWE'],['\u745e\u5178','Sweden']],
    FI:['Finland','\u82ac\u5170',['FI','FIN'],['\u82ac\u5170','Finland','Helsinki','\u8d6b\u5c14\u8f9b\u57fa']],
    RO:['Romania','\u7f57\u9a6c\u5c3c\u4e9a',['RO','ROU'],['\u7f57\u9a6c\u5c3c\u4e9a','Romania']],
    PL:['Poland','\u6ce2\u5170',['PL','POL'],['\u6ce2\u5170','Poland']],
    CZ:['Czechia','\u6377\u514b',['CZ','CZE'],['\u6377\u514b','Czech','Czechia']],
    CH:['Switzerland','\u745e\u58eb',['CH','CHE'],['\u745e\u58eb','Switzerland']],
    LV:['Latvia','\u62c9\u8131\u7ef4\u4e9a',['LV','LVA'],['\u62c9\u8131\u7ef4\u4e9a','Latvia']],
    EE:['Estonia','\u7231\u6c99\u5c3c\u4e9a',['EE','EST'],['\u7231\u6c99\u5c3c\u4e9a','Estonia']],
    MD:['Moldova','\u6469\u5c14\u591a\u74e6',['MD','MDA'],['\u6469\u5c14\u591a\u74e6','Moldova']],
    AR:['Argentina','\u963f\u6839\u5ef7',['AR','ARG'],['\u963f\u6839\u5ef7','Argentina']],
    ZA:['South Africa','\u5357\u975e',['ZA','ZAF'],['\u5357\u975e','South Africa']],
    NG:['Nigeria','\u5c3c\u65e5\u5229\u4e9a',['NG','NGA'],['\u5c3c\u65e5\u5229\u4e9a','Nigeria']],
    NZ:['New Zealand','\u65b0\u897f\u5170',['NZ','NZL'],['\u65b0\u897f\u5170','New Zealand']]
  };
  function flagToCC(s) {
    s = String(s || '');
    for (var i = 0; i < s.length - 3; i++) {
      var a = s.charCodeAt(i), b = s.charCodeAt(i + 1), c = s.charCodeAt(i + 2), d = s.charCodeAt(i + 3);
      if (a === 0xD83C && c === 0xD83C && b >= 0xDDE6 && b <= 0xDDFF && d >= 0xDDE6 && d <= 0xDDFF) {
        return String.fromCharCode(65 + b - 0xDDE6) + String.fromCharCode(65 + d - 0xDDE6);
      }
    }
    return '';
  }
  function countryInfo(code, source, confidence) {
    var c = COUNTRY[code] || null;
    if (!c) return { countryCode: 'UN', country: '\u672a\u77e5', countrySource: 'none', countryConfidence: 0 };
    return { countryCode: code, country: c[1], countrySource: source || 'rule', countryConfidence: confidence || 80 };
  }
  function isCFServer(server) {
    server = String(server || '').toLowerCase();
    if (/cloudflare|workers\.dev|pages\.dev/.test(server)) return true;
    if (/^(104\.(1[6-9]|2[0-9]|3[0-1])\.|172\.(6[4-9]|7[0-1])\.|162\.158\.|190\.93\.|188\.114\.|141\.101\.|108\.162\.|198\.41\.)/.test(server)) return true;
    return false;
  }
  function detectCountry(name, server, extra) {
    name = String(name || ''); server = String(server || ''); extra = extra || {};
    var text = [name, server, extra.country, extra.countryCode, extra.sni, extra.servername, extra.Host, extra.host].join(' ');
    var explicit = flagToCC(text);
    if (explicit && COUNTRY[explicit]) return countryInfo(explicit, 'flag', CONFIDENCE_FLAG);
    var upper = text.toUpperCase();
    var keys = Object.keys(COUNTRY);
    for (var i = 0; i < keys.length; i++) {
      var code = keys[i];
      var arr = COUNTRY[code][2];
      for (var j = 0; j < arr.length; j++) {
        var token = arr[j].toUpperCase();
        var re = new RegExp('(?:^|[^A-Z0-9])' + token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:[^A-Z0-9]|$)');
        if (re.test(upper)) return countryInfo(code, 'iso', CONFIDENCE_ISO);
      }
      var names = COUNTRY[code][3];
      for (var k = 0; k < names.length; k++) {
        if (text.indexOf(names[k]) >= 0 || upper.indexOf(String(names[k]).toUpperCase()) >= 0) return countryInfo(code, 'name', CONFIDENCE_NAME);
      }
    }
    if (/CF\s*\u4e2d\u8f6c|\u4e2d\u8f6c|Cloudflare|Anycast|CDN/i.test(text) || isCFServer(server)) {
      return { countryCode: 'CDN', country: 'CDN/\u4e2d\u8f6c', countrySource: 'cdn', countryConfidence: CONFIDENCE_CDN };
    }
    return { countryCode: 'UN', country: '\u672a\u77e5', countrySource: 'none', countryConfidence: 0 };
  }

  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
  function pickObj(o, keys) {
    o = o || {};
    for (var i = 0; i < keys.length; i++) {
      var v = o[keys[i]];
      if (v !== null && v !== undefined && String(v) !== '') return v;
    }
    return '';
  }
  function pickDeep(o, keys) {
    o = o || {};
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k.indexOf('.') < 0) {
        var v = o[k];
        if (v !== null && v !== undefined && String(v) !== '') return v;
        continue;
      }
      var cur = o, parts = k.split('.');
      for (var j = 0; j < parts.length && cur !== null && cur !== undefined; j++) cur = cur[parts[j]];
      if (cur !== null && cur !== undefined && String(cur) !== '') return cur;
    }
    return '';
  }
  function splitHostPort(hp) {
    hp = String(hp || '').trim();
    if (!hp) return { host:'', port:'' };
    if (hp[0] === '[') {
      var end = hp.indexOf(']');
      if (end > 0) {
        var afterBracket = hp.slice(end + 1);
        return { host: hp.slice(1, end), port: afterBracket.length > 1 ? afterBracket.replace(/^:/, '') : '' };
      }
    }
    var idx = hp.lastIndexOf(':');
    if (idx > 0) return { host: hp.slice(0, idx), port: hp.slice(idx + 1) };
    return { host: hp, port:'' };
  }
  var SS_CIPHERS = [
    'aes-128-gcm','aes-192-gcm','aes-256-gcm',
    'aes-128-cfb','aes-192-cfb','aes-256-cfb',
    'aes-128-ctr','aes-192-ctr','aes-256-ctr',
    'chacha20-ietf-poly1305','xchacha20-ietf-poly1305',
    'chacha20-ietf','chacha20','rc4-md5',
    '2022-blake3-aes-128-gcm','2022-blake3-aes-256-gcm',
    '2022-blake3-chacha20-poly1305','2022-blake3-chacha8-poly1305',
    'none','plain','rc4'
  ];
  function ssCipherSplit(userinfo) {
    userinfo = String(userinfo || '');
    var lower = userinfo.toLowerCase();
    for (var i = 0; i < SS_CIPHERS.length; i++) {
      var c = SS_CIPHERS[i];
      if (lower.indexOf(c) === 0 && userinfo.length > c.length && userinfo[c.length] === ':') {
        return c.length;
      }
    }
    return -1;
  }
  function normalizeProxyObject(obj) {
    obj = obj || {};
    var o = {};
    Object.keys(obj).forEach(function (k) { o[k] = obj[k]; });
    var ws = obj['ws-opts'] || obj.wsOpts || obj.ws || obj.ws_opts;
    if (isObj(ws)) {
      if (!o.path && ws.path) o.path = ws.path;
      if (!o.host && ws.host) o.host = ws.host;
      if (!o.Host && ws.Host) o.Host = ws.Host;
      if (isObj(ws.headers)) {
        if (!o.Host && ws.headers.Host) o.Host = ws.headers.Host;
        if (!o.host && ws.headers.host) o.host = ws.headers.host;
        if (!o['User-Agent'] && ws.headers['User-Agent']) o['User-Agent'] = ws.headers['User-Agent'];
      }
    }
    var h = obj.headers;
    if (isObj(h)) {
      if (!o.Host && h.Host) o.Host = h.Host;
      if (!o.host && h.host) o.host = h.host;
      if (!o['User-Agent'] && h['User-Agent']) o['User-Agent'] = h['User-Agent'];
    }
    var plugin = obj['plugin-opts'] || obj.pluginOpts || obj.plugin_opts;
    if (isObj(plugin)) {
      if (!o.mode && plugin.mode) o.mode = plugin.mode;
      if (!o.host && plugin.host) o.host = plugin.host;
      if (!o.Host && plugin.Host) o.Host = plugin.Host;
      if (!o.path && plugin.path) o.path = plugin.path;
      if (!o.tls && plugin.tls) o.tls = plugin.tls;
    }
    var reality = obj['reality-opts'] || obj.realityOpts || obj.reality_opts || obj.reality;
    if (isObj(reality)) {
      if (!o['reality-public-key']) o['reality-public-key'] = pickDeep(reality, ['public-key','publicKey','pbk','reality-public-key']);
      if (!o['reality-short-id']) o['reality-short-id'] = pickDeep(reality, ['short-id','shortId','sid','reality-short-id']);
      if (!o['client-fingerprint']) o['client-fingerprint'] = pickDeep(reality, ['client-fingerprint','fingerprint','fp']);
    }
    var grpc = obj['grpc-opts'] || obj.grpcOpts || obj.grpc_opts;
    if (isObj(grpc)) {
      if (!o['grpc-service-name']) o['grpc-service-name'] = pickDeep(grpc, ['grpc-service-name','service-name','serviceName']);
      if (!o.network && !o.net) o.network = 'grpc';
    }
    o.type = clean(o.type || o.protocol || '');
    o.server = clean(o.server || o.add || o.address || o.hostname || '');
    o.port = clean(o.port || '');
    o.name = clean(o.name || o.ps || o.remarks || o.remark || o.tag || '');
    o.network = clean(o.network || o.net || o.transport || '');
    if (String(o.network).toLowerCase() === 'websocket') o.network = 'ws';
    if (String(o.network).toLowerCase() === 'h2') o.network = 'grpc';
    o.tls = clean(o.tls || o.security || '');
    if (String(o.tls).toLowerCase() === 'reality') o.security = 'reality';
    o.cipher = clean(o.cipher || o.method || o['encrypt-method'] || o.encrypt_method || o.scy || '');
    o.password = clean(o.password || o.pass || o.passwd || o.psk || '');
    o.uuid = clean(o.uuid || o.id || o.username || '');
    o.sni = clean(o.sni || o.servername || o.serverName || o['server-name'] || o.server_name || '');
    o.Host = clean(o.Host || o.host || o['ws-host'] || '');
    o.path = clean(o.path || o['ws-path'] || '');
    o['reality-public-key'] = clean(o['reality-public-key'] || o['public-key'] || o.publicKey || o.pbk || '');
    o['reality-short-id'] = clean(o['reality-short-id'] || o['short-id'] || o.shortId || o.sid || '');
    o['client-fingerprint'] = clean(o['client-fingerprint'] || o.fingerprint || o.fp || '');
    o['grpc-service-name'] = clean(o['grpc-service-name'] || o.serviceName || o['service-name'] || '');
    return o;
  }

  function buildNode(obj, format, raw) {
    obj = normalizeProxyObject(obj || {});
    var name = obj.name;
    var protocol = obj.type.toLowerCase();
    if (protocol === 'socks') protocol = 'socks5';
    if (protocol === 'hy2') protocol = 'hysteria2';
    var server = obj.server;
    var port = obj.port;
    var network = obj.network;
    var tls = obj.tls;
    if (!protocol && raw) {
      var m = String(raw).match(/^([a-z0-9+.-]+):\/\//i);
      if (m) protocol = m[1].toLowerCase();
    }
    var c = detectCountry(name, server, obj);
    return {
      id: obj.uuid || obj.password || '', name: name || server || 'node', protocol: protocol || 'unknown',
      server: server, port: port, network: network, tls: tls, countryCode: c.countryCode, country: c.country,
      countrySource: c.countrySource, countryConfidence: c.countryConfidence,
      sourceFormat: format || 'unknown', raw: raw || safeStringify(obj, 0), extra: obj,
      fingerprint: ''
    };
  }
  function setFingerprint(n) {
    var e = (n && n.extra) || {};
    n.fingerprint = [n.protocol, n.server, n.port, n.network, n.tls, e.sni, e.Host, e.path, e.cipher, e.uuid || n.id || e.password].join('|').toLowerCase();
    return n;
  }

  function splitTopLevel(s, sep) {
    s = String(s || ''); sep = sep || ',';
    var parts = [], cur = '', quote = '', depth = 0;
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (quote) {
        if (ch === quote && s[i - 1] !== '\\') quote = '';
        cur += ch;
      } else if (ch === '"' || ch === "'") {
        quote = ch; cur += ch;
      } else if (ch === '{' || ch === '[' || ch === '(') {
        depth++; cur += ch;
      } else if (ch === '}' || ch === ']' || ch === ')') {
        if (depth > 0) depth--; cur += ch;
      } else if (ch === sep && depth === 0) {
        parts.push(cur); cur = '';
      } else cur += ch;
    }
    if (cur || s.endsWith(sep)) parts.push(cur);
    return parts;
  }
  function topLevelColonIndex(s) {
    s = String(s || '');
    var quote = '', depth = 0;
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (quote) {
        if (ch === quote && s[i - 1] !== '\\') quote = '';
      } else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === '{' || ch === '[' || ch === '(') depth++;
      else if (ch === '}' || ch === ']' || ch === ')') { if (depth > 0) depth--; }
      else if (ch === ':' && depth === 0) return i;
    }
    return -1;
  }
  function parseFlowValue(v) {
    v = clean(v);
    if (!v) return '';
    if (v[0] === '{' && v[v.length - 1] === '}') return parseFlowObject(v);
    if (v[0] === '[' && v[v.length - 1] === ']') {
      return splitTopLevel(v.slice(1, -1), ',').map(function (x) { return clean(x); }).filter(function (x) { return x !== ''; });
    }
    if (/^(true|false)$/i.test(v)) return /^true$/i.test(v);
    if (/^[-+]?\d+(?:\.\d+)?$/.test(v)) return v;
    return v;
  }
  function parseFlowObject(s) {
    var obj = {};
    s = String(s || '').trim();
    if (s[0] === '{') s = s.slice(1);
    if (s[s.length - 1] === '}') s = s.slice(0, -1);
    splitTopLevel(s, ',').forEach(function (p) {
      var idx = topLevelColonIndex(p); if (idx < 0) return;
      var k = clean(p.slice(0, idx)); var v = p.slice(idx + 1);
      if (!k) return;
      obj[k] = parseFlowValue(v);
    });
    return obj;
  }
  var REAL_PROXY_TYPES = { ss:1, ssr:1, vmess:1, vless:1, trojan:1, hysteria:1, hysteria2:1, hy2:1, tuic:1, snell:1, socks:1, socks5:1, http:1, https:1, anytls:1 };
  var GROUP_TYPES = { select:1, 'url-test':1, fallback:1, 'load-balance':1, relay:1, smart:1, direct:1, reject:1, pass:1 };
  function isRealProxyObject(obj) {
    obj = normalizeProxyObject(obj || {});
    var t = clean(obj.type || obj.protocol || '').toLowerCase();
    if (t === 'socks') t = 'socks5';
    if (!t || GROUP_TYPES[t] || !REAL_PROXY_TYPES[t]) return false;
    var server = clean(obj.server || obj.add || obj.host || obj.address || obj.hostname || '');
    var port = clean(obj.port || '');
    if (!server || !port) return false;
    return true;
  }
  function parseClash(text) {
    var nodes = [], lines = String(text || '').split(/\r?\n/), cur = null, inProxies = false, stack = [];
    var hasProxiesSection = /^\s*proxies\s*:\s*$/im.test(text);
    if (!hasProxiesSection && /^\s*-\s*(?:name\s*:|\{)/m.test(text)) inProxies = true;
    function push() {
      if (cur && isRealProxyObject(cur)) nodes.push(setFingerprint(buildNode(cur, 'clash-yaml', safeStringify(cur, 0))));
      cur = null; stack = [];
    }
    function setAt(indent, key, val, makeObj) {
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
      var parent = stack.length ? stack[stack.length - 1].obj : cur;
      if (!parent) return;
      if (makeObj) { var child = {}; parent[key] = child; stack.push({ indent: indent, obj: child }); }
      else parent[key] = clean(val);
    }
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (/^\s*proxies\s*:\s*$/i.test(line)) { push(); inProxies = true; continue; }
      if (inProxies && /^\S[^:]*\s*:\s*(?:#.*)?$/i.test(line) && !/^proxies\s*:/i.test(line)) { push(); inProxies = false; continue; }
      if (!inProxies) continue;
      var mFlow = line.match(/^\s*-\s*(\{.*\})\s*$/);
      if (mFlow) {
        push();
        var fo = parseFlowObject(mFlow[1]);
        if (isRealProxyObject(fo)) nodes.push(setFingerprint(buildNode(fo, 'clash-yaml', mFlow[1])));
        continue;
      }
      var mName = line.match(/^(\s*)-\s*name\s*:\s*(.*)$/i);
      if (mName) { push(); cur = { name: clean(mName[2]) }; stack = [{ indent: mName[1].length, obj: cur }]; continue; }
      var mStart = line.match(/^(\s*)-\s*([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
      if (mStart) { push(); cur = {}; stack = [{ indent: mStart[1].length, obj: cur }]; setAt(mStart[1].length + 2, mStart[2], mStart[3], clean(mStart[3]) === ''); continue; }
      if (!cur) continue;
      var m = line.match(/^(\s+)([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
      if (m) setAt(m[1].length, m[2], m[3], clean(m[3]) === '');
    }
    push(); return nodes;
  }
  var URI_PROXY_TYPES = { ss:1, ssr:1, vmess:1, vless:1, trojan:1, hysteria:1, hysteria2:1, hy2:1, tuic:1, snell:1, socks:1, socks5:1, http:1, https:1, anytls:1 };
  function parseURI(line) {
    line = clean(line); if (!line) return null;
    var m = line.match(/^([a-z0-9+.-]+):\/\//i); if (!m) return null;
    var proto = m[1].toLowerCase();
    if (!URI_PROXY_TYPES[proto]) return null;
    var rest = line.slice(m[0].length), obj = { type: proto };
    try {
      if (proto === 'vmess') {
        var json = atobSafe(rest); obj = JSON.parse(json); obj.type = 'vmess';
        obj.name = obj.ps || obj.name || obj.remarks || '';
        obj.server = obj.add || obj.server || '';
        obj.port = obj.port || '';
        obj.network = obj.net || obj.network || '';
        obj.tls = obj.tls || obj.security || '';
        return setFingerprint(buildNode(obj, 'uri', line));
      }
      var name = '';
      var hash = rest.indexOf('#'); if (hash >= 0) { name = decodeURIComponentSafe(rest.slice(hash + 1)); rest = rest.slice(0, hash); }
      var query = ''; var qi = rest.indexOf('?'); if (qi >= 0) { query = rest.slice(qi + 1); rest = rest.slice(0, qi); }
      function applyQuery(qs) {
        qs.split('&').forEach(function (p) {
          if (!p) return;
          var kv = p.split('='), k = decodeURIComponentSafe(kv[0] || ''), v = decodeURIComponentSafe(kv.slice(1).join('='));
          if (!k) return;
          if (k === 'type') obj.network = v;
          else if (k === 'host') obj.host = v;
          else if (k === 'path') obj.path = v;
          else obj[k] = v;
        });
      }
      if (proto === 'ss') {
        applyQuery(query);
        var decoded = rest, at = rest.lastIndexOf('@'), userinfo = '', hp = '';
        if (at >= 0) {
          userinfo = decodeURIComponentSafe(rest.slice(0, at));
          hp = rest.slice(at + 1);
          // SIP002 commonly writes ss://base64(method:password)@host:port#name.
          // If the userinfo part itself has no colon, decode that part only.
          if (userinfo.indexOf(':') < 0) {
            var du = atobSafe(userinfo);
            if (du) userinfo = du;
          }
        } else {
          decoded = atobSafe(rest) || rest;
          at = decoded.lastIndexOf('@');
          userinfo = at >= 0 ? decoded.slice(0, at) : '';
          hp = at >= 0 ? decoded.slice(at + 1) : decoded;
        }
        var cidx = ssCipherSplit(userinfo);
        if (cidx >= 0) {
          obj.cipher = decodeURIComponentSafe(userinfo.slice(0, cidx));
          obj.password = decodeURIComponentSafe(userinfo.slice(cidx + 1));
        } else if (userinfo.indexOf(':') >= 0) {
          obj.cipher = decodeURIComponentSafe(userinfo.slice(0, userinfo.indexOf(':')));
          obj.password = decodeURIComponentSafe(userinfo.slice(userinfo.indexOf(':') + 1));
        }
        var hpParsed = splitHostPort(hp); obj.server = hpParsed.host; obj.port = hpParsed.port; obj.name = name; obj.type = 'ss';
        return setFingerprint(buildNode(obj, 'uri', line));
      }
      var at2 = rest.lastIndexOf('@');
      if (at2 >= 0) {
        var user = decodeURIComponentSafe(rest.slice(0, at2));
        if (proto === 'trojan' || proto === 'hysteria2' || proto === 'hy2' || proto === 'hysteria' || proto === 'anytls') obj.password = user;
        else if (proto === 'vless') obj.uuid = user;
        else if (proto === 'tuic') {
          var tci = user.indexOf(':');
          if (tci >= 0) { obj.uuid = user.slice(0, tci); obj.password = user.slice(tci + 1); }
          else obj.uuid = user;
        } else if (proto === 'socks' || proto === 'socks5' || proto === 'http' || proto === 'https') {
          var uci = user.indexOf(':');
          if (uci >= 0) { obj.username = user.slice(0, uci); obj.password = user.slice(uci + 1); }
          else obj.username = user;
        } else obj.username = user;
      }
      var hp2 = at2 >= 0 ? rest.slice(at2 + 1) : rest;
      var hp2Parsed = splitHostPort(hp2); obj.server = hp2Parsed.host; obj.port = hp2Parsed.port; obj.name = name; obj.type = proto;
      applyQuery(query);
      obj.type = proto;
      obj.network = obj.network || obj.net || '';
      obj.tls = obj.tls || obj.security || '';
      if (!obj.server || !obj.port) return null;
      return setFingerprint(buildNode(obj, 'uri', line));
    } catch (e) { return null; }
  }

  function parseSurge(text) {
    var nodes = [], inProxy = false;
    String(text || '').split(/\r?\n/).forEach(function(line){
      var rawLine = String(line || '').trim();
      if (!rawLine || /^#|^;/.test(rawLine)) return;
      if (/^\[Proxy\]/i.test(rawLine)) { inProxy = true; return; }
      if (/^\[[^\]]+\]/.test(rawLine) && !/^\[Proxy\]/i.test(rawLine)) { inProxy = false; return; }
      if (!inProxy && rawLine.indexOf(' = ') < 0) return;
      var eq = rawLine.indexOf('='); if (eq < 0) return;
      var name = clean(rawLine.slice(0, eq)); var rhs = clean(rawLine.slice(eq + 1));
      var parts = splitProxyParts(rhs); if (parts.length < 3) return;
      var type = clean(parts[0]).toLowerCase();
      if (type === 'socks') type = 'socks5';
      if (!REAL_PROXY_TYPES[type] || GROUP_TYPES[type]) return;
      var obj = parseKeyValueParts(parts, 3);
      obj.name = name; obj.type = type; obj.server = clean(parts[1]); obj.port = clean(parts[2]);
      if (obj['encrypt-method'] && !obj.cipher) obj.cipher = obj['encrypt-method'];
      if (obj.username && (type === 'vmess' || type === 'vless' || type === 'tuic')) obj.uuid = obj.username;
      if (obj['ws-path'] && !obj.path) obj.path = obj['ws-path'];
      if (obj['ws-headers'] && !obj.Host) {
        var mh = String(obj['ws-headers']).match(/Host\s*:\s*([^;]+)/i);
        if (mh) obj.Host = clean(mh[1]);
      }
      if (obj.ws === 'true' || obj.ws === '1') obj.network = 'ws';
      if (isRealProxyObject(obj)) nodes.push(setFingerprint(buildNode(obj, 'surge-conf', rawLine)));
    });
    return nodes;
  }
  function dedup(nodes) {
    var seen = {}, out = [];
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i]; setFingerprint(n);
      if (!seen[n.fingerprint]) { seen[n.fingerprint] = true; out.push(n); }
    }
    return out;
  }
  function parseSubscription(text) {
    text = maybeDecodeBase64(text);
    var nodes = [];
    if (/proxies\s*:/i.test(text) || /^\s*-\s*name\s*:/m.test(text)) nodes = nodes.concat(parseClash(text));
    if (/\[Proxy\]/i.test(text) || /^\s*[^=\n]+\s*=\s*(?:ss|trojan|vmess|vless|hysteria2|hy2|tuic|snell|socks5|http|https)\s*,/im.test(text)) nodes = nodes.concat(parseSurge(text));
    var structuredFPs = {};
    nodes.forEach(function (n) { structuredFPs[n.fingerprint] = true; });
    String(text || '').split(/\r?\n/).forEach(function (line) {
      var n = parseURI(line);
      if (n && !structuredFPs[n.fingerprint]) nodes.push(n);
    });
    return analyzeNodes(nodes);
  }
  function analyzeNodes(nodes) {
    nodes = nodes || [];
    var seen = {}, dupMap = {}, unique = [];
    nodes.forEach(function (n) { setFingerprint(n); if (!seen[n.fingerprint]) { seen[n.fingerprint] = true; unique.push(n); } else { if (!dupMap[n.fingerprint]) dupMap[n.fingerprint] = [n]; dupMap[n.fingerprint].push(n); } });
    var byP = {}, byC = {}, byCC = {}, byF = {};
    nodes.forEach(function (n) { byP[n.protocol] = (byP[n.protocol] || 0) + 1; byC[n.country] = (byC[n.country] || 0) + 1; byCC[n.countryCode] = (byCC[n.countryCode] || 0) + 1; byF[n.sourceFormat] = (byF[n.sourceFormat] || 0) + 1; });
    function toArr(o) { return Object.keys(o).map(function (k) { return { key: k, count: o[k] }; }).sort(function (a,b) { return b.count - a.count; }); }
    var dups = Object.keys(dupMap).map(function (k) { return { fingerprint: k, count: dupMap[k].length, nodes: dupMap[k] }; });
    return { summary: { total: nodes.length, unique: unique.length, duplicates: nodes.length - unique.length, protocols: Object.keys(byP).length, countries: Object.keys(byC).length }, stats: { byProtocol: toArr(byP), byCountry: toArr(byC), byCountryCode: toArr(byCC), bySourceFormat: toArr(byF) }, duplicates: dups, nodes: nodes, meta: { version: VERSION, marker: MARKER, generatedAt: nowIso() } };
  }

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
    return "proxies:\n  - name: \"🇸🇬SG_1|demo\"\n    type: trojan\n    server: ppg-sg.example.com\n    port: 443\n    password: demo-password\n    network: ws\n    tls: true\n    ws-opts:\n      path: /demo\n      headers:\n        Host: cdn.example.com\n  - name: \"🇺🇸US_1|reality-demo\"\n    type: vless\n    server: reality.example.com\n    port: 443\n    uuid: 00000000-0000-0000-0000-000000000000\n    tls: true\n    flow: xtls-rprx-vision\n    servername: www.microsoft.com\n    client-fingerprint: chrome\n    reality-opts:\n      public-key: demo-public-key\n      short-id: demoid\n  - name: \"SE_1 demo\"\n    type: ss\n    server: 1.2.3.4\n    port: 8388\n    cipher: aes-128-gcm\n    password: demo-password\n  - name: \"JP hy2 demo\"\n    type: hysteria2\n    server: hy2.example.com\n    port: 443\n    password: demo-password\n    sni: hy2.example.com\n    obfs: salamander\n    obfs-password: demo-obfs\n  - { name: \"HK tuic demo\", type: tuic, server: tuic.example.com, port: 443, uuid: 00000000-0000-0000-0000-000000000001, password: demo-password, sni: tuic.example.com, alpn: [h3] }\n  - { name: \"DE grpc demo\", type: vmess, server: grpc.example.com, port: 443, uuid: 00000000-0000-0000-0000-000000000002, tls: true, network: grpc, grpc-opts: { grpc-service-name: demoService } }\n";
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

  function isPlainIPv4(host) {
    return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(String(host || ''));
  }
  function surgeBool(v) {
    v = String(v || '').toLowerCase();
    return v === 'true' || v === '1' || v === 'yes' || v === 'on';
  }
  function surgeTLS(v) {
    v = String(v || '').toLowerCase();
    return v === 'true' || v === '1' || v === 'yes' || v === 'on' || v === 'tls' || v === 'reality';
  }
  function policyEscape(val) {
    val = String(val);
    return val.replace(/[,#\r\n]/g, function (ch) { return encodeURIComponent(ch); }).replace(/ /g, '%20');
  }
  function addParam(arr, key, val) {
    if (val === null || val === undefined || val === '') return;
    val = String(val);
    if (/[\r\n]/.test(val)) return;
    arr.push(key + '=' + policyEscape(val));
  }
  function addBoolParam(arr, key, val) {
    if (val === null || val === undefined || val === '') return;
    arr.push(key + '=' + (surgeBool(val) ? 'true' : 'false'));
  }
  function firstOf(obj, keys) {
    obj = obj || {};
    for (var i = 0; i < keys.length; i++) {
      var v = obj[keys[i]];
      if (v !== null && v !== undefined && String(v) !== '') return clean(v);
    }
    return '';
  }

  function splitProxyParts(line) {
    var out = [], cur = '', quote = '';
    line = String(line || '');
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (quote) { if (ch === quote && line[i-1] !== '\\') quote = ''; cur += ch; }
      else if (ch === '"' || ch === "'") { quote = ch; cur += ch; }
      else if (ch === ',') { out.push(clean(cur)); cur = ''; }
      else cur += ch;
    }
    if (cur || line.endsWith(',')) out.push(clean(cur));
    return out;
  }
  function parseKeyValueParts(parts, startIndex) {
    var o = {};
    for (var i = startIndex || 0; i < parts.length; i++) {
      var p = clean(parts[i]); if (!p) continue;
      var eq = p.indexOf('=');
      if (eq > 0) {
        var k = clean(p.slice(0, eq)); var v = clean(p.slice(eq + 1));
        o[k] = v;
      }
    }
    return o;
  }
  function recoverSSFromRaw(node, e) {
    e = e || {};
    var raw = String((node && (node.raw || node.rawName || node.originalName)) || e.raw || '');
    if (!raw) return e;
    try {
      if (raw[0] === '{') {
        var obj = JSON.parse(raw);
        Object.keys(obj || {}).forEach(function(k){ if (e[k] === undefined || e[k] === '') e[k] = obj[k]; });
      }
    } catch (ex) {}
    var m;
    if (!e.cipher && !e.method && !e['encrypt-method']) {
      m = raw.match(/(?:cipher|method|encrypt-method|encrypt_method)\s*[:=]\s*["']?([^,"'\n}]+)/i);
      if (m) e.cipher = clean(m[1]);
    }
    if (!e.password && !e.passwd && !e.pass) {
      m = raw.match(/(?:password|passwd|pass)\s*[:=]\s*["']?([^,"'\n}]+)/i);
      if (m) e.password = clean(m[1]);
    }
    return e;
  }
  function nodePolicyDescriptor(node) {
    node = node || {};
    var e = normalizeProxyObject(node.extra || {});
    var type = clean(node.protocol || e.type || '').toLowerCase();
    if (type === 'socks') type = 'socks5';
    if (type === 'hy2') type = 'hysteria2';
    var server = clean(node.server || e.server || e.add || e.address || e.host || '');
    var port = clean(node.port || e.port || '');
    if (!type || !server || !port) return { ok:false, error:'missing protocol/server/port' };
    var params = [], desc = '';
    var sni = firstOf(e, ['sni','servername','serverName','server-name','server_name']);
    var skip = firstOf(e, ['skip-cert-verify','skipCertVerify','allowInsecure']);
    var udp = firstOf(e, ['udp','udp-relay','udpRelay']);
    var network = clean(node.network || e.network || e.net || '');
    var host = firstOf(e, ['Host','host','ws-host']);
    var path = firstOf(e, ['path','ws-path']);
    if (type === 'ss') {
      e = recoverSSFromRaw(node, e);
      var method = firstOf(e, ['cipher','method','encrypt-method','encrypt_method']);
      var password = firstOf(e, ['password','passwd','pass']);
      if (!method || !password) return { ok:false, error:'SS 节点缺少加密方式或密码：通常是解析器没有识别该订阅格式，或该节点本身字段不完整', errorCode:'ss_missing_cipher_password' };
      desc = ['ss', server, port].join(', ');
      addParam(params, 'encrypt-method', method);
      addParam(params, 'password', password);
      if (udp) addBoolParam(params, 'udp-relay', udp);
      if (/^ws$/i.test(network) || /v2ray-plugin|gost-plugin/i.test(firstOf(e, ['plugin']))) {
        addParam(params, 'ws', 'true');
        addParam(params, 'ws-path', path || '/');
        if (host) addParam(params, 'ws-headers', 'Host:' + host);
        if (sni) addParam(params, 'sni', sni);
        if (skip) addBoolParam(params, 'skip-cert-verify', skip);
      }
    } else if (type === 'trojan') {
      var tpw = firstOf(e, ['password','passwd']);
      if (!tpw) return { ok:false, error:'trojan missing password' };
      desc = ['trojan', server, port].join(', ');
      addParam(params, 'password', tpw);
      if (sni) addParam(params, 'sni', sni);
      if (skip) addBoolParam(params, 'skip-cert-verify', skip);
      if (udp) addBoolParam(params, 'udp-relay', udp);
      if (/^ws$/i.test(network)) {
        addParam(params, 'ws', 'true');
        addParam(params, 'ws-path', path || '/');
        if (host) addParam(params, 'ws-headers', 'Host:' + host);
      }
    } else if (type === 'vmess') {
      var uuid = firstOf(e, ['uuid','id','username']);
      if (!uuid) return { ok:false, error:'vmess missing uuid' };
      desc = ['vmess', server, port].join(', ');
      addParam(params, 'username', uuid);
      var vmCipher = firstOf(e, ['cipher','security','scy']);
      if (!vmCipher || String(vmCipher).toLowerCase() === 'auto') addParam(params, 'encrypt-method', 'aes-128-gcm');
      else addParam(params, 'encrypt-method', vmCipher);
      var aid = firstOf(e, ['alterId','alterid','aid']);
      if (aid && aid !== '0') {
        addParam(params, 'alter-id', aid);
        addParam(params, 'vmess-aead', 'false');
      } else {
        addParam(params, 'vmess-aead', 'true');
      }
      if (surgeTLS(firstOf(e, ['tls','security']))) addParam(params, 'tls', 'true');
      if (sni) addParam(params, 'sni', sni);
      if (skip) addBoolParam(params, 'skip-cert-verify', skip);
      if (/^ws$/i.test(network)) {
        addParam(params, 'ws', 'true');
        addParam(params, 'ws-path', path || '/');
        if (host) addParam(params, 'ws-headers', 'Host:' + host);
      }
      if (udp) addBoolParam(params, 'udp-relay', udp);
    } else if (type === 'vless') {
      var vuuid = firstOf(e, ['uuid','id','username']);
      if (!vuuid) return { ok:false, error:'vless missing uuid' };
      desc = ['vless', server, port].join(', ');
      addParam(params, 'username', vuuid);
      if (surgeTLS(firstOf(e, ['tls','security']))) addParam(params, 'tls', 'true');
      if (sni) addParam(params, 'sni', sni);
      if (skip) addBoolParam(params, 'skip-cert-verify', skip);
      if (/^ws$/i.test(network)) {
        addParam(params, 'ws', 'true');
        addParam(params, 'ws-path', path || '/');
        if (host) addParam(params, 'ws-headers', 'Host:' + host);
      }
      var flow = firstOf(e, ['flow','vless-flow']);
      if (flow) addParam(params, 'vless-flow', flow);
      var pbk = firstOf(e, ['reality-public-key','public-key','publicKey','pbk']);
      var sid = firstOf(e, ['reality-short-id','short-id','shortId','sid']);
      var fp = firstOf(e, ['client-fingerprint','fingerprint','fp']);
      if (pbk) addParam(params, 'reality-public-key', pbk);
      if (sid) addParam(params, 'reality-short-id', sid);
      if (fp) addParam(params, 'client-fingerprint', fp);
      if (udp) addBoolParam(params, 'udp-relay', udp);
    } else if (type === 'tuic') {
      desc = ['tuic', server, port].join(', ');
      var token = firstOf(e, ['token']);
      if (token) addParam(params, 'token', token);
      else {
        addParam(params, 'uuid', firstOf(e, ['uuid','id']));
        addParam(params, 'password', firstOf(e, ['password','passwd']));
      }
      if (sni) addParam(params, 'sni', sni);
      if (skip) addBoolParam(params, 'skip-cert-verify', skip);
      addParam(params, 'alpn', firstOf(e, ['alpn']) || 'h3');
    } else if (type === 'hysteria2' || type === 'hysteria') {
      desc = ['hysteria2', server, port].join(', ');
      addParam(params, 'password', firstOf(e, ['password','auth','auth-str','auth_str']));
      if (sni) addParam(params, 'sni', sni);
      if (skip || firstOf(e, ['insecure'])) addBoolParam(params, 'skip-cert-verify', skip || firstOf(e, ['insecure']));
      if (udp) addBoolParam(params, 'udp-relay', udp);
      addParam(params, 'download-bandwidth', firstOf(e, ['download-bandwidth','downloadBandwidth','down']));
      addParam(params, 'upload-bandwidth', firstOf(e, ['upload-bandwidth','uploadBandwidth','up']));
      addParam(params, 'obfs', firstOf(e, ['obfs']));
      addParam(params, 'obfs-password', firstOf(e, ['obfs-password','obfsPassword']));
    } else if (type === 'anytls') {
      desc = ['anytls', server, port].join(', ');
      addParam(params, 'password', firstOf(e, ['password','passwd']));
      if (sni) addParam(params, 'sni', sni);
      if (skip) addBoolParam(params, 'skip-cert-verify', skip);
      if (udp) addBoolParam(params, 'udp-relay', udp);
    } else if (type === 'snell') {
      desc = ['snell', server, port].join(', ');
      addParam(params, 'psk', firstOf(e, ['psk','password']));
      addParam(params, 'version', firstOf(e, ['version']) || '4');
      if (udp) addBoolParam(params, 'udp-relay', udp);
    } else if (type === 'socks5' || type === 'http' || type === 'https') {
      desc = [type, server, port].join(', ');
      addParam(params, 'username', firstOf(e, ['username','user']));
      addParam(params, 'password', firstOf(e, ['password','pass']));
      if (skip) addBoolParam(params, 'skip-cert-verify', skip);
      if (sni) addParam(params, 'sni', sni);
    } else {
      return { ok:false, error:'不支持该协议进行落地检测：' + type, errorCode:'unsupported_protocol', protocol:type };
    }
    if (params.length) desc += ', ' + params.join(', ');
    var descriptors = [];
    function addDescriptorVariant(d) { if (d && descriptors.indexOf(d) < 0) descriptors.push(d); }
    function setDescriptorParam(d, key, val) {
      var escaped = policyEscape(val);
      var re = new RegExp('(,\\s*' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=)[^,]+');
      if (re.test(d)) return d.replace(re, '$1' + escaped);
      return d + ', ' + key + '=' + escaped;
    }
    addDescriptorVariant(desc);
    if (type === 'vmess') {
      addDescriptorVariant(setDescriptorParam(desc, 'vmess-aead', 'true'));
      addDescriptorVariant(setDescriptorParam(desc, 'vmess-aead', 'false'));
      if (host && sni && String(host).toLowerCase() !== String(sni).toLowerCase()) {
        addDescriptorVariant(setDescriptorParam(setDescriptorParam(desc, 'sni', host), 'vmess-aead', 'true'));
        addDescriptorVariant(setDescriptorParam(setDescriptorParam(desc, 'sni', host), 'vmess-aead', 'false'));
      }
      if (!sni && host) addDescriptorVariant(setDescriptorParam(desc, 'sni', host));
    }
    var namedDescriptors = descriptors.map(function (d) { return 'SubVizTemp = ' + d; });
    return { ok:true, descriptor: descriptors[0], namedDescriptor: namedDescriptors[0], descriptors: descriptors, namedDescriptors: namedDescriptors, protocol:type, server:server, port:port };
  }

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

  var GIST_TOKEN_KEY = 'subviz.github.token';

  function hasPersistentStore() {
    try { return typeof $persistentStore !== 'undefined' && $persistentStore && typeof $persistentStore.read === 'function' && typeof $persistentStore.write === 'function'; }
    catch (e) { return false; }
  }
  function readStoredGistToken() {
    if (!hasPersistentStore()) return '';
    try { return clean($persistentStore.read(GIST_TOKEN_KEY) || ''); }
    catch (e) { return ''; }
  }
  function writeStoredGistToken(token) {
    if (!hasPersistentStore()) return false;
    try { return !!$persistentStore.write(String(token || ''), GIST_TOKEN_KEY); }
    catch (e) { return false; }
  }
  function gistParseBody() {
    var body = ($request && $request.body) || '';
    if (!body) return {};
    try { return JSON.parse(body); }
    catch (e) { throw new Error('请求数据不是有效 JSON：' + String(e)); }
  }
  function gistTokenLooksValid(token) {
    token = clean(token || '');
    if (!token) return false;
    return token.length >= 20 && !/\s/.test(token);
  }
  function gistTokenStatus() {
    return respondJSON({ ok: true, storage: hasPersistentStore() ? 'surge-persistent-store' : 'unavailable', hasToken: !!readStoredGistToken() });
  }
  function gistTokenSave() {
    var body;
    try { body = gistParseBody(); } catch (e) { return respondJSON({ ok:false, error:String(e) }, 400); }
    var token = clean(body.token || '');
    if (!gistTokenLooksValid(token)) return respondJSON({ ok:false, error:'GitHub Token 为空或格式过短' }, 400);
    if (!writeStoredGistToken(token)) return respondJSON({ ok:false, error:'保存失败：当前环境不支持 Surge $persistentStore，或写入被拒绝' }, 500);
    return respondJSON({ ok:true, saved:true, hasToken:true });
  }
  function gistTokenDelete() {
    if (!writeStoredGistToken('')) return respondJSON({ ok:false, error:'清除失败：当前环境不支持 Surge $persistentStore，或写入被拒绝' }, 500);
    return respondJSON({ ok:true, deleted:true, hasToken:false });
  }
  function gistHttpRequest(method, url, token, bodyObj, cb) {
    var headers = {
      'User-Agent': 'SubViz/' + VERSION,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (token) headers.Authorization = 'Bearer ' + token;
    var opt = { url: url, timeout: 30, headers: headers };
    if (bodyObj !== undefined && bodyObj !== null) {
      opt.body = safeStringify(bodyObj, 0);
      opt.headers['Content-Type'] = 'application/json; charset=utf-8';
    }
    method = String(method || 'GET').toUpperCase();
    try {
      var lower = method.toLowerCase();
      if ($httpClient && typeof $httpClient[lower] === 'function') return $httpClient[lower](opt, cb);
      opt.method = method;
      if ($httpClient && typeof $httpClient.request === 'function') return $httpClient.request(opt, cb);
      if (method === 'GET' && $httpClient && typeof $httpClient.get === 'function') return $httpClient.get(opt, cb);
      if ($httpClient && typeof $httpClient.post === 'function') {
        if (method === 'PATCH') opt.headers['X-HTTP-Method-Override'] = 'PATCH';
        return $httpClient.post(opt, cb);
      }
      return cb(new Error('当前环境没有可用的 $httpClient 请求方法'));
    } catch (e) { return cb(e); }
  }
  function gistAPI(method, path, token, bodyObj, cb) {
    gistHttpRequest(method, 'https://api.github.com' + path, token, bodyObj, function (err, resp, data) {
      var status = Number((resp && (resp.status || resp.statusCode)) || 0);
      var obj = null;
      try { obj = data ? JSON.parse(data) : null; } catch (e) { obj = { raw: String(data || '').slice(0, 400) }; }
      cb(err, status, obj, String(data || ''));
    });
  }
  function gistAPIError(status, obj, fallback) {
    var msg = (obj && (obj.message || obj.error)) || fallback || 'GitHub API 请求失败';
    return 'GitHub API HTTP ' + (status || 0) + '：' + msg;
  }
  function stableRawUrl(raw) {
    raw = String(raw || '');
    return raw.replace(/\/raw\/[0-9a-f]{6,64}\//i, '/raw/');
  }
  function gistFindByName(list, name) {
    list = Array.isArray(list) ? list : [];
    name = clean(name || '');
    for (var i = 0; i < list.length; i++) {
      if (clean(list[i] && list[i].description) === name) return list[i];
    }
    return null;
  }
  function gistFinishUpload(status, obj, filename, action) {
    if (status < 200 || status >= 300 || !obj || !obj.files) {
      return respondJSON({ ok:false, error:gistAPIError(status, obj, 'Gist 上传失败'), status:status, detail:obj || null }, status === 401 || status === 403 ? 401 : 502);
    }
    var f = obj.files && obj.files[filename];
    var raw = f && f.raw_url ? stableRawUrl(f.raw_url) : '';
    return respondJSON({ ok:true, action:action || 'uploaded', gistId:obj.id || '', url:obj.html_url || '', rawUrl:raw, filename:filename, description:obj.description || '', updatedAt:obj.updated_at || '' });
  }
  function gistCreateOrUpdate(token, gistName, filename, content, isPublic, gistId) {
    var files = {}; files[filename] = { content: String(content || '') };
    if (gistId) {
      return gistAPI('PATCH', '/gists/' + encodeURIComponent(gistId), token, { description:gistName, files:files }, function (err, status, obj) {
        if (err) return respondJSON({ ok:false, error:String(err) }, 502);
        return gistFinishUpload(status, obj, filename, 'updated');
      });
    }
    var GIST_MAX_PAGES = 3;
    function searchPages(page, accumulated) {
      gistAPI('GET', '/gists?per_page=100&page=' + page, token, null, function (err, status, list, raw) {
        if (err) return respondJSON({ ok:false, error:String(err) }, 502);
        if (status < 200 || status >= 300) return respondJSON({ ok:false, error:gistAPIError(status, list, '列出 Gist 失败'), status:status, detail:list || raw }, status === 401 || status === 403 ? 401 : 502);
        var all = accumulated.concat(Array.isArray(list) ? list : []);
        var found = gistFindByName(all, gistName);
        if (found && found.id) {
          return gistAPI('PATCH', '/gists/' + encodeURIComponent(found.id), token, { description:gistName, files:files }, function (err2, status2, obj2) {
            if (err2) return respondJSON({ ok:false, error:String(err2) }, 502);
            return gistFinishUpload(status2, obj2, filename, 'updated');
          });
        }
        if (Array.isArray(list) && list.length >= 100 && page < GIST_MAX_PAGES) return searchPages(page + 1, all);
        return gistAPI('POST', '/gists', token, { description:gistName, public:!!isPublic, files:files }, function (err3, status3, obj3) {
          if (err3) return respondJSON({ ok:false, error:String(err3) }, 502);
          return gistFinishUpload(status3, obj3, filename, 'created');
        });
      });
    }
    searchPages(1, []);
  }
  function gistTokenTest() {
    var body;
    try { body = gistParseBody(); } catch (e) { return respondJSON({ ok:false, error:String(e) }, 400); }
    var token = clean(body.token || '') || readStoredGistToken();
    if (!gistTokenLooksValid(token)) return respondJSON({ ok:false, error:'没有可用 Token：请先输入或保存 GitHub Token' }, 400);
    gistAPI('GET', '/gists?per_page=1', token, null, function (err, status, obj) {
      if (err) return respondJSON({ ok:false, error:String(err) }, 502);
      if (status >= 200 && status < 300) return respondJSON({ ok:true, status:status, hasToken:true, message:'Token 可用，已通过 Gist API 测试' });
      return respondJSON({ ok:false, status:status, error:gistAPIError(status, obj, 'Token 测试失败') }, status === 401 || status === 403 ? 401 : 502);
    });
  }
  function gistUpload() {
    var body;
    try { body = gistParseBody(); } catch (e) { return respondJSON({ ok:false, error:String(e) }, 400); }
    var token = clean(body.token || '') || readStoredGistToken();
    var gistName = clean(body.gistName || body.name || body.description || '');
    var filename = clean(body.filename || body.file || '');
    var content = body.content;
    var gistId = clean(body.gistId || '');
    if (!gistTokenLooksValid(token)) return respondJSON({ ok:false, error:'没有可用 Token：请先输入 Token 或保存到 Surge' }, 400);
    if (!gistName && !gistId) return respondJSON({ ok:false, error:'请填写 Gist 名称；为了避免误改已有 Gist，此项必填' }, 400);
    if (!filename) return respondJSON({ ok:false, error:'请填写文件名；为了避免误改已有文件，此项必填' }, 400);
    if (content === undefined || content === null || String(content).length === 0) return respondJSON({ ok:false, error:'上传内容为空' }, 400);
    gistCreateOrUpdate(token, gistName || ('SubViz ' + nowIso()), filename, String(content), !!body.public, gistId);
  }

  var CLIENT_JS = "var DATA=null;\nvar GEO_CACHE={};\nvar GEO_RUNNING=false;\nvar SELECTED={};\n/* ── Consolidated style entry point ── */\nfunction installStyles(){\n  sv132EnsureStyle();\n  sv133InstallStyle();\n  sv135InstallStyle();\n}\n\n/* ── Event bus for plugin hooks ── */\nvar _hooks={};\nfunction hook(event,fn){if(!_hooks[event])_hooks[event]=[];_hooks[event].push(fn)}\nfunction emit(event){var a=[].slice.call(arguments,1);(_hooks[event]||[]).forEach(function(fn){try{fn.apply(null,a)}catch(e){console.error('[hook:'+event+']',e)}})}\nfunction selectedCount(){return Object.keys(SELECTED).filter(function(k){return SELECTED[k]}).length}\nfunction selectedNodes(){if(!DATA)return[];return (DATA.nodes||[]).filter(function(n){return n&&n._sid&&SELECTED[n._sid]})}\nfunction operationNodes(action){var a=selectedNodes();if(!a.length){st('请先勾选要'+action+'的节点，或点击“全选当前”。');return []}return a}\nfunction updateSelectUI(){var c=selectedCount();var el=$('selCount');if(el)el.textContent='已选 '+c+' 个'}\nfunction toggleSelect(sid,checked){if(!sid)return;if(checked)SELECTED[sid]=1;else delete SELECTED[sid];updateSelectUI()}\nfunction selectCurrent(){var a=filtered();a.forEach(function(n){if(n._sid)SELECTED[n._sid]=1});apply();st('已全选当前筛选结果：'+a.length+' 个节点')}\nfunction invertCurrent(){filtered().forEach(function(n){if(!n._sid)return;if(SELECTED[n._sid])delete SELECTED[n._sid];else SELECTED[n._sid]=1});apply();st('已反选当前筛选结果')}\nfunction clearSelected(){SELECTED={};apply();st('已清空选择')}\nfunction $(id){return document.getElementById(id)}\nfunction esc(s){return String(s==null?'':s).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]||c})}\nfunction st(s){$('status').textContent=s}\nfunction zhErr(s){s=String(s||'');var raw=s;var lower=s.toLowerCase();if(!s)return '';if(s.indexOf('不支持该协议')>=0||lower.indexOf('unsupported protocol')>=0)return '不支持该协议进行落地检测';if(s.indexOf('落地查询失败')>=0||lower.indexOf('landing lookup failed')>=0)return '落地查询失败：所有备用接口或临时代理尝试均失败';if(lower.indexOf('timeout')>=0||s.indexOf('超时')>=0)return '请求超时：节点不可用、速度过慢，或查询接口被阻断';if(lower.indexOf('websocket closed')>=0)return 'WebSocket 被服务端关闭：通常是 Host/SNI/path 不匹配，或 CDN/服务端拒绝握手';if(lower.indexOf('ss missing cipher')>=0||s.indexOf('SS 节点缺少')>=0)return 'SS 节点缺少加密方式或密码：多半是解析没有识别 cipher/password';if(lower.indexOf('policy descriptor')>=0)return 'Surge 临时代理策略创建失败：该节点参数可能不兼容';if(lower.indexOf('http 403')>=0)return '查询接口返回 403：接口拒绝访问，或该节点出口被限制';var m=s.match(/HTTP\\s*(\\d+)/i);if(m)return '查询接口返回 HTTP '+m[1];if(s.indexOf('节点数据不是有效 JSON')>=0||lower.indexOf('invalid node json')>=0)return '节点数据格式异常';if(s.indexOf('内部 GEOIP')>=0||lower.indexOf('internal geoip')>=0)return '内部 GEOIP 查询失败：当前 Surge 可能不支持 $utils.geoip 或没有 GEOIP 数据库';if(s.indexOf('查询接口返回内容解析失败')>=0||lower.indexOf('parse failed')>=0)return '查询接口返回内容解析失败';if(lower==='failed')return '检测失败';return raw}\nfunction bar(it,max){return '<div class=\"bar\"><div>'+esc(it.key)+'</div><div class=\"track\"><div class=\"fill\" style=\"width:'+(max?Math.round(it.count/max*100):0)+'%\"></div></div><b>'+it.count+'</b></div>'}\nfunction uniq(nodes){var m={},a=[];(nodes||[]).forEach(function(n){var k=n.fingerprint||[n.protocol,n.server,n.port,n.network,n.tls].join('|').toLowerCase();if(!m[k]){m[k]=1;a.push(n)}});return a}\nfunction addCount(m,k){k=k||'未知';m[k]=(m[k]||0)+1}\nfunction toArr(m){return Object.keys(m).map(function(k){return{key:k,count:m[k]}}).sort(function(a,b){return b.count-a.count})}\nfunction recalc(d){var ns=d.nodes||[],byP={},byC={},byCC={},byF={},seen={},dups=0;ns.forEach(function(n){addCount(byP,n.protocol);addCount(byC,n.country);addCount(byCC,n.countryCode||'UN');addCount(byF,n.sourceFormat||'unknown');var fp=n.fingerprint||[n.protocol,n.server,n.port,n.network,n.tls].join('|').toLowerCase();if(seen[fp])dups++;else seen[fp]=1});d.summary={total:ns.length,unique:Object.keys(seen).length,duplicates:dups,protocols:Object.keys(byP).length,countries:Object.keys(byC).length};d.stats={byProtocol:toArr(byP),byCountry:toArr(byC),byCountryCode:toArr(byCC),bySourceFormat:toArr(byF)};return d}\nfunction render(d){var isNew=(d!==DATA);if(isNew)SELECTED={};(d.nodes||[]).forEach(function(n,i){if(!n._sid)n._sid='sv_'+i;if(!n.originalName)n.originalName=n.name});DATA=recalc(d);var s=DATA.summary||{};var labels=['总节点','唯一节点','重复节点','协议数','国家/地区'];var vals=[s.total,s.unique,s.duplicates,s.protocols,s.countries];$('cards').innerHTML=labels.map(function(l,i){return '<div class=\"stat\"><span class=\"muted\">'+l+'</span><b>'+(vals[i]||0)+'</b></div>'}).join('');var p=DATA.stats.byProtocol||[],c=DATA.stats.byCountry||[];$('protocols').innerHTML=p.length?p.map(function(x){return bar(x,p[0].count)}).join(''):'暂无数据';$('countries').innerHTML=c.length?c.slice(0,30).map(function(x){return bar(x,c[0].count)}).join(''):'暂无数据';fillSelect('pf',p);fillSelect('cf',c);apply();emit('afterRender',DATA)}\nfunction fillSelect(id,arr){var old=$(id).value;$(id).innerHTML='<option value=\"\">'+(id=='pf'?'全部协议':'全部地区')+'</option>'+(arr||[]).map(function(x){return '<option value=\"'+esc(x.key)+'\">'+esc(x.key)+' ('+x.count+')</option>'}).join('');$(id).value=old}\nfunction filtered(){if(!DATA)return[];var ns=$('unique').checked?uniq(DATA.nodes):DATA.nodes;var q=$('q').value.toLowerCase(),pf=$('pf').value,cf=$('cf').value;return ns.filter(function(n){return(!pf||n.protocol==pf)&&(!cf||n.country==cf)&&(!q||(String(n.name)+String(n.server)+String(n.country)+String(n.protocol)+String(n.port)).toLowerCase().indexOf(q)>=0)})}\nfunction meta(n){var a=[];if(n.country)a.push(esc(n.country));if(n.network)a.push(esc(n.network));if(String(n.tls)==='true')a.push('TLS');if(n.geoCity)a.push(esc(n.geoCity));if(n.aliveOK===true)a.push('可用 '+esc(String(n.aliveLatency))+'ms');else if(n.aliveOK===false)a.push('不可用:'+esc(aliveErr(n.aliveError)));if(n.landingError)a.push('失败:'+esc(zhErr(n.landingError)));return a.join(' \\u00b7 ')}\nfunction apply(){var a=filtered(),sc=selectedCount();$('count').textContent='当前显示 '+a.length+' / '+((DATA&&DATA.summary&&DATA.summary.total)||0)+' 个节点，已选 '+sc+' 个';updateSelectUI();$('tbody').innerHTML=a.map(function(n,i){var chk=SELECTED[n._sid]?' checked':'';return '<tr><td><input type=\"checkbox\" class=\"rowchk\" data-sid=\"'+esc(n._sid||'')+'\" onchange=\"window.toggleSelect&&window.toggleSelect(this.dataset.sid,this.checked)\"'+chk+'></td><td>'+(i+1)+'</td><td>'+esc(n.name)+'<div class=\"small\">'+meta(n)+'</div></td><td><span class=\"tag\">'+esc(n.protocol)+'</span></td><td>'+esc(n.server)+'</td><td>'+esc(n.port)+'</td></tr>'}).join('')||'<tr><td colspan=\"6\" class=\"muted\">暂无数据</td></tr>';emit('afterApply',a)}\nfunction loadJSON(url,opt){return fetch(url,opt).then(function(r){return r.text().then(function(t){return{status:r.status,ok:r.ok,text:t}})}).then(function(o){try{var j=JSON.parse(o.text);return j}catch(e){throw new Error(!o.ok?'HTTP '+o.status+': '+o.text.slice(0,150):(o.text.slice(0,200)||String(e)))}})}\nfunction analyzeURL(){var u=$('url').value.trim();if(!u){st('请先输入订阅 URL');return}st('按钮已触发，正在拉取分析…');loadJSON('/api/analyze?url='+encodeURIComponent(u)+'&t='+Date.now()).then(function(d){if(!d.ok)throw new Error(d.error||'error');render(d);st('分析完成：'+d.summary.total+' 个节点')}).catch(function(e){st('失败：'+e.message)})}\nfunction sample(){st('正在载入演示数据…');loadJSON('/api/sample?t='+Date.now()).then(render).then(function(){st('演示数据已加载')}).catch(function(e){st('失败：'+e.message)})}\nfunction analyzeText(){var t=$('raw').value;if(!t.trim()){st('请先粘贴订阅内容');return}st('正在分析粘贴内容…');loadJSON('/api/analyze-text?t='+Date.now(),{method:'POST',body:t,headers:{'Content-Type':'text/plain;charset=utf-8'}}).then(function(d){if(!d.ok)throw new Error(d.error||'error');render(d);st('分析完成：'+d.summary.total+' 个节点')}).catch(function(e){st('失败：'+e.message)})}\nfunction flag(cc){cc=String(cc||'').toUpperCase();if(cc==='CDN')return '\\uD83D\\uDD00';if(!/^[A-Z]{2}$/.test(cc))return '\\uD83C\\uDFC1';return cc.replace(/./g,function(ch){return String.fromCodePoint(127397+ch.charCodeAt(0))})}\nfunction suffix(n,i){var nm=String(n.name||'');var m=nm.match(/[-_ ]([A-Fa-f0-9]{4,10})\\b/);if(m)return m[1].toUpperCase();var base=String(n.server||'')+':'+String(n.port||'')+':'+i;var h=0;for(var x=0;x<base.length;x++){h=((h<<5)-h)+base.charCodeAt(x);h|=0}return ('00000000'+(h>>>0).toString(16).toUpperCase()).slice(-8)}\nfunction isUnknown(n){return !n.countryCode||n.countryCode==='UN'||n.country==='未知'||n.countrySource==='none'}\nfunction applyGeoToServer(server,geo){(DATA.nodes||[]).forEach(function(n,idx){if(n.server!==server||!isUnknown(n)||!geo||!geo.countryCode)return;n.countryCode=geo.countryCode;n.country=geo.country||n.country;n.countrySource='geoip';n.countryConfidence=geo.countryConfidence||78;n.geoProvider=geo.provider;n.geoQuery=geo.query;n.geoCity=geo.city||'';n.geoRegion=geo.region||'';n.geoISP=geo.isp||'';n.geoASN=geo.asn||'';n.name=flag(n.countryCode)+' '+n.country+'-'+suffix(n,idx)})}\nfunction applyGeoToTargets(server,geo,targets){(targets||[]).forEach(function(n,idx){if(n.server!==server||!isUnknown(n)||!geo||!geo.countryCode)return;n.countryCode=geo.countryCode;n.country=geo.country||n.country;n.countrySource='geoip';n.countryConfidence=geo.countryConfidence||78;n.geoProvider=geo.provider;n.geoQuery=geo.query;n.geoCity=geo.city||'';n.geoRegion=geo.region||'';n.geoISP=geo.isp||'';n.geoASN=geo.asn||'';n.name=flag(n.countryCode)+' '+n.country+'-'+suffix(n,idx);if(n.extra)n.extra.name=n.name})}\nfunction geoFill(){if(!DATA){st('请先拉取或分析订阅');return}if(GEO_RUNNING){st('已有 GeoIP / 落地检测任务正在运行；如果刚才点过落地检测没继续，请刷新页面后重试。');return}var targets=operationNodes('GeoIP 补全');if(!targets.length)return;var set={},servers=[];targets.forEach(function(n){if(isUnknown(n)&&n.server&&!set[n.server]){set[n.server]=1;servers.push(n.server)}});if(!servers.length){st('选中节点里没有需要 GeoIP 补全的未知节点');return}GEO_RUNNING=true;var total=servers.length,done=0,ok=0,fail=0,idx=0,con=3;st('开始对选中节点做在线 IP 归属补全：0 / '+total);function next(){while(con>0&&idx<servers.length){(function(sv){idx++;con--;var p=GEO_CACHE[sv]?Promise.resolve(GEO_CACHE[sv]):loadJSON('/api/geoip?host='+encodeURIComponent(sv)+'&t='+Date.now()).then(function(g){GEO_CACHE[sv]=g;return g});p.then(function(g){if(g&&g.ok&&g.countryCode){applyGeoToTargets(sv,g,targets);ok++}else fail++}).catch(function(){fail++}).then(function(){done++;con++;if(done%5===0||done===total){recalc(DATA);apply();st('在线 IP 归属补全：'+done+' / '+total+'，成功 '+ok+'，失败 '+fail)}if(done>=total){GEO_RUNNING=false;render(DATA);st('补全完成：成功 '+ok+'，失败 '+fail+'。已将选中的未知节点按 GeoIP 重命名。')}else next()})})(servers[idx])}}next()}\nvar DEFAULT_DROP='linuxdo,History,OpenRay,Telegram,TG,GitHub,Github,DeltaKroneckerGithub,WangCai,官网,官方,网站,主页,频道,群组,订阅,免费,公益,剩余,流量,到期,过期,有效期,套餐,重置,expire,expiry,traffic,reset,GB,MB,TB,官网地址,永久官网,域名,网址,节点,机场,订阅链接,欢迎,加入,关注';\nvar DEFAULT_KEEP='倍率,原生,机房,商宽,家宽,住宅,广播,专线,中转,直连,隧道,IEPL,IPLC,BGP,CN2,CMI,9929,4837,0.2x,0.5x,1x,2x,3x,5x,10x';\nfunction codeName(n){var cc=String(n.countryCode||'').toUpperCase();var cn=String(n.country||'');if(!cc||cc==='UN'){cc='UN';cn=cn&&cn!=='未知'?cn:'未知'}if(cc==='CDN'){cn='中转'}return {cc:cc,cn:cn,key:cc+'|'+cn}}\nfunction padNum(n,w){n=String(n||'');while(n.length<w)n='0'+n;return n}\nfunction splitRules(v,def){v=String(v||'').trim();if(!v)v=def||'';return v.split(/[\\n,，;；]+/).map(function(x){return String(x||'').trim()}).filter(Boolean)}\nfunction escRe(s){return String(s||'').replace(/[.*+?^${}()|[\\]\\\\]/g,'\\\\$&')}\nfunction ruleValue(id,def){var el=$(id);return el?el.value:def}\nfunction cleanupOptions(){return {drop:splitRules(ruleValue('dropWords',DEFAULT_DROP),DEFAULT_DROP),keep:splitRules(ruleValue('keepTags',DEFAULT_KEEP),DEFAULT_KEEP),tpl:String(ruleValue('nameTpl','{flag} {code}-{country} {index} {tags}')||'{flag} {code}-{country} {index} {tags}')}}\nfunction stripNoise(t,drop){t=String(t||'');t=t.replace(/https?:\\/\\/\\S+/ig,' ');t=t.replace(/www\\.[^\\s|]+/ig,' ');t=t.replace(/[A-Za-z0-9._%+-]+\\.[A-Za-z]{2,}(?:[\\/\\w?=&%.:+-]*)?/g,' ');t=t.replace(/@\\w+/g,' ');t=t.replace(/[\\uD83C-\\uDBFF][\\uDC00-\\uDFFF]/g,' ');(drop||[]).forEach(function(w){if(!w)return;var re=new RegExp(escRe(w),'ig');t=t.replace(re,' ')});return t.replace(/[\\[\\]【】()（）{}<>《》]/g,' ').replace(/[|｜/\\\\]+/g,' ').replace(/[_-]+/g,' ').replace(/\\s+/g,' ').trim()}\nfunction uniqTags(arr){var m={},out=[];arr.forEach(function(x){x=String(x||'').trim();if(!x||m[x.toLowerCase()])return;m[x.toLowerCase()]=1;out.push(x)});return out}\nfunction normalizeRate(r){r=String(r||'').replace(/倍率\\s*[:：=]?\\s*/,'').replace(/\\s+/g,'').replace(/×/g,'x').replace(/倍$/,'x').replace(/X$/,'x');if(/^\\d+(?:\\.\\d+)?$/.test(r))r=r+'x';return /^\\d+(?:\\.\\d+)?x$/.test(r)?r:''}\nfunction extractNameTags(n,opt){opt=opt||cleanupOptions();var e=n.extra||{};var src=[n.originalName,n.rawName,n.name,e.name,e.rate,e.ratio,e['倍率'],e.tag,e.label,e.remark,e.remarks,e.note,e.sni,e.servername,e.host,e.Host,e.path,e.plugin,e.mode].join(' ');var raw=String(src||''),txt=stripNoise(raw,opt.drop);var tags=[];var ms=raw.match(/(?:\\d+(?:\\.\\d+)?\\s*(?:x|X|×|倍)|倍率\\s*[:：=]?\\s*\\d+(?:\\.\\d+)?)/g)||[];ms.forEach(function(r){r=normalizeRate(r);if(r)tags.push(r)});(opt.keep||[]).forEach(function(k){var kk=String(k||'').trim();if(!kk)return;if(/^\\d+(?:\\.\\d+)?x$/i.test(kk)){if(new RegExp(escRe(kk),'i').test(raw))tags.push(kk.toLowerCase());return}var re=new RegExp(escRe(kk),'i');if(re.test(txt)||re.test(raw))tags.push(kk.toUpperCase()===kk?kk:kk)});return uniqTags(tags)}\nfunction cleanBaseName(n,opt){opt=opt||cleanupOptions();var e=n.extra||{};var src=[n.rawName,n.originalName,n.name,e.name].filter(function(x){return x!=null&&String(x)!==''})[0]||'';return stripNoise(src,opt.drop)}\nfunction templateCleanName(n,seq,width,opt){opt=opt||cleanupOptions();var c=codeName(n);var tags=extractNameTags(n,opt);var cleanName=cleanBaseName(n,opt);var mp={flag:flag(c.cc),code:c.cc,country:c.cn,index:padNum(seq,width),seq:String(seq),tags:tags.join(' '),tag:tags.join(' '),name:cleanName,clean:cleanName,cleanName:cleanName};var out=String(opt.tpl||'{flag} {code}-{country} {index} {tags}').replace(/\\{(flag|code|country|index|seq|tags|tag|name|clean|cleanName)\\}/g,function(_,k){return mp[k]||''});return out.replace(/\\s+/g,' ').replace(/\\s+([,，;；])/g,'$1').trim()}\nfunction currentOrSelectedNodes(){var nodes=selectedNodes();if(nodes.length)return {nodes:nodes,scope:'选中'};var cur=filtered();return {nodes:cur,scope:'当前显示'}}\nfunction cleanNames(){if(!DATA){st('请先拉取或分析订阅');return}var picked=currentOrSelectedNodes();var nodes=picked.nodes;if(!nodes.length){st('当前没有可清理的节点');return}var opt=cleanupOptions();st('正在按当前清理规则重命名'+picked.scope+'节点……');var totals={},seq={},cnt=0;nodes.forEach(function(n){if(!n.originalName)n.originalName=n.name;if(!n.rawName)n.rawName=n.originalName;var k=codeName(n).key;totals[k]=(totals[k]||0)+1});nodes.forEach(function(n){var c=codeName(n),w=Math.max(2,String(totals[c.key]||1).length);seq[c.key]=(seq[c.key]||0)+1;var nn=templateCleanName(n,seq[c.key],w,opt);if(nn&&nn!==n.name){n.name=nn;if(n.extra)n.extra.name=nn;cnt++}});render(DATA);st('已按当前规则清理'+picked.scope+'节点 '+cnt+' 个。已保留 rawName/originalName，可随时恢复；复制和导出会使用清理后的名称。')}\nfunction restoreNames(){if(!DATA){st('请先拉取或分析订阅');return}var nodes=operationNodes('恢复原始名');if(!nodes.length)return;var cnt=0;nodes.forEach(function(n){var old=n.rawName||n.originalName;if(old&&old!==n.name){n.name=old;if(n.extra)n.extra.name=old;cnt++}});render(DATA);st('已恢复选中节点原始名称 '+cnt+' 个')}\nfunction dl(name,txt,type){var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt],{type:type||'text/plain;charset=utf-8'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},1000)}\nfunction b64utf8(s){return btoa(unescape(encodeURIComponent(String(s||''))))}\nfunction b64url(s){return b64utf8(s).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'')}\nfunction enc(s){return encodeURIComponent(String(s==null?'':s))}\nfunction qyaml(s){s=String(s==null?'':s);return '\"'+s.replace(/\\\\/g,'\\\\\\\\').replace(/\"/g,'\\\\\"').replace(/\\n/g,'\\\\n')+'\"'}\nfunction yamlKey(k){k=String(k||'');return /^[A-Za-z0-9_-]+$/.test(k)?k:qyaml(k)}\nfunction isBoolKey(k){return /^(tls|udp|skip-cert-verify|allow-insecure|insecure|udp-relay|fast-open|tfo|smux|xudp)$/i.test(String(k||''))}\nfunction isNumKey(k){return /^(port|alterId|alterid|aid|up|down|mtu|recv-window|recv_window|hop-interval|hop_interval|download-bandwidth|upload-bandwidth)$/i.test(String(k||''))}\nfunction yval(v,k){if(v===true||v===false)return String(v);if(v===null||v===undefined||v==='')return '\"\"';var s=String(v);if(isBoolKey(k)&&/^(true|false)$/i.test(s))return s.toLowerCase();if(isNumKey(k)&&/^[-+]?\\d+(\\.\\d+)?$/.test(s))return s;return qyaml(s)}\nfunction deepClone(v){if(v===undefined||typeof v==='function')return undefined;if(Array.isArray(v))return v.map(deepClone).filter(function(x){return x!==undefined});if(v&&typeof v==='object'){var r={};Object.keys(v).forEach(function(k){var x=deepClone(v[k]);if(x!==undefined)r[k]=x});return r}return v}\nfunction clone(o){var r={},drop={raw:1,extra:1,fingerprint:1,_sid:1,originalName:1,rawName:1,nameBeforeAlive:1,aliveOK:1,aliveLatency:1,aliveStatus:1,aliveError:1,landingError:1,geoProvider:1,geoQuery:1,geoCity:1,geoRegion:1,geoISP:1,geoASN:1,country:1,countryCode:1,countrySource:1,countryConfidence:1,sourceFormat:1};o=o||{};Object.keys(o).forEach(function(k){if(drop[k]||o[k]===undefined)return;var v=deepClone(o[k]);if(v!==undefined)r[k]=v});return r}\nfunction firstNonEmpty(){for(var i=0;i<arguments.length;i++){var v=arguments[i];if(v!==null&&v!==undefined&&String(v)!=='')return v}return ''}\nfunction pruneEmpty(v){if(Array.isArray(v)){for(var i=v.length-1;i>=0;i--){var x=pruneEmpty(v[i]);if(x===undefined)v.splice(i,1);else v[i]=x}return v.length?v:undefined}if(v&&typeof v==='object'){Object.keys(v).forEach(function(k){var x=pruneEmpty(v[k]);if(x===undefined)delete v[k];else v[k]=x});return Object.keys(v).length?v:undefined}if(v===undefined||v===null||v==='')return undefined;return v}\nfunction getWSPath(e){return firstNonEmpty(e.path,e['ws-path'],e['ws-opts']&&e['ws-opts'].path)}\nfunction getWSHost(e){return firstNonEmpty(e.Host,e.host,e['ws-host'],e['ws-opts']&&e['ws-opts'].headers&&e['ws-opts'].headers.Host,e['ws-opts']&&e['ws-opts'].headers&&e['ws-opts'].headers.host,e.headers&&e.headers.Host,e.headers&&e.headers.host)}\nfunction getGrpcService(e){return firstNonEmpty(e['grpc-service-name'],e.serviceName,e['service-name'],e['grpc-opts']&&e['grpc-opts']['grpc-service-name'],e['grpc-opts']&&e['grpc-opts']['service-name'],e['grpc-opts']&&e['grpc-opts'].serviceName)}\nfunction getRealityPBK(e){return firstNonEmpty(e['reality-public-key'],e['public-key'],e.publicKey,e.pbk,e['reality-opts']&&e['reality-opts']['public-key'],e['reality-opts']&&e['reality-opts'].publicKey,e['reality-opts']&&e['reality-opts'].pbk)}\nfunction getRealitySID(e){return firstNonEmpty(e['reality-short-id'],e['short-id'],e.shortId,e.sid,e['reality-opts']&&e['reality-opts']['short-id'],e['reality-opts']&&e['reality-opts'].shortId,e['reality-opts']&&e['reality-opts'].sid)}\nfunction getFP(e){return firstNonEmpty(e['client-fingerprint'],e.fingerprint,e.fp)}\nfunction getSNI(e){return firstNonEmpty(e.sni,e.servername,e.serverName,e['server-name'],e.server_name)}\nfunction getALPN(e){var a=e.alpn;if(Array.isArray(a))return a.join(',');return firstNonEmpty(a,e.alpns)}\nfunction normalizeClashForExport(o,n){o=o||{};n=n||{};if(!o.name)o.name=n.name;if(!o.type)o.type=n.protocol;if(!o.server)o.server=n.server;if(!o.port)o.port=n.port;if(n.network&&!o.network)o.network=n.network;if(n.tls&&!o.tls)o.tls=n.tls;var net=String(o.network||'').toLowerCase();if(net==='websocket')o.network='ws';if(net==='h2')o.network='grpc';if(String(o.network||'').toLowerCase()==='ws'){var path=getWSPath(o);var host=getWSHost(o);if(path||host){if(!o['ws-opts']||typeof o['ws-opts']!=='object')o['ws-opts']={};if(path&&!o['ws-opts'].path)o['ws-opts'].path=path;if(host){if(!o['ws-opts'].headers||typeof o['ws-opts'].headers!=='object')o['ws-opts'].headers={};if(!o['ws-opts'].headers.Host&&!o['ws-opts'].headers.host)o['ws-opts'].headers.Host=host}}delete o.path;delete o['ws-path'];delete o.Host;delete o.host;delete o['ws-host']}var svc=getGrpcService(o);if(String(o.network||'').toLowerCase()==='grpc'||svc){o.network='grpc';if(svc){if(!o['grpc-opts']||typeof o['grpc-opts']!=='object')o['grpc-opts']={};if(!o['grpc-opts']['grpc-service-name'])o['grpc-opts']['grpc-service-name']=svc}delete o['grpc-service-name'];delete o.serviceName;delete o['service-name']}var pbk=getRealityPBK(o);var sid=getRealitySID(o);if(pbk||sid){if(!o['reality-opts']||typeof o['reality-opts']!=='object')o['reality-opts']={};if(pbk&&!o['reality-opts']['public-key'])o['reality-opts']['public-key']=pbk;if(sid&&!o['reality-opts']['short-id'])o['reality-opts']['short-id']=sid;delete o['reality-public-key'];delete o['public-key'];delete o.publicKey;delete o.pbk;delete o['reality-short-id'];delete o['short-id'];delete o.shortId;delete o.sid}return pruneEmpty(o)||{} }\nfunction yamlEmit(lines,indent,key,val){if(val===undefined||typeof val==='function')return;var sp=' '.repeat(indent);if(Array.isArray(val)){if(!val.length){lines.push(sp+yamlKey(key)+': []');return}lines.push(sp+yamlKey(key)+':');val.forEach(function(x){if(x&&typeof x==='object'){lines.push(sp+'  -');Object.keys(x).forEach(function(ck){yamlEmit(lines,indent+4,ck,x[ck])})}else lines.push(sp+'  - '+yval(x,key))});return}if(val&&typeof val==='object'){var ks=Object.keys(val).filter(function(k){return val[k]!==undefined&&typeof val[k]!=='function'});if(!ks.length){lines.push(sp+yamlKey(key)+': {}');return}lines.push(sp+yamlKey(key)+':');ks.forEach(function(ck){yamlEmit(lines,indent+2,ck,val[ck])});return}lines.push(sp+yamlKey(key)+': '+yval(val,key))}\nfunction orderedKeys(o){var order=['type','server','port','cipher','uuid','password','username','alterId','alterid','network','tls','udp','sni','servername','server-name','client-fingerprint','flow','encryption','skip-cert-verify','alpn','ws-opts','grpc-opts','reality-opts','plugin','plugin-opts','headers','obfs','obfs-password','up','down','auth','auth-str','token','version'];var used={},out=[];order.forEach(function(k){if(o[k]!==undefined&&k!=='name'){out.push(k);used[k]=1}});Object.keys(o).forEach(function(k){if(k!=='name'&&!used[k])out.push(k)});return out}\nfunction exportNodes(){var a=selectedNodes();if(!a.length)throw new Error('请先勾选要复制/导出的节点，或点击“全选当前”');return a}\nfunction toClashYAML(){var a=exportNodes();if(!a.length)throw new Error('没有可导出的节点');var lines=['mixed-port: 7890','allow-lan: false','mode: rule','log-level: info','','proxies:'];a.forEach(function(n){var o=normalizeClashForExport(clone(n.extra),n);o.name=n.name;o.type=o.type||n.protocol;o.server=o.server||n.server;o.port=o.port||n.port;lines.push('  - name: '+qyaml(o.name));orderedKeys(o).forEach(function(k){yamlEmit(lines,4,k,o[k])})});lines.push('','proxy-groups:','  - name: '+qyaml('🚀 节点选择'),'    type: select','    proxies:');a.forEach(function(n){lines.push('      - '+qyaml(n.name))});lines.push('','rules:','  - MATCH,'+qyaml('🚀 节点选择'));return lines.join('\\n')+'\\n'}\nfunction uriHost(h){h=String(h||'');return h.indexOf(':')>=0&&h[0]!=='['?'['+h+']':h}\nfunction addQ(q,k,v){if(v===null||v===undefined||String(v)==='')return;q.push(enc(k)+'='+enc(v))}\nfunction addBoolQ(q,k,v){if(v===null||v===undefined||v==='')return;var s=String(v).toLowerCase();q.push(enc(k)+'='+(s==='true'||s==='1'||s==='yes'?'1':'0'))}\nfunction tlsSecurity(e){var sec=String(e.security||'').toLowerCase();if(sec==='reality')return 'reality';if(sec==='tls'||String(e.tls).toLowerCase()==='true')return 'tls';return ''}\nfunction addTransportQ(q,e){var net=String(e.network||e.net||'').toLowerCase();if(net==='websocket')net='ws';if(net==='h2')net='grpc';if(net)addQ(q,'type',net);if(net==='ws'){addQ(q,'host',getWSHost(e));addQ(q,'path',getWSPath(e))}if(net==='grpc'){addQ(q,'serviceName',getGrpcService(e));addQ(q,'mode',e.mode)}}\nfunction uriFor(n){var e=n.extra||{},p=String(n.protocol||e.type||'').toLowerCase(),name=enc(n.name),server=uriHost(e.server||n.server),port=e.port||n.port;if(p==='hy2')p='hysteria2';if(p==='socks')p='socks5';if(!server||!port)return null;\nif(p==='ss'){var method=e.cipher||e.method||e['encrypt-method']||'none',pass=e.password||n.id||'';var u='ss://'+b64url(method+':'+pass)+'@'+server+':'+port;var plug=e.plugin||'';if(plug){var ps=[plug];['mode','host','path','tls','mux'].forEach(function(k){if(e[k])ps.push(k+'='+e[k])});u+='?plugin='+enc(ps.join(';'))}return u+'#'+name}\nif(p==='trojan'){var q=[];var pass=e.password||n.id||'';var sec=tlsSecurity(e);if(sec)addQ(q,'security',sec);addQ(q,'sni',getSNI(e));addTransportQ(q,e);return 'trojan://'+enc(pass)+'@'+server+':'+port+(q.length?'?'+q.join('&'):'')+'#'+name}\nif(p==='vless'){var pbk=getRealityPBK(e),sid=getRealitySID(e),fp=getFP(e),q2=['encryption='+enc(e.encryption||'none')];var sec=tlsSecurity(e);if(pbk)sec='reality';if(sec)addQ(q2,'security',sec);addTransportQ(q2,e);addQ(q2,'sni',getSNI(e));addQ(q2,'flow',e.flow);addQ(q2,'pbk',pbk);addQ(q2,'sid',sid);addQ(q2,'fp',fp);return 'vless://'+enc(e.uuid||n.id||'')+'@'+server+':'+port+'?'+q2.join('&')+'#'+name}\nif(p==='vmess'){var net=String(e.network||n.network||'tcp').toLowerCase();if(net==='websocket')net='ws';var obj={v:'2',ps:n.name,add:e.server||n.server,port:String(port),id:e.uuid||n.id||'',aid:String(e.alterId||e.aid||'0'),scy:e.cipher||e.scy||'auto',net:net,type:e.type||'',host:getWSHost(e),path:getWSPath(e)||getGrpcService(e)||'',tls:tlsSecurity(e)==='tls'?'tls':'',sni:getSNI(e)};return 'vmess://'+b64utf8(JSON.stringify(obj))}\nif(p==='hysteria2'||p==='hysteria'){var qh=[],pass=e.password||e.auth||e['auth-str']||n.id||'';addQ(qh,'sni',getSNI(e));addBoolQ(qh,'insecure',e.insecure||e['skip-cert-verify']||e.allowInsecure);addQ(qh,'obfs',e.obfs);addQ(qh,'obfs-password',e['obfs-password']||e.obfsPassword);addQ(qh,'alpn',getALPN(e));addQ(qh,'up',e.up||e['upload-bandwidth']||e.uploadBandwidth);addQ(qh,'down',e.down||e['download-bandwidth']||e.downloadBandwidth);return 'hysteria2://'+enc(pass)+'@'+server+':'+port+(qh.length?'?'+qh.join('&'):'')+'#'+name}\nif(p==='tuic'){var qt=[],uuid=e.uuid||e.id||n.id||'',pwd=e.password||e.passwd||'';addQ(qt,'sni',getSNI(e));addQ(qt,'alpn',getALPN(e)||'h3');addQ(qt,'congestion_control',e.congestion_control||e['congestion-controller']||e.congestionController);addQ(qt,'udp_relay_mode',e.udp_relay_mode||e['udp-relay-mode']||e.udpRelayMode);addBoolQ(qt,'allow_insecure',e['skip-cert-verify']||e.allowInsecure||e.insecure);return 'tuic://'+enc(uuid)+(pwd?':'+enc(pwd):'')+'@'+server+':'+port+(qt.length?'?'+qt.join('&'):'')+'#'+name}\nif(p==='snell'){var qs=[],psk=e.psk||e.password||n.id||'';addQ(qs,'version',e.version||'4');addQ(qs,'obfs',e.obfs);addQ(qs,'obfs-host',e['obfs-host']||e.obfsHost||e.host);return 'snell://'+enc(psk)+'@'+server+':'+port+(qs.length?'?'+qs.join('&'):'')+'#'+name}\nif(p==='socks5'||p==='http'||p==='https'){var user=e.username||e.user||'',pwd=e.password||e.pass||'',auth=user?enc(user)+(pwd?':'+enc(pwd):'')+'@':'';return p+'://'+auth+server+':'+port+'#'+name}\nif(p==='anytls'){var qa=[],ap=e.password||e.passwd||n.id||'';addQ(qa,'security','tls');addQ(qa,'sni',getSNI(e));addBoolQ(qa,'insecure',e.insecure||e['skip-cert-verify']||e.allowInsecure);return 'anytls://'+enc(ap)+'@'+server+':'+port+(qa.length?'?'+qa.join('&'):'')+'#'+name}\nif(/^\\w+:\\/\\//.test(String(n.raw||'')))return String(n.raw);return null}\nfunction toURIText(){var a=exportNodes(),out=[],skip=0;a.forEach(function(n){var u=uriFor(n);if(u)out.push(u);else skip++});if(!out.length)throw new Error('当前节点无法导出为 URI');if(skip)st('已跳过 '+skip+' 个暂不支持 URI 的节点');return out.join('\\n')+'\\n'}\nfunction jsn(){var a=exportNodes();return JSON.stringify({ok:true,summary:{selected:a.length,total:(DATA&&DATA.nodes&&DATA.nodes.length)||0},nodes:a,meta:(DATA&&DATA.meta)||{}},null,2)}\nfunction buildExportPayload(){if(!DATA)throw new Error('请先拉取或分析订阅');var t=$('exportType').value,c=selectedNodes().length;if(!c)throw new Error('请先勾选要复制/导出的节点，或点击“全选当前”');if(t==='json')return {name:'subviz-selected.json',text:jsn(),type:'application/json;charset=utf-8',label:'JSON 备份',count:c};if(t==='clash'){var y=toClashYAML();return {name:'subviz-selected-clash.yaml',text:y,type:'application/x-yaml;charset=utf-8',label:'Clash YAML',count:c}}if(t==='uri64'){var u64=b64utf8(toURIText());return {name:'subviz-selected-uri-base64.txt',text:u64,type:'text/plain;charset=utf-8',label:'Base64 URI 订阅',count:c}}var u=toURIText();return {name:'subviz-selected-uri.txt',text:u,type:'text/plain;charset=utf-8',label:'通用 URI 订阅',count:c}}\nwindow.doExport=function doExport(){try{var p=buildExportPayload();dl(p.name,p.text,p.type);st('已导出 '+p.label+(p.count!=null?'：'+p.count+' 个节点':''))}catch(e){st('导出失败：'+e.message)}}\nfunction fallbackCopy(txt){var ta=document.createElement('textarea');ta.value=txt;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.left='-9999px';document.body.appendChild(ta);ta.select();ta.setSelectionRange(0,ta.value.length);var ok=false;try{ok=document.execCommand('copy')}catch(e){}ta.remove();return ok}\nwindow.copyExport=function copyExport(){try{var p=buildExportPayload();var done=function(){st('已复制 '+p.label+' 到剪贴板'+(p.count!=null?'：'+p.count+' 个节点':''))};if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(p.text).then(done).catch(function(){if(fallbackCopy(p.text))done();else st('复制失败：请改用导出文件')})}else{if(fallbackCopy(p.text))done();else st('复制失败：当前浏览器不允许写入剪贴板')}}catch(e){st('复制失败：'+e.message)}}\n\n\nfunction aliveErr(s){s=String(s||'');var l=s.toLowerCase();if(!s)return '检测失败';if(l.indexOf('timeout')>=0||s.indexOf('超时')>=0)return '请求超时：节点无响应、速度过慢，或当前检测超时设置偏短';if(l.indexOf('connection refused')>=0)return '连接被拒绝：服务器端口关闭、节点失效，或服务端主动拒绝';if(l.indexOf('websocket closed')>=0)return 'WebSocket 被关闭：常见原因是 Host/SNI/path 不匹配、CDN 回源拒绝，或节点已失效';if(l.indexOf('load failed')>=0)return '连接失败：节点不可达、TLS/握手失败，或当前网络阻断';if(s.indexOf('状态码不匹配')>=0)return s;if(l.indexOf('policy descriptor')>=0||s.indexOf('临时代理策略')>=0)return 'Surge 临时代理策略创建失败';if(l.indexOf('unsupported')>=0||s.indexOf('不支持')>=0)return '当前协议不支持测活';return s}\nfunction cfgVal(id,def){var el=$(id);var v=el?String(el.value==null?'':el.value).trim():'';return v?v:String(def==null?'':def)}\nfunction cfgChecked(id){var el=$(id);return !!(el&&el.checked)}\nfunction cfgInt(id,def,min,max){var raw=cfgVal(id,def),n=parseInt(raw,10);if(!isFinite(n)||n<min||n>max)n=def;return Math.max(min,Math.min(max,n))}\nfunction cfgString(id,def){return cfgVal(id,def)}\nfunction cfgList(id){var raw=cfgVal(id,'');return raw?raw.split(/[\\n|,，]+/).map(function(x){return String(x||'').trim()}).filter(Boolean):[]}\nfunction qsAdd(k,v){v=String(v==null?'':v).trim();return v?'&'+encodeURIComponent(k)+'='+encodeURIComponent(v):''}\nfunction getAliveSettings(){return {url:cfgString('aliveUrl','http://connectivitycheck.platform.hicloud.com/generate_204'),status:cfgString('aliveStatus','204'),concurrency:cfgInt('aliveCon',5,1,20),timeout:cfgInt('aliveTimeout',3000,200,30000),retries:cfgInt('aliveRetries',1,0,3),retryDelay:cfgInt('aliveRetryDelay',1000,0,5000),showLatency:cfgChecked('aliveShowLatency')}}\nfunction aliveQS(cfg){cfg=cfg||getAliveSettings();var q='';q+=qsAdd('url',cfg.url);q+=qsAdd('status',cfg.status);q+=qsAdd('timeout',cfg.timeout);q+=qsAdd('retries',cfg.retries);q+=qsAdd('retry_delay',cfg.retryDelay);return q}\nfunction applyAliveName(n,cfg){cfg=cfg||getAliveSettings();if(!cfg.showLatency)return;if(n.aliveOK!==true||!n.aliveLatency)return;if(!n.nameBeforeAlive)n.nameBeforeAlive=n.name;n.name=String(n.nameBeforeAlive).replace(/^\\[\\d+ms\\]\\s*/,'');n.name='['+n.aliveLatency+'ms] '+n.name;if(n.extra)n.extra.name=n.name}\nfunction runLimitedTasks(items,limit,worker,onProgress,onDone){items=items||[];limit=Math.max(1,Math.min(Number(limit)||1,items.length||1));var idx=0,active=0,done=0,stopped=false,maxActive=0;function pump(){if(stopped)return;if(done>=items.length&&active===0){if(onDone)onDone({done:done,maxActive:maxActive});return}while(active<limit&&idx<items.length){(function(item,order){idx++;active++;if(active>maxActive)maxActive=active;Promise.resolve().then(function(){return worker(item,order)}).catch(function(e){if(onProgress)onProgress(item,order,e)}).then(function(){active--;done++;if(onProgress)onProgress(item,order,null,done,items.length,maxActive);pump()})})(items[idx],idx)}}pump();return {cancel:function(){stopped=true},getMaxActive:function(){return maxActive}}}\nfunction aliveTest(){try{if(!DATA){st('请先拉取或分析订阅');return}if(GEO_RUNNING){st('已有检测任务正在运行；如果刚才没有进度，请刷新页面后重试。');return}var nodes=operationNodes('测活');if(!nodes.length)return;var cfg=getAliveSettings(),q=aliveQS(cfg);GEO_RUNNING=true;var total=nodes.length,done=0,ok=0,fail=0,errMap={};st('开始对选中的 '+total+' 个节点测活：并发 '+cfg.concurrency+'，超时 '+cfg.timeout+'ms，0 / '+total);runLimitedTasks(nodes,cfg.concurrency,function(n){return loadJSON('/api/availability?t='+Date.now()+q,{method:'POST',body:JSON.stringify(n),headers:{'Content-Type':'application/json;charset=utf-8'}}).then(function(r){if(r&&r.ok&&r.alive){n.aliveOK=true;n.aliveLatency=r.latency||r.totalLatency||0;n.aliveStatus=r.status;n.aliveError='';applyAliveName(n,cfg);ok++}else{var er=aliveErr((r&&r.error)||'检测失败');n.aliveOK=false;n.aliveError=er;errMap[er]=(errMap[er]||0)+1;fail++}}).catch(function(e){var er=aliveErr(e.message||String(e));n.aliveOK=false;n.aliveError=er;errMap[er]=(errMap[er]||0)+1;fail++})},function(_n,_i,_err,d,t){if(d){done=d;recalc(DATA);apply();st('测活：'+done+' / '+t+'，并发 '+cfg.concurrency+'，可用 '+ok+'，不可用 '+fail)}},function(){GEO_RUNNING=false;render(DATA);var es=Object.keys(errMap).slice(0,3).map(function(k){return k+'×'+errMap[k]}).join('；');st('测活完成：已检测选中的 '+total+' 个节点，实际按 '+cfg.concurrency+' 并发调度，超时 '+cfg.timeout+'ms，可用 '+ok+'，不可用 '+fail+(es?'。失败原因：'+es:''))})}catch(e){GEO_RUNNING=false;st('测活启动失败：'+aliveErr(e&&e.message?e.message:String(e)))}}\nfunction getLandingSettings(){var apis=cfgList('landingApis');return {concurrency:cfgInt('landingCon',2,1,10),timeout:cfgInt('landingTimeout',5000,200,30000),retries:cfgInt('landingRetries',1,0,3),retryDelay:800,format:cfgString('landingFormat',''),internal:cfgChecked('landingInternal'),apis:apis}}\nfunction landingQS(cfg){cfg=cfg||getLandingSettings();var q='';q+=qsAdd('timeout',cfg.timeout);q+=qsAdd('retries',cfg.retries);if(cfg.retryDelay!=null)q+=qsAdd('retry_delay',cfg.retryDelay);if(cfg.apis&&cfg.apis.length)q+=qsAdd('api',cfg.apis.join('|'));q+=qsAdd('format',cfg.format);if(cfg.internal)q+=qsAdd('internal','1');return q}\nfunction landingFormatName(format,n,seq,width){format=String(format||'').trim();if(!format)return '';var cc=String(n.countryCode||n.landingCountryCode||'UN').toUpperCase();var cn=String(n.country||n.landingCountry||'未知');var tags=(extractNameTags?extractNameTags(n,cleanupOptions()):[]).join(' ');var mp={flag:flag(cc),code:cc,country:cn,index:padNum(seq,width),seq:String(seq),tags:tags,tag:tags,ip:n.landingIP||'',city:n.landingCity||n.geoCity||'',isp:n.landingISP||n.geoISP||'',asn:n.landingASN||n.geoASN||''};return format.replace(/\\{(flag|code|country|index|seq|tags|tag|ip|city|isp|asn)\\}/g,function(_,k){return mp[k]||''}).replace(/\\s+/g,' ').trim()}\nfunction landingApplyOne(n,r,cfg){if(!r||!r.ok)return;var cc=String(r.countryCode||'').toUpperCase();if(!cc)return;n.landingOK=true;n.landingIP=r.landingIP||r.query||'';n.landingCountryCode=cc;n.landingCountry=r.country||cc;n.landingProvider=r.provider||'';n.landingCity=r.city||'';n.landingRegion=r.region||'';n.landingISP=r.isp||'';n.landingASN=r.asn||'';n.landingAPI=r.usedAPI||r.landingAPI||'';n.landingLatency=r.latency||'';n.landingAttempts=r.attempts||'';n.entryServer=r.entryServer||n.server;n.entryPort=r.entryPort||n.port;n.countryCode=cc;n.country=r.country||n.country||cc;n.countrySource='landing';n.countryConfidence=96;n.geoCity=r.city||'';n.geoISP=r.isp||'';n.geoASN=r.asn||'';n.landingFormattedName=r.formattedName||'';n._landingNameFormat=(cfg&&cfg.format)||'';}\nfunction applyLandingNames(cfg){if(!DATA)return;cfg=cfg||getLandingSettings();var totals={},counters={};(DATA.nodes||[]).forEach(function(n){if(n.countrySource!=='landing')return;var cc=String(n.countryCode||'UN').toUpperCase();var cn=String(n.country||'未知');var key=cc+'|'+cn;totals[key]=(totals[key]||0)+1});(DATA.nodes||[]).forEach(function(n){var cc=String(n.countryCode||'UN').toUpperCase();var cn=String(n.country||'未知');var key=cc+'|'+cn;if(n.countrySource==='landing'){counters[key]=(counters[key]||0)+1;var width=Math.max(2,String(totals[key]||1).length);var idx=padNum(counters[key],width);var old=n.name;if(!n.originalName)n.originalName=old;var formatted=n.landingFormattedName||landingFormatName(cfg.format,n,counters[key],width);n.name=formatted||flag(cc)+' '+cc+'-'+cn+' '+idx;if(n.extra)n.extra.name=n.name;}})}\nfunction landingTest(){try{if(!DATA){st('请先拉取或分析订阅');return}if(GEO_RUNNING){st('已有 GeoIP / 落地检测任务正在运行；如果刚才没有进度，请刷新页面后重试。');return}var nodes=operationNodes('落地检测');if(!nodes.length)return;var cfg=getLandingSettings(),q=landingQS(cfg);GEO_RUNNING=true;var total=nodes.length,done=0,ok=0,fail=0,errMap={};st('开始对选中的 '+total+' 个节点做落地检测：并发 '+cfg.concurrency+'，超时 '+cfg.timeout+'ms，0 / '+total+'。');runLimitedTasks(nodes,cfg.concurrency,function(n){return loadJSON('/api/landing?t='+Date.now()+q,{method:'POST',body:JSON.stringify(n),headers:{'Content-Type':'application/json;charset=utf-8'}}).then(function(r){if(r&&r.ok){landingApplyOne(n,r,cfg);ok++}else{var er=(r&&r.error)||'failed'; if(r&&r.descriptorProtocol)er+='('+r.descriptorProtocol+')'; var z=zhErr(er); n.landingOK=false;n.landingError=z;n.landingErrorRaw=er;errMap[z]=(errMap[z]||0)+1;fail++}}).catch(function(e){var er=e.message||String(e);var z=zhErr(er);n.landingOK=false;n.landingError=z;n.landingErrorRaw=er;errMap[z]=(errMap[z]||0)+1;fail++})},function(_n,_i,_err,d,t){if(d){done=d;applyLandingNames(cfg);recalc(DATA);apply();st('落地检测：'+done+' / '+t+'，并发 '+cfg.concurrency+'，成功 '+ok+'，失败 '+fail)}},function(){GEO_RUNNING=false;applyLandingNames(cfg);render(DATA);var es=Object.keys(errMap).slice(0,3).map(function(k){return k+'×'+errMap[k]}).join('；');st('落地检测完成：已检测选中的 '+total+' 个节点，实际按 '+cfg.concurrency+' 并发调度，超时 '+cfg.timeout+'ms，成功 '+ok+'，失败 '+fail+'。仅对成功获取落地的节点重命名。'+(es?' 失败原因：'+es:''))})}catch(e){GEO_RUNNING=false;st('落地检测启动失败：'+zhErr(e&&e.message?e.message:String(e)))}}\n/* ── Centralized window exports ── */\nwindow.toggleSelect=toggleSelect;\nwindow.selectCurrent=selectCurrent;\nwindow.invertCurrent=invertCurrent;\nwindow.clearSelected=clearSelected;\nwindow.cleanNames=cleanNames;\nwindow.restoreNames=restoreNames;\nwindow.geoFill=geoFill;\nwindow.landingTest=landingTest;\nwindow.aliveTest=aliveTest;\n/* ── End exports ── */\nwindow.addEventListener('DOMContentLoaded',function(){['q','pf','cf','unique'].forEach(function(id){var el=$(id);if(!el)return;el.addEventListener('input',apply);el.addEventListener('change',apply)});function bind(id,fn){var el=$(id);if(el)el.onclick=fn}bind('pull',analyzeURL);bind('demo',sample);bind('textBtn',analyzeText);bind('geo',geoFill);bind('landing',landingTest);bind('alive',function(){window.aliveTest()});bind('cleanNames',window.cleanNames);bind('applyRules',window.cleanNames);bind('restoreNames',window.restoreNames);bind('exportBtn',window.doExport);bind('copyBtn',window.copyExport);bind('selectCurrent',window.selectCurrent);bind('invertCurrent',window.invertCurrent);bind('clearSelected',window.clearSelected);});\n\n/* ── sv132: layout grid / meta row / copyAlive ── */\nfunction sv132ById(id){return document.getElementById(id)}\nfunction sv132EnsureStyle(){\n  if(sv132ById('sv132Style')) return;\n  var style=document.createElement('style');\n  style.id='sv132Style';\n  style.textContent=\n    '.sv-meta-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:10px 0 14px;}'+\n    '.sv-meta-row label{margin:0!important;}'+\n    '.sv-pill{display:inline-flex;align-items:center;justify-content:center;padding:8px 14px;border-radius:999px;background:rgba(76,132,255,.16);color:#dce7ff;font-weight:700;margin:0;}'+\n    '.sv-mini-grid,.sv-op-grid{display:grid;gap:12px;margin:12px 0;}'+\n    '.sv-mini-grid{grid-template-columns:repeat(3,minmax(0,1fr));}'+\n    '.sv-op-grid-3{grid-template-columns:repeat(3,minmax(0,1fr));}'+\n    '.sv-op-grid-2{grid-template-columns:repeat(2,minmax(0,1fr));}'+\n    '.sv-mini-grid button,.sv-op-grid button{width:100%;margin:0!important;padding:14px 10px!important;min-height:0;font-size:16px;line-height:1.25;}'+\n    '#sv132SelectGrid{margin-top:6px;margin-bottom:14px;}'+\n    '#sv132MainOps,#sv132NameOps,#sv132ExportGrid{margin-top:14px;}'+\n    '@media (max-width:640px){.sv-mini-grid,.sv-op-grid-3{grid-template-columns:repeat(2,minmax(0,1fr));}.sv-op-grid-2{grid-template-columns:repeat(2,minmax(0,1fr));}}'+\n    '@media (max-width:430px){.sv-mini-grid,.sv-op-grid-3,.sv-op-grid-2{grid-template-columns:repeat(2,minmax(0,1fr));}.sv-meta-row{align-items:flex-start;}}';\n  document.head.appendChild(style);\n}\nfunction sv132MakeGrid(id, cls, beforeEl){\n  var wrap=sv132ById(id);\n  if(!wrap){\n    wrap=document.createElement('div');\n    wrap.id=id;\n    wrap.className=cls;\n    if(beforeEl&&beforeEl.parentNode) beforeEl.parentNode.insertBefore(wrap,beforeEl);\n  }\n  return wrap;\n}\nfunction sv132MoveIntoGrid(ids, gridId, cls){\n  var first=null;\n  ids.forEach(function(id){if(!first&&sv132ById(id)) first=sv132ById(id)});\n  if(!first) return null;\n  var grid=sv132MakeGrid(gridId, cls, first);\n  ids.forEach(function(id){\n    var el=sv132ById(id);\n    if(el){\n      el.classList.add('sv-compact-btn');\n      grid.appendChild(el);\n    }\n  });\n  return grid;\n}\nfunction sv132RefineLayout(){\n  sv132EnsureStyle();\n  var unique=sv132ById('unique');\n  var sel=sv132ById('selCount');\n  var uniqueLabel = unique && unique.closest ? unique.closest('label') : (unique ? unique.parentNode : null);\n  if(uniqueLabel && sel && !sv132ById('sv132Meta')){\n    var row=document.createElement('div');\n    row.id='sv132Meta';\n    row.className='sv-meta-row';\n    uniqueLabel.parentNode.insertBefore(row, uniqueLabel);\n    row.appendChild(uniqueLabel);\n    row.appendChild(sel);\n  }\n  if(sel) sel.classList.add('sv-pill');\n  sv132MoveIntoGrid(['selectCurrent','invertCurrent','clearSelected'], 'sv132SelectGrid', 'sv-mini-grid');\n  sv132MoveIntoGrid(['geo','landing','alive'], 'sv132MainOps', 'sv-op-grid sv-op-grid-3');\n  sv132MoveIntoGrid(['cleanNames','restoreNames'], 'sv132NameOps', 'sv-op-grid sv-op-grid-2');\n  var cleanBtn=sv132ById('cleanNames');\n  if(cleanBtn) cleanBtn.textContent='清理节点名';\n  var restoreBtn=sv132ById('restoreNames');\n  if(restoreBtn) restoreBtn.textContent='恢复原名';\n  var copyBtn=sv132ById('copyBtn');\n  if(copyBtn && !sv132ById('copyAliveBtn')){\n    var btn=document.createElement('button');\n    btn.id='copyAliveBtn';\n    btn.className=copyBtn.className||'';\n    btn.textContent='复制可用节点';\n    copyBtn.parentNode.insertBefore(btn, copyBtn.nextSibling);\n    btn.addEventListener('click', window.copyAliveExport);\n  }\n  sv132MoveIntoGrid(['copyAliveBtn','copyBtn','exportBtn'], 'sv132ExportGrid', 'sv-op-grid sv-op-grid-3');\n}\nfunction sv132WithNodes(nodes, fn){\n  var oldSelectedNodes=selectedNodes;\n  try{\n    selectedNodes=function(){return nodes};\n    return fn();\n  } finally {\n    selectedNodes=oldSelectedNodes;\n  }\n}\nwindow.copyAliveExport=function copyAliveExport(){\n  try{\n    if(!DATA){st('请先拉取或分析订阅');return}\n    var picked=operationNodes('复制可用节点');\n    if(!picked.length) return;\n    var alive=picked.filter(function(n){return n&&n.aliveOK===true});\n    if(!alive.length){st('当前勾选节点中没有可用节点。请先执行测活，或调整勾选范围。');return}\n    var payload=sv132WithNodes(alive, buildExportPayload);\n    payload.name=String(payload.name||'').replace('selected','alive');\n    function ok(){st('已复制可用节点：'+alive.length+' 个（'+payload.label+'）')}\n    if(navigator.clipboard && window.isSecureContext){\n      navigator.clipboard.writeText(payload.text).then(ok).catch(function(){\n        if(fallbackCopy(payload.text)) ok();\n        else st('复制失败：当前浏览器不允许写入剪贴板');\n      });\n    } else if(fallbackCopy(payload.text)){\n      ok();\n    } else {\n      st('复制失败：当前浏览器不允许写入剪贴板');\n    }\n  }catch(e){\n    st('复制可用节点失败：'+e.message);\n  }\n};\nfunction sv132UpdateSelectUI(){\n  var c=selectedCount();\n  var el=sv132ById('selCount');\n  if(el){\n    el.textContent='已选 '+c+' 个';\n    el.classList.add('sv-pill');\n  }\n  var countEl=sv132ById('count');\n  if(countEl && DATA){\n    var total=((DATA&&DATA.summary&&DATA.summary.total)||0);\n    var current=filtered().length;\n    countEl.textContent='当前显示 '+current+' / '+total+' 个节点';\n  }\n}\nhook('afterApply', function(){ sv132UpdateSelectUI(); sv132RefineLayout(); });\nwindow.addEventListener('DOMContentLoaded', function(){ sv132RefineLayout(); sv132UpdateSelectUI(); });\n\n\n/* ── sv133: theme / selectAlive / autoAlive ── */\nfunction sv133ById(id){return document.getElementById(id)}\nfunction sv133InstallStyle(){\n  if(sv133ById('sv133Style')) return;\n  var style=document.createElement('style');\n  style.id='sv133Style';\n  style.textContent =\n    'body.sv133 .wrap{max-width:980px;padding-bottom:70px;}'+\n      'body.sv133 .hero,body.sv133 .card{border-radius:22px;padding:18px;margin:14px 0;}'+\n      'body.sv133 h1{font-size:28px;line-height:1.2}body.sv133 h2{font-size:22px;margin-bottom:14px;}'+\n      'body.sv133 button{min-height:48px;border-radius:18px;padding:13px 12px;font-size:16px;line-height:1.25;margin-top:0;}'+\n      'body.sv133 input,body.sv133 textarea,body.sv133 select{border-radius:16px;padding:13px 14px;font-size:15px;}'+\n      'body.sv133 .status{font-size:14px;line-height:1.55;max-height:150px;}'+\n      'body.sv133 #cards.grid{grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;}'+\n      'body.sv133 .stat{padding:14px;border-radius:18px;}body.sv133 .stat b{font-size:30px;}'+\n      'body.sv133 #protocols,body.sv133 #countries{max-height:320px;overflow:auto;padding-right:4px;}'+\n      'body.sv133 .bar{grid-template-columns:108px 1fr 42px;gap:8px;font-size:14px;}'+\n      'body.sv133 .track,body.sv133 .fill{height:12px;}'+\n      'body.sv133 .filters{grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;}'+\n      'body.sv133 .sv-section-title{font-size:13px;color:#9fb0cc;font-weight:800;margin:14px 0 8px;}'+\n      'body.sv133 .sv-auto-row{display:flex;align-items:center;gap:9px;margin:8px 0 10px;color:#dbe8ff;font-size:14px;}'+\n      'body.sv133 .sv-auto-row input{width:22px!important;height:22px!important;accent-color:#58a6ff;padding:0;}'+\n      'body.sv133 .sv133-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:10px 0 12px;}'+\n      'body.sv133 .sv133-grid.three{grid-template-columns:repeat(3,minmax(0,1fr));}'+\n      'body.sv133 .sv133-grid button{width:100%;}'+\n      'body.sv133 .rulebox{padding:10px 12px;border-radius:16px;margin-top:10px;}'+\n      'body.sv133 .rulebox summary{font-size:15px;}'+\n      'body.sv133 .exportbar{display:grid;grid-template-columns:1.3fr .7fr .7fr;gap:10px;}'+\n      'body.sv133 #sv133ExportGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:10px;}'+\n      'body.sv133 #sv133ExportGrid button{margin:0;}'+\n      'body.sv133 table{table-layout:fixed;}'+\n      'body.sv133 th,body.sv133 td{padding:10px 8px;}'+\n      '@media(max-width:760px){'+\n        'body.sv133 .wrap{padding:14px 10px 56px;}'+\n        'body.sv133 .hero,body.sv133 .card{padding:15px 13px;border-radius:20px;margin:12px 0;}'+\n        'body.sv133 h1{font-size:24px}body.sv133 h2{font-size:20px;}'+\n        'body.sv133 #cards.grid{grid-template-columns:repeat(2,minmax(0,1fr));}'+\n        'body.sv133 .stat{min-height:82px;}body.sv133 .stat b{font-size:28px;}'+\n        'body.sv133 #protocols,body.sv133 #countries{max-height:260px;}'+\n        'body.sv133 .bar{grid-template-columns:82px 1fr 34px;font-size:13px;}'+\n        'body.sv133 .filters{grid-template-columns:1fr 1fr;}'+\n        'body.sv133 .selectbar{display:block;}'+\n        'body.sv133 #sv132Meta,body.sv133 .sv-meta-row{display:flex!important;gap:10px;align-items:center;justify-content:space-between;margin:10px 0;}'+\n        'body.sv133 .sv-pill{font-size:14px;padding:7px 10px;}'+\n        'body.sv133 .sv133-grid,body.sv133 .sv133-grid.three{grid-template-columns:repeat(2,minmax(0,1fr));}'+\n        'body.sv133 .toolbar{grid-template-columns:repeat(2,minmax(0,1fr))!important;}'+\n        'body.sv133 .toolhint{font-size:12px;line-height:1.5;}'+\n        'body.sv133 .exportbar{grid-template-columns:1fr;}'+\n        'body.sv133 table,body.sv133 thead,body.sv133 tbody{display:block;width:100%;}'+\n        'body.sv133 thead{display:none;}'+\n        'body.sv133 tbody tr{display:grid;grid-template-columns:34px minmax(0,1fr) 78px;grid-template-areas:\"check name proto\" \"check name port\";gap:4px 10px;align-items:center;border-top:1px solid #263f66;padding:12px 0;}'+\n        'body.sv133 tbody td{display:block;border:0!important;padding:0!important;min-width:0;}'+\n        'body.sv133 tbody td:nth-child(1){grid-area:check;}'+\n        'body.sv133 tbody td:nth-child(2){display:none;}'+\n        'body.sv133 tbody td:nth-child(3){grid-area:name;font-size:15px;line-height:1.35;word-break:break-word;}'+\n        'body.sv133 tbody td:nth-child(4){grid-area:proto;text-align:right;}'+\n        'body.sv133 tbody td:nth-child(5){display:none!important;}'+\n        'body.sv133 tbody td:nth-child(6){grid-area:port;text-align:right;color:#dbe8ff;font-weight:800;font-size:15px;}'+\n        'body.sv133 .tag{padding:5px 9px;font-size:13px;}'+\n        'body.sv133 .small{font-size:12px;line-height:1.45;word-break:break-word;}'+\n      '}'+\n      '@media(max-width:390px){body.sv133 .bar{grid-template-columns:72px 1fr 30px;}body.sv133 button{font-size:15px;padding-left:8px;padding-right:8px;}body.sv133 tbody tr{grid-template-columns:32px minmax(0,1fr) 70px;}}';\n    document.head.appendChild(style);\n  }\n  function sv133Move(ids, gridId, cls, before){\n    var first=null;\n    ids.forEach(function(id){if(!first&&sv133ById(id)) first=sv133ById(id)});\n    if(!first) return null;\n    var grid=sv133ById(gridId);\n    if(!grid){\n      grid=document.createElement('div');\n      grid.id=gridId;\n      grid.className=cls;\n      var ref=before&&sv133ById(before)?sv133ById(before):first;\n      if(ref&&ref.parentNode) ref.parentNode.insertBefore(grid, ref);\n    }\n    ids.forEach(function(id){var el=sv133ById(id); if(el) grid.appendChild(el);});\n    return grid;\n  }\n  function sv133EnsureAliveControls(){\n    var clear=sv133ById('clearSelected');\n    if(clear && !sv133ById('selectAliveBtn')){\n      var b=document.createElement('button');\n      b.id='selectAliveBtn';\n      b.type='button';\n      b.className=clear.className||'btn2';\n      b.textContent='勾选可用';\n      b.onclick=function(){window.selectAliveCurrent&&window.selectAliveCurrent();return false};\n      clear.parentNode.insertBefore(b, clear.nextSibling);\n    }\n    var hint=sv133ById('autoAliveWrap');\n    var anchor=sv133ById('selectAliveBtn')||sv133ById('alive');\n    if(!hint && anchor){\n      hint=document.createElement('label');\n      hint.id='autoAliveWrap';\n      hint.className='sv-auto-row';\n      hint.innerHTML='<input type=\"checkbox\" id=\"autoSelectAlive\" checked> 测活完成后自动只勾选可用节点';\n      var parent=(sv133ById('sv133SelectGrid')||anchor.parentNode);\n      if(parent&&parent.parentNode) parent.parentNode.insertBefore(hint, parent.nextSibling);\n    }\n  }\n  function sv133Refine(){\n    document.body.classList.add('sv133');\n    sv133InstallStyle();\n    sv133EnsureAliveControls();\n    var unique=sv133ById('unique'), sel=sv133ById('selCount');\n    var uniqueLabel=unique&&unique.closest?unique.closest('label'):(unique?unique.parentNode:null);\n    if(uniqueLabel && sel && !sv133ById('sv133Meta')){\n      var row=document.createElement('div'); row.id='sv133Meta'; row.className='sv-meta-row';\n      uniqueLabel.parentNode.insertBefore(row, uniqueLabel); row.appendChild(uniqueLabel); row.appendChild(sel);\n    }\n    if(sel) sel.classList.add('sv-pill');\n    sv133Move(['selectCurrent','invertCurrent','clearSelected','selectAliveBtn'], 'sv133SelectGrid', 'sv133-grid', 'autoAliveWrap');\n    sv133Move(['geo','landing','alive','cleanNames','restoreNames'], 'sv133MainGrid', 'sv133-grid', null);\n    sv133Move(['copyAliveBtn','copyBtn','exportBtn'], 'sv133ExportGrid', 'sv133-grid three', null);\n    var clean=sv133ById('cleanNames'); if(clean) clean.textContent='清理节点名';\n    var alive=sv133ById('alive'); if(alive) alive.textContent='测活';\n    var selAlive=sv133ById('selectAliveBtn'); if(selAlive) selAlive.textContent='勾选可用';\n  }\n  window.selectAliveCurrent=function(){\n    try{\n      if(!DATA){st('请先拉取或分析订阅');return}\n      var scope=filtered();\n      var alive=scope.filter(function(n){return n&&n.aliveOK===true});\n      SELECTED={};\n      alive.forEach(function(n){if(n._sid)SELECTED[n._sid]=1});\n      apply();\n      st('已勾选当前筛选中的可用节点：'+alive.length+' / '+scope.length+' 个');\n    }catch(e){st('勾选可用节点失败：'+(e&&e.message?e.message:String(e)))}\n  };\n  function sv133AutoEnabled(){var el=sv133ById('autoSelectAlive');return !el || el.checked}\n  function sv133AutoPick(nodes){\n    var alive=(nodes||[]).filter(function(n){return n&&n.aliveOK===true});\n    if(sv133AutoEnabled()){\n      SELECTED={};\n      alive.forEach(function(n){if(n._sid)SELECTED[n._sid]=1});\n    }\n    return alive.length;\n  }\n  window.aliveTest=function(){\n    try{\n      if(!DATA){st('请先拉取或分析订阅');return}\n      if(GEO_RUNNING){st('已有检测任务正在运行；如果刚才没有进度，请刷新页面后重试。');return}\n      var nodes=operationNodes('测活');\n      if(!nodes.length) return;\n      var cfg=getAliveSettings(), q=aliveQS(cfg);\n      GEO_RUNNING=true;\n      var total=nodes.length, done=0, ok=0, fail=0, errMap={};\n      st('开始对选中的 '+total+' 个节点测活：并发 '+cfg.concurrency+'，超时 '+cfg.timeout+'ms，0 / '+total);\n      function finish(){\n        GEO_RUNNING=false;\n        var autoCount=sv133AutoPick(nodes);\n        recalc(DATA);\n        render(DATA);\n        sv133Refine();\n        var es=Object.keys(errMap).slice(0,3).map(function(k){return k+'×'+errMap[k]}).join('；');\n        st('测活完成：已检测选中的 '+total+' 个节点，实际按 '+cfg.concurrency+' 并发调度，超时 '+cfg.timeout+'ms，可用 '+ok+'，不可用 '+fail+(sv133AutoEnabled()?'。已自动勾选可用节点 '+autoCount+' 个':'')+(es?'。失败原因：'+es:''));\n      }\n      runLimitedTasks(nodes,cfg.concurrency,function(n){\n        return loadJSON('/api/availability?t='+Date.now()+q,{method:'POST',body:JSON.stringify(n),headers:{'Content-Type':'application/json;charset=utf-8'}})\n          .then(function(r){\n            if(r&&r.ok&&r.alive){\n              n.aliveOK=true;\n              n.aliveLatency=r.latency||r.totalLatency||0;\n              n.aliveStatus=r.status;\n              n.aliveError='';\n              applyAliveName(n,cfg);\n              ok++;\n            }else{\n              var er=aliveErr((r&&r.error)||'检测失败');\n              n.aliveOK=false; n.aliveError=er; errMap[er]=(errMap[er]||0)+1; fail++;\n            }\n          })\n          .catch(function(e){\n            var er=aliveErr(e.message||String(e));\n            n.aliveOK=false; n.aliveError=er; errMap[er]=(errMap[er]||0)+1; fail++;\n          });\n      },function(_n,_i,_err,d,t){\n        if(d){done=d;recalc(DATA);apply();st('测活：'+done+' / '+t+'，并发 '+cfg.concurrency+'，可用 '+ok+'，不可用 '+fail)}\n      },finish);\n    }catch(e){GEO_RUNNING=false;st('测活启动失败：'+aliveErr(e&&e.message?e.message:String(e)))}\n  };\nhook('afterApply', sv133Refine);\nwindow.addEventListener('DOMContentLoaded',function(){sv133Refine()});\n\n/* ── sv135: dashboard / health / pagination ── */\nvar SV135_PAGE_SIZE=120;\nvar sv135ViewLimit=SV135_PAGE_SIZE;\nvar sv135LastKey='';\nfunction sv135ById(id){return document.getElementById(id)}\nfunction sv135ParentCard(el){return el&&el.closest?el.closest('.card'):(el?el.parentNode:null)}\nfunction sv135AddTitle(id,text,before){\n    if(!before||sv135ById(id)) return;\n    var t=document.createElement('div');\n    t.id=id;t.className='sv135-section-title';t.textContent=text;\n    before.parentNode.insertBefore(t,before);\n  }\n  function sv135InstallStyle(){\n    if(sv135ById('sv135Style')) return;\n    var s=document.createElement('style');\n    s.id='sv135Style';\n    s.textContent=\n      'body.sv135{--sv-card:#10243d;--sv-line:#29466f;--sv-soft:#9fb0cc;--sv-accent:#35c5ff;}'+\n      'body.sv135 .wrap{max-width:980px;}'+\n      'body.sv135 .hero input#url{border-color:#2f6fb2;box-shadow:0 0 0 1px rgba(53,197,255,.16),0 0 26px rgba(30,144,255,.08) inset;}'+\n      'body.sv135 .hero input#url:focus{border-color:#35c5ff;box-shadow:0 0 0 3px rgba(53,197,255,.16);}'+\n      'body.sv135 #cards.grid{grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-top:14px;}'+\n      'body.sv135 .stat{background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.015));border-color:rgba(92,137,201,.58);}'+\n      'body.sv135 .sv135-chart-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;}'+\n      'body.sv135 .sv135-chart-grid>.card{margin:0;}'+\n      'body.sv135 #protocols,body.sv135 #countries{max-height:280px;overflow:auto;padding-right:3px;}'+\n      'body.sv135 .bar{grid-template-columns:104px 1fr 42px;min-height:22px;}'+\n      'body.sv135 .track{height:12px;background:rgba(73,102,148,.38);}'+\n      'body.sv135 .fill{height:12px;background:linear-gradient(90deg,#338fff,#23d1e9);border-radius:999px;}'+\n      'body.sv135 #sv135Health .health-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:6px 0 12px;}'+\n      'body.sv135 #sv135Health .health-cell{padding:11px 12px;border:1px solid rgba(92,137,201,.45);border-radius:16px;background:rgba(255,255,255,.025);}'+\n      'body.sv135 #sv135Health .health-cell span{display:block;color:#9fb0cc;font-size:13px;font-weight:700;}'+\n      'body.sv135 #sv135Health .health-cell b{display:block;color:#f2f7ff;font-size:28px;line-height:1.1;margin-top:3px;}'+\n      'body.sv135 .sv135-section-title{color:#9fb0cc;font-size:13px;font-weight:900;letter-spacing:.04em;margin:15px 0 8px;}'+\n      'body.sv135 .sv133-grid,body.sv135 .sv133-grid.three,body.sv135 .sv-mini-grid,body.sv135 .sv-op-grid{grid-template-columns:repeat(auto-fit,minmax(136px,1fr))!important;gap:10px!important;margin:10px 0 12px!important;}'+\n      'body.sv135 .sv133-grid button,body.sv135 .sv-mini-grid button,body.sv135 .sv-op-grid button,body.sv135 .toolbar button{min-height:48px!important;white-space:normal!important;word-break:keep-all!important;overflow-wrap:normal!important;line-height:1.25!important;}'+\n      'body.sv135 #alive{background:linear-gradient(180deg,#3187f7,#2167ca)!important;color:#fff!important;}'+\n      'body.sv135 .toolhint{margin:8px 0 12px;font-size:13px;line-height:1.55;}'+\n      'body.sv135 .rulebox{margin-top:10px;}'+\n      'body.sv135 .exportbar{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(96px,.45fr) minmax(96px,.45fr);gap:10px;align-items:stretch;}'+\n      'body.sv135 #sv133ExportGrid{grid-template-columns:repeat(auto-fit,minmax(126px,1fr))!important;}'+\n      'body.sv135 .sv135-empty{padding:22px 14px;text-align:center;color:#9fb0cc;line-height:1.6;border:1px dashed rgba(92,137,201,.55);border-radius:18px;background:rgba(255,255,255,.018);}'+\n      'body.sv135 .sv135-more-row td{text-align:center!important;padding:14px 0!important;}'+\n      'body.sv135 .sv135-more{width:min(360px,100%);margin:0 auto!important;}'+\n      'body.sv135 table{table-layout:fixed;}'+\n      'body.sv135 th:nth-child(1){width:48px}body.sv135 th:nth-child(2){width:48px}body.sv135 th:nth-child(4){width:112px}body.sv135 th:nth-child(6){width:86px}'+\n      'body.sv135 .tag{white-space:nowrap;word-break:keep-all;max-width:104px;overflow:hidden;text-overflow:ellipsis;text-align:center;}'+\n      '@media(max-width:820px){body.sv135 .sv135-chart-grid{grid-template-columns:1fr;}body.sv135 #cards.grid{grid-template-columns:repeat(2,minmax(0,1fr));}body.sv135 #cards .stat:last-child{grid-column:span 2;}}'+\n      '@media(max-width:760px){body.sv135 .exportbar{grid-template-columns:1fr;}body.sv135 .filters{grid-template-columns:1fr 1fr!important;}body.sv135 table,body.sv135 thead,body.sv135 tbody{display:block;width:100%;}body.sv135 thead{display:none;}body.sv135 tbody tr{display:grid!important;grid-template-columns:38px minmax(0,1fr) 92px!important;grid-template-areas:\"check name proto\" \"check name port\"!important;gap:4px 10px;align-items:center;border-top:1px solid #263f66;padding:12px 0;}body.sv135 tbody td{display:block;border:0!important;padding:0!important;min-width:0;}body.sv135 tbody td:nth-child(1){grid-area:check;}body.sv135 tbody td:nth-child(2){display:none!important;}body.sv135 tbody td:nth-child(3){grid-area:name;font-size:15px;line-height:1.36;word-break:break-word;}body.sv135 tbody td:nth-child(4){grid-area:proto;text-align:right;}body.sv135 tbody td:nth-child(5){display:none!important;}body.sv135 tbody td:nth-child(6){grid-area:port;text-align:right;color:#eaf2ff;font-weight:900;font-size:16px;}body.sv135 .rowchk{width:24px!important;height:24px!important;}body.sv135 .tag{max-width:90px;padding:5px 8px;font-size:13px;}body.sv135 .small{font-size:12px;line-height:1.45;}}'+\n      '@media(max-width:390px){body.sv135 .sv133-grid,body.sv135 .sv133-grid.three,body.sv135 .sv-mini-grid,body.sv135 .sv-op-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;}body.sv135 tbody tr{grid-template-columns:36px minmax(0,1fr) 86px!important;}body.sv135 button{font-size:15px!important;padding-left:8px!important;padding-right:8px!important;}}';\n    document.head.appendChild(s);\n  }\n  function sv135EnsureDashboard(){\n    document.body.classList.add('sv135');sv135InstallStyle();\n    var p=sv135ParentCard(sv135ById('protocols')), c=sv135ParentCard(sv135ById('countries'));\n    if(p&&c&&!sv135ById('sv135Charts')){\n      var grid=document.createElement('div');grid.id='sv135Charts';grid.className='sv135-chart-grid';\n      p.parentNode.insertBefore(grid,p);grid.appendChild(p);grid.appendChild(c);\n      var h=document.createElement('div');h.id='sv135Health';h.className='card';h.innerHTML='<h2>节点健康状况</h2><div class=\"health-grid\"><div class=\"health-cell\"><span>可用</span><b id=\"hAlive\">0</b></div><div class=\"health-cell\"><span>不可用</span><b id=\"hDead\">0</b></div><div class=\"health-cell\"><span>未测</span><b id=\"hUntested\">0</b></div><div class=\"health-cell\"><span>当前筛选</span><b id=\"hScope\">0</b></div></div><div id=\"hBars\" class=\"small muted\">测活后这里会显示可用比例。</div>';\n      grid.appendChild(h);\n    }\n  }\n  function health(nodes){var a=0,d=0,u=0;(nodes||[]).forEach(function(n){if(n.aliveOK===true)a++;else if(n.aliveOK===false)d++;else u++});return{alive:a,dead:d,untested:u,total:(nodes||[]).length}}\n  function sv135UpdateHealth(nodes){sv135EnsureDashboard();var h=health(nodes||filtered());[['hAlive',h.alive],['hDead',h.dead],['hUntested',h.untested],['hScope',h.total]].forEach(function(x){var el=sv135ById(x[0]);if(el)el.textContent=x[1]});var b=sv135ById('hBars');if(b){var p=h.total?Math.round(h.alive/h.total*100):0;b.innerHTML='<div class=\"bar\"><div>可用率</div><div class=\"track\"><div class=\"fill\" style=\"width:'+p+'%\"></div></div><b>'+p+'%</b></div>';}}\n  function sv135Refine(){\n    sv135EnsureDashboard();\n    var selectGrid=sv135ById('sv133SelectGrid')||sv135ById('sv132SelectGrid');\n    var mainGrid=sv135ById('sv133MainGrid')||sv135ById('sv132MainOps');\n    var exportGrid=sv135ById('sv133ExportGrid')||sv135ById('sv132ExportGrid');\n    sv135AddTitle('sv135SelectTitle','选择范围',selectGrid);\n    sv135AddTitle('sv135ActionTitle','常用操作',mainGrid);\n    var firstRule=document.querySelector('.rulebox');\n    sv135AddTitle('sv135AdvancedTitle','高级设置',firstRule);\n    sv135AddTitle('sv135ExportTitle','导出与复制',exportGrid||sv135ById('exportType'));\n    var alive=sv135ById('alive');if(alive)alive.textContent='测活';\n    var geo=sv135ById('geo');if(geo)geo.textContent='GeoIP补全';\n    var landing=sv135ById('landing');if(landing)landing.textContent='落地检测';\n    var clean=sv135ById('cleanNames');if(clean)clean.textContent='清理节点名';\n    var copyAlive=sv135ById('copyAliveBtn');if(copyAlive)copyAlive.textContent='复制可用';\n    if(!DATA){var tb=sv135ById('tbody');if(tb)tb.innerHTML='<tr><td colspan=\"6\"><div class=\"sv135-empty\">先输入订阅 URL 或粘贴订阅内容，再点击分析。<br>分析后可筛选、勾选节点，再执行测活、落地检测、清理和复制。</div></td></tr>';}\n  }\n  function keyOf(a){var q=(sv135ById('q')&&sv135ById('q').value)||'',pf=(sv135ById('pf')&&sv135ById('pf').value)||'',cf=(sv135ById('cf')&&sv135ById('cf').value)||'',u=(sv135ById('unique')&&sv135ById('unique').checked)?'1':'0';return [a.length,q,pf,cf,u].join('|')}\n  function row(n,i){var chk=SELECTED[n._sid]?' checked':'';return '<tr><td><input type=\"checkbox\" class=\"rowchk\" data-sid=\"'+esc(n._sid||'')+'\" onchange=\"window.toggleSelect&&window.toggleSelect(this.dataset.sid,this.checked)\"'+chk+'></td><td>'+(i+1)+'</td><td>'+esc(n.name)+'<div class=\"small\">'+meta(n)+'</div></td><td><span class=\"tag\" title=\"'+esc(n.protocol)+'\">'+esc(n.protocol)+'</span></td><td>'+esc(n.server)+'</td><td>'+esc(n.port)+'</td></tr>'}\nwindow.sv135LoadMore=function(){sv135ViewLimit+=SV135_PAGE_SIZE;apply();};\nvar _sv135BaseApply=apply;\napply=function(){\n  try{\n    if(!DATA){sv135Refine();emit('afterApply',filtered());return}\n    var a=filtered(),sc=selectedCount(),k=keyOf(a);if(k!==sv135LastKey){sv135ViewLimit=SV135_PAGE_SIZE;sv135LastKey=k}\n    var c=sv135ById('count');if(c)c.textContent='当前显示 '+a.length+' / '+((DATA&&DATA.summary&&DATA.summary.total)||0)+' 个节点，已选 '+sc+' 个';\n    updateSelectUI();\n    var show=a.slice(0,sv135ViewLimit), html=show.map(row).join('');\n    if(a.length>show.length){html+='<tr class=\"sv135-more-row\"><td colspan=\"6\"><button type=\"button\" class=\"btn2 sv135-more\" onclick=\"window.sv135LoadMore&&window.sv135LoadMore();return false\">继续显示 '+Math.min(SV135_PAGE_SIZE,a.length-show.length)+' 个，剩余 '+(a.length-show.length)+' 个</button></td></tr>'}\n    if(!html) html='<tr><td colspan=\"6\" class=\"muted\">当前筛选没有节点</td></tr>';\n    var tb=sv135ById('tbody');if(tb)tb.innerHTML=html;\n    sv135UpdateHealth(a);sv135Refine();emit('afterApply',a);\n  }catch(e){try{_sv135BaseApply()}catch(_){ } console.log(e)}\n};\nvar _sv135BaseRender=render;\nrender=function(d){_sv135BaseRender(d);sv135EnsureDashboard();sv135UpdateHealth(filtered());sv135Refine();};\nwindow.addEventListener('DOMContentLoaded',function(){sv135Refine();sv135UpdateHealth([]);});\n\n/* ── sv136: gold theme / quickCopy / drag / autoParse ── */\n  var SV136_PAGE_SIZE=120;\n  var sv136ViewLimit=SV136_PAGE_SIZE;\n  var sv136LastKey='';\n  function sv136ById(id){return document.getElementById(id)}\n  function closestCard(el){return el&&el.closest?el.closest('.card'):(el?el.parentNode:null)}\n  function addMeta(name,content){\n    if(document.querySelector('meta[name=\"'+name+'\"]')) return;\n    var m=document.createElement('meta');m.name=name;m.content=content;document.head.appendChild(m);\n  }\n  function sv136PulseButton(btn,okText){\n    if(!btn)return;\n    var old=btn.textContent;\n    btn.textContent=okText||'✓ SUCCESS';\n    btn.classList.add('sv136-success');\n    setTimeout(function(){btn.textContent=old;btn.classList.remove('sv136-success')},1500);\n  }\n  function installStyle(){\n    if(sv136ById('sv136Style'))return;\n    var stl=document.createElement('style');stl.id='sv136Style';\n    stl.textContent=\n      'body.sv136{--bg-main:#0B0C10;--bg-card:#171921;--bg-card-2:#1E212B;--color-gold:#F1B813;--color-gold-2:#D4A00E;--color-gold-dim:rgba(241,184,19,.12);--border-color:#262938;--text-main:#fff;--text-soft:#94A3B8;--text-dim:#64748B;margin:0!important;background:radial-gradient(circle at 50% -10%,rgba(241,184,19,.12),transparent 34%),#0B0C10!important;color:var(--text-soft)!important;font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;}'+\n      'body.sv136 .wrap{max-width:1080px!important;margin:0 auto!important;padding:calc(22px + env(safe-area-inset-top)) 18px calc(58px + env(safe-area-inset-bottom))!important;}'+\n      'body.sv136 .hero,body.sv136 .card,body.sv136 .rulebox{background:rgba(23,25,33,.92)!important;border:1px solid var(--border-color)!important;border-radius:22px!important;box-shadow:0 18px 50px rgba(0,0,0,.30)!important;}'+\n      'body.sv136 .hero{position:relative;overflow:hidden;padding:24px!important;}body.sv136 .hero:before{content:\"\";position:absolute;inset:0 0 auto 0;height:3px;background:linear-gradient(90deg,transparent,var(--color-gold),transparent);opacity:.85;}'+\n      'body.sv136 h1,body.sv136 h2{color:var(--text-main)!important;letter-spacing:-.02em;}body.sv136 h1{font-size:30px!important;margin:6px 0 10px!important;}body.sv136 h2{font-size:21px!important;margin-bottom:14px!important;}'+\n      'body.sv136 .small,body.sv136 .muted,body.sv136 .toolhint{color:var(--text-soft)!important;}body.sv136 .toolhint{line-height:1.7!important;font-size:13px!important;margin:9px 0 13px!important;}'+\n      'body.sv136 input,body.sv136 textarea,body.sv136 select{background:#0F1118!important;border:1px solid var(--border-color)!important;color:var(--text-main)!important;border-radius:14px!important;padding:13px 15px!important;transition:border-color .22s ease,box-shadow .22s ease,background .22s ease!important;}'+\n      'body.sv136 input:focus,body.sv136 textarea:focus,body.sv136 select:focus{border-color:var(--color-gold)!important;box-shadow:0 0 0 3px rgba(241,184,19,.15)!important;outline:none!important;background:#11141D!important;}'+\n      'body.sv136 input::placeholder,body.sv136 textarea::placeholder{color:#64748B!important;}'+\n      'body.sv136 button{background:#202432!important;color:#fff!important;border:1px solid rgba(255,255,255,.04)!important;border-radius:14px!important;box-shadow:none!important;font-weight:800!important;letter-spacing:.01em!important;transition:transform .18s ease,box-shadow .18s ease,background .18s ease,color .18s ease!important;}'+\n      'body.sv136 button:hover{transform:translateY(-1px)!important;box-shadow:0 10px 24px rgba(0,0,0,.28)!important;}body.sv136 #pull,body.sv136 #alive,body.sv136 .sv136-primary{background:linear-gradient(135deg,var(--color-gold),var(--color-gold-2))!important;color:#0B0C10!important;box-shadow:0 8px 24px rgba(241,184,19,.18)!important;}body.sv136 .sv136-success{background:linear-gradient(135deg,#2dd4bf,#10b981)!important;color:#07110f!important;}'+\n      'body.sv136 .status{background:#0F1118!important;border-color:var(--border-color)!important;border-radius:16px!important;color:#D8DEE9!important;}'+\n      'body.sv136 #cards.grid{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:14px!important;margin:22px 0 16px!important;}'+\n      'body.sv136 .stat{background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.012))!important;border:1px solid var(--border-color)!important;border-radius:18px!important;padding:18px!important;text-align:left!important;}'+\n      'body.sv136 .stat span{display:block;color:var(--text-dim)!important;font-size:12px!important;text-transform:uppercase;letter-spacing:.05em;font-weight:800!important;}body.sv136 .stat b{display:block;color:var(--color-gold)!important;font-size:32px!important;line-height:1.1;margin-top:8px!important;}'+\n      'body.sv136 .sv135-chart-grid{display:grid!important;grid-template-columns:1fr 1fr 1fr!important;gap:16px!important;margin:8px 0 18px!important;}body.sv136 .sv135-chart-grid>.card{margin:0!important;}'+\n      'body.sv136 #protocols,body.sv136 #countries{max-height:310px;overflow:auto;padding-right:3px;}body.sv136 .bar{display:grid!important;grid-template-columns:minmax(76px,120px) minmax(90px,1fr) 38px!important;align-items:center!important;gap:10px!important;margin:11px 0!important;min-height:24px!important;}'+\n      'body.sv136 .track{height:11px!important;background:#262938!important;border-radius:999px!important;overflow:hidden!important;}body.sv136 .fill{height:11px!important;background:linear-gradient(90deg,var(--color-gold),#F6D36C)!important;border-radius:999px!important;}body.sv136 .bar b{color:#E5E7EB!important;}'+\n      'body.sv136 #sv135Health .health-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:6px 0 12px;}body.sv136 #sv135Health .health-cell{padding:13px 12px;border:1px solid var(--border-color);border-radius:16px;background:#0F1118;}body.sv136 #sv135Health .health-cell span{display:block;color:var(--text-dim);font-size:12px;font-weight:800;}body.sv136 #sv135Health .health-cell b{display:block;color:var(--color-gold);font-size:29px;line-height:1.05;margin-top:5px;}'+\n      'body.sv136 .sv135-section-title,body.sv136 .sv136-section-title{color:var(--color-gold)!important;font-size:12px!important;font-weight:900!important;letter-spacing:.08em!important;text-transform:uppercase!important;margin:18px 0 9px!important;}'+\n      'body.sv136 .sv133-grid,body.sv136 .sv133-grid.three,body.sv136 .sv-mini-grid,body.sv136 .sv-op-grid,body.sv136 .toolbar{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(138px,1fr))!important;gap:10px!important;margin:10px 0 14px!important;}'+\n      'body.sv136 .sv133-grid button,body.sv136 .sv-mini-grid button,body.sv136 .sv-op-grid button,body.sv136 .toolbar button{min-height:48px!important;margin:0!important;padding:12px 10px!important;white-space:normal!important;word-break:keep-all!important;line-height:1.28!important;}'+\n      'body.sv136 .sv-meta-row{background:#0F1118;border:1px solid var(--border-color);border-radius:16px;padding:10px 12px;}body.sv136 .sv-pill{background:var(--color-gold-dim)!important;color:var(--color-gold)!important;border:1px solid rgba(241,184,19,.22)!important;}'+\n      'body.sv136 .rowchk{accent-color:var(--color-gold)!important;width:23px!important;height:23px!important;}body.sv136 input[type=\"checkbox\"]{accent-color:var(--color-gold)!important;}'+\n      'body.sv136 details summary{color:#fff!important;list-style:none;}body.sv136 details summary::-webkit-details-marker{display:none;}body.sv136 details summary:before{content:\"▸\";color:var(--color-gold);margin-right:8px;}body.sv136 details[open] summary:before{content:\"▾\";}'+\n      'body.sv136 .exportbar{display:grid!important;grid-template-columns:minmax(0,1.35fr) minmax(94px,.45fr) minmax(94px,.45fr)!important;gap:10px!important;align-items:stretch!important;}body.sv136 #sv133ExportGrid{grid-template-columns:repeat(auto-fit,minmax(124px,1fr))!important;}'+\n      'body.sv136 table{width:100%!important;border-collapse:collapse!important;table-layout:fixed!important;background:var(--bg-card)!important;border:1px solid var(--border-color)!important;border-radius:18px!important;overflow:hidden!important;margin-top:18px!important;}'+\n      'body.sv136 th{background:var(--bg-card-2)!important;color:#fff!important;font-size:13px!important;font-weight:800!important;letter-spacing:.04em!important;text-align:left!important;padding:14px 14px!important;border-bottom:1px solid var(--border-color)!important;border-top:0!important;}'+\n      'body.sv136 td{padding:15px 14px!important;color:var(--text-soft)!important;border-top:0!important;border-bottom:1px solid #1E212B!important;word-break:normal!important;vertical-align:middle!important;}body.sv136 tr:hover td{background:rgba(255,255,255,.025)!important;color:#fff!important;}'+\n      'body.sv136 th:nth-child(1){width:48px!important}body.sv136 th:nth-child(2){width:54px!important}body.sv136 th:nth-child(4){width:104px!important}body.sv136 th:nth-child(6){width:84px!important}body.sv136 td.sv136-server{max-width:240px!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;color:#7F8EA3!important;}body.sv136 td.sv136-port{color:#fff!important;font-weight:800!important;}'+\n      'body.sv136 .tag{display:inline-flex!important;align-items:center!important;justify-content:center!important;background:var(--color-gold-dim)!important;color:var(--color-gold)!important;border:1px solid rgba(241,184,19,.22)!important;border-radius:999px!important;padding:5px 10px!important;font-size:12px!important;font-weight:900!important;text-transform:uppercase!important;white-space:nowrap!important;max-width:96px!important;overflow:hidden!important;text-overflow:ellipsis!important;}'+\n      'body.sv136 .sv136-empty{padding:26px 14px;text-align:center;color:var(--text-soft);line-height:1.7;border:1px dashed rgba(241,184,19,.28);border-radius:18px;background:#0F1118;}body.sv136 .sv135-more-row td,body.sv136 .sv136-more-row td{text-align:center!important;padding:16px!important;}body.sv136 .sv136-more{width:min(360px,100%);margin:0 auto!important;}'+\n      'body.sv136 .sv136-quick-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0 0;}body.sv136 .sv136-dragging{box-shadow:0 0 0 3px rgba(241,184,19,.2),0 24px 60px rgba(0,0,0,.45)!important;border-color:var(--color-gold)!important;}'+\n      '@media(max-width:860px){body.sv136 .sv135-chart-grid{grid-template-columns:1fr!important;}body.sv136 #cards.grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;}body.sv136 #cards .stat:last-child{grid-column:span 2;}body.sv136 .wrap{padding-left:14px!important;padding-right:14px!important;}}'+\n      '@media(max-width:720px){body.sv136 .exportbar{grid-template-columns:1fr!important;}body.sv136 .filters{grid-template-columns:1fr 1fr!important;}body.sv136 .sv136-quick-row{grid-template-columns:1fr;}body.sv136 table,body.sv136 thead,body.sv136 tbody{display:block;width:100%;}body.sv136 thead{display:none;}body.sv136 tbody tr{display:grid!important;grid-template-columns:36px minmax(0,1fr) 92px!important;grid-template-areas:\"check name proto\" \"check server port\"!important;gap:6px 10px;align-items:center;border-bottom:1px solid #1E212B!important;padding:13px 0!important;}body.sv136 tbody td{display:block!important;border:0!important;padding:0!important;min-width:0!important;}body.sv136 tbody td:nth-child(1){grid-area:check;}body.sv136 tbody td:nth-child(2){display:none!important;}body.sv136 tbody td:nth-child(3){grid-area:name;color:#fff!important;font-size:15px!important;line-height:1.35!important;word-break:break-word!important;}body.sv136 tbody td:nth-child(4){grid-area:proto;text-align:right!important;}body.sv136 tbody td:nth-child(5){grid-area:server;display:block!important;max-width:none!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;font-size:12px!important;color:#64748B!important;}body.sv136 tbody td:nth-child(6){grid-area:port;text-align:right!important;color:#fff!important;font-size:15px!important;font-weight:900!important;}body.sv136 .tag{max-width:90px!important;font-size:12px!important;padding:5px 9px!important;}body.sv136 .small{font-size:12px!important;line-height:1.42!important;}}'+\n      '@media(max-width:390px){body.sv136 #cards.grid{gap:10px!important;}body.sv136 .stat{padding:15px!important;}body.sv136 .stat b{font-size:28px!important;}body.sv136 .sv133-grid,body.sv136 .sv133-grid.three,body.sv136 .sv-mini-grid,body.sv136 .sv-op-grid,body.sv136 .toolbar{grid-template-columns:repeat(2,minmax(0,1fr))!important;}body.sv136 tbody tr{grid-template-columns:34px minmax(0,1fr) 84px!important;}body.sv136 button{font-size:15px!important;padding-left:8px!important;padding-right:8px!important;}}';\n    document.head.appendChild(stl);\n  }\n  function sv136EnsureDashboard(){\n    document.body.classList.add('sv136');installStyles();\n    addMeta('apple-mobile-web-app-capable','yes');addMeta('apple-mobile-web-app-status-bar-style','black-translucent');addMeta('apple-mobile-web-app-title','SubViz');\n    var p=closestCard(sv136ById('protocols')),c=closestCard(sv136ById('countries'));\n    if(p&&c&&!sv136ById('sv135Charts')){var grid=document.createElement('div');grid.id='sv135Charts';grid.className='sv135-chart-grid';p.parentNode.insertBefore(grid,p);grid.appendChild(p);grid.appendChild(c);var h=document.createElement('div');h.id='sv135Health';h.className='card';h.innerHTML='<h2>节点健康状况</h2><div class=\"health-grid\"><div class=\"health-cell\"><span>可用</span><b id=\"hAlive\">0</b></div><div class=\"health-cell\"><span>不可用</span><b id=\"hDead\">0</b></div><div class=\"health-cell\"><span>未测</span><b id=\"hUntested\">0</b></div><div class=\"health-cell\"><span>当前筛选</span><b id=\"hScope\">0</b></div></div><div id=\"hBars\" class=\"small muted\">测活后这里会显示可用比例。</div>';grid.appendChild(h)}\n  }\n  function health(nodes){var a=0,d=0,u=0;(nodes||[]).forEach(function(n){if(n.aliveOK===true)a++;else if(n.aliveOK===false)d++;else u++});return{alive:a,dead:d,untested:u,total:(nodes||[]).length}}\n  function sv136UpdateHealth(nodes){sv136EnsureDashboard();var h=health(nodes||[]);[['hAlive',h.alive],['hDead',h.dead],['hUntested',h.untested],['hScope',h.total]].forEach(function(x){var el=sv136ById(x[0]);if(el)el.textContent=x[1]});var b=sv136ById('hBars');if(b){var p=h.total?Math.round(h.alive/h.total*100):0;b.innerHTML='<div class=\"bar\"><div>可用率</div><div class=\"track\"><div class=\"fill\" style=\"width:'+p+'%\"></div></div><b>'+p+'%</b></div>'}}\n  function sv136Refine(){\n    sv136EnsureDashboard();\n    /* Section titles are added by sv135. Keep sv136 focused on visual polish to avoid duplicate labels. */\n    var alive=sv136ById('alive');if(alive)alive.textContent='测活';\n    var geo=sv136ById('geo');if(geo)geo.textContent='GeoIP 补全';\n    var landing=sv136ById('landing');if(landing)landing.textContent='落地检测';\n    var clean=sv136ById('cleanNames');if(clean)clean.textContent='清理节点名';\n    var copyAlive=sv136ById('copyAliveBtn');if(copyAlive)copyAlive.textContent='复制可用';\n    if(!DATA){var tb=sv136ById('tbody');if(tb)tb.innerHTML='<tr><td colspan=\"6\"><div class=\"sv136-empty\">先输入订阅 URL，或直接粘贴 / 拖入订阅内容。<br>分析后可筛选、勾选节点，再执行测活、落地检测、清理和复制。</div></td></tr>'}\n  }\n  function keyOf(a){var q=(sv136ById('q')&&sv136ById('q').value)||'',pf=(sv136ById('pf')&&sv136ById('pf').value)||'',cf=(sv136ById('cf')&&sv136ById('cf').value)||'',u=(sv136ById('unique')&&sv136ById('unique').checked)?'1':'0';return [a.length,q,pf,cf,u].join('|')}\n  function row(n,i){var chk=SELECTED[n._sid]?' checked':'';return '<tr><td><input type=\"checkbox\" class=\"rowchk\" data-sid=\"'+esc(n._sid||'')+'\" onchange=\"window.toggleSelect&&window.toggleSelect(this.dataset.sid,this.checked)\"'+chk+'></td><td>'+(i+1)+'</td><td>'+esc(n.name)+'<div class=\"small\">'+meta(n)+'</div></td><td><span class=\"tag\" title=\"'+esc(n.protocol)+'\">'+esc(n.protocol)+'</span></td><td class=\"sv136-server\" title=\"'+esc(n.server||'')+'\">'+esc(n.server)+'</td><td class=\"sv136-port\">'+esc(n.port)+'</td></tr>'}\n  window.sv136LoadMore=function(){sv136ViewLimit+=SV136_PAGE_SIZE;apply()};\nvar _sv136BaseApply=apply;\napply=function(){\n  try{\n    if(!DATA){sv136Refine();sv136UpdateHealth([]);emit('afterApply',filtered());return}\n    var a=filtered(),sc=selectedCount(),k=keyOf(a);if(k!==sv136LastKey){sv136ViewLimit=SV136_PAGE_SIZE;sv136LastKey=k}\n    var c=sv136ById('count');if(c)c.textContent='当前显示 '+a.length+' / '+((DATA&&DATA.summary&&DATA.summary.total)||0)+' 个节点，已选 '+sc+' 个';\n    updateSelectUI();\n    var show=a.slice(0,sv136ViewLimit),html=show.map(row).join('');\n    if(a.length>show.length){html+='<tr class=\"sv136-more-row\"><td colspan=\"6\"><button type=\"button\" class=\"btn2 sv136-more\" onclick=\"window.sv136LoadMore&&window.sv136LoadMore();return false\">继续显示 '+Math.min(SV136_PAGE_SIZE,a.length-show.length)+' 个，剩余 '+(a.length-show.length)+' 个</button></td></tr>'}\n    if(!html)html='<tr><td colspan=\"6\" class=\"muted\">当前筛选没有节点</td></tr>';\n    var tb=sv136ById('tbody');if(tb)tb.innerHTML=html;\n    sv136UpdateHealth(a);sv136Refine();emit('afterApply',a);\n  }catch(e){try{_sv136BaseApply()}catch(_){ }console.log(e)}\n};\nvar _sv136BaseRender=render;\nrender=function(d){_sv136BaseRender(d);sv136EnsureDashboard();sv136UpdateHealth(filtered());sv136Refine()};\nfunction sv136AutoAnalyzeText(){var raw=sv136ById('raw');if(!raw)return;var t=String(raw.value||'').trim();if(t.length<20)return;if(/^(https?:\\/\\/\\S+)$/i.test(t)){var u=sv136ById('url');if(u){u.value=t;analyzeURL();return}}analyzeText()}\nfunction sv136InstallAutoParse(){\n  var raw=sv136ById('raw'),url=sv136ById('url'),hero=document.querySelector('.hero');\n  if(url&&!url._sv136Paste){url._sv136Paste=1;url.addEventListener('paste',function(){setTimeout(function(){var v=String(url.value||'').trim();if(/^https?:\\/\\//i.test(v))analyzeURL()},80)});url.addEventListener('drop',function(e){try{e.preventDefault();var txt=e.dataTransfer.getData('text');if(txt){url.value=txt.trim();if(/^https?:\\/\\//i.test(url.value))analyzeURL()}}catch(_){}})}\n  if(raw&&!raw._sv136Paste){raw._sv136Paste=1;raw.addEventListener('paste',function(){setTimeout(sv136AutoAnalyzeText,120)});raw.addEventListener('drop',function(e){try{e.preventDefault();var f=e.dataTransfer.files&&e.dataTransfer.files[0];if(f){var r=new FileReader();r.onload=function(){raw.value=String(r.result||'');sv136AutoAnalyzeText()};r.readAsText(f);return}var txt=e.dataTransfer.getData('text');if(txt){raw.value=txt;sv136AutoAnalyzeText()}}catch(err){st('拖拽读取失败：'+(err.message||err))}})}\n  if(hero&&!hero._sv136Drop){hero._sv136Drop=1;['dragenter','dragover'].forEach(function(ev){hero.addEventListener(ev,function(e){e.preventDefault();hero.classList.add('sv136-dragging')})});['dragleave','drop'].forEach(function(ev){hero.addEventListener(ev,function(){hero.classList.remove('sv136-dragging')})})}\n}\nhook('afterApply', function(){ var b=sv136ById('copyBtn'); if(b){var txt=(sv136ById('status')&&sv136ById('status').textContent)||''; if(txt.indexOf('已复制')>=0)sv136PulseButton(b)} });\nwindow.addEventListener('DOMContentLoaded',function(){sv136EnsureDashboard();sv136InstallAutoParse();sv136Refine();sv136UpdateHealth(DATA?filtered():[])});\n\n/* ── Gist: token / upload panel ── */\nfunction gistById(id){return document.getElementById(id)}\nfunction gistVal(id){var el=gistById(id);return el?String(el.value||'').trim():''}\nfunction gistChecked(id){var el=gistById(id);return !!(el&&el.checked)}\nfunction gistDefaultFile(){var t=gistById('exportType')?gistById('exportType').value:'clash';if(t==='json')return 'subviz-backup.json';if(t==='uri')return 'subscription.txt';if(t==='uri64')return 'subscription-base64.txt';return 'mihomo.yaml'}\nfunction gistSetTokenStatus(has, text, state){var el=gistById('gistTokenStatus'),msg=text||(has?'已保存 Token':'未配置');if(el){el.value=msg;el.textContent=msg;el.dataset.status=state||(has?'ok':'empty')}}\nfunction gistPost(path, body){return loadJSON(path+'?t='+Date.now(),{method:'POST',body:JSON.stringify(body||{}),headers:{'Content-Type':'application/json;charset=utf-8'}})}\nfunction gistRefreshStatus(){gistSetTokenStatus(false,'读取中…','loading');return loadJSON('/api/gist-token/status?t='+Date.now()).then(function(r){gistSetTokenStatus(!!(r&&r.hasToken), r&&r.hasToken?'已保存 Token':'未配置',r&&r.hasToken?'saved':'empty');return r}).catch(function(e){gistSetTokenStatus(false,'Token 状态读取失败','error');throw e})}\nfunction getGistSettings(){return {token:gistVal('gistToken'),gistName:gistVal('gistName'),filename:gistVal('gistFilename')||gistDefaultFile(),gistId:gistVal('gistId'),public:gistChecked('gistPublic'),format:gistById('exportType')?gistById('exportType').value:'clash'}}\nfunction gistUploadCurrent(){try{var p=buildExportPayload();var cfg=getGistSettings();if(!cfg.gistName&&!cfg.gistId){st('请填写 Gist 名称，或指定 Gist ID');return}if(!cfg.filename){st('请填写文件名');return}st('正在上传 '+p.label+' 到 Gist：'+p.count+' 个节点…');gistPost('/api/gist-upload',{token:cfg.token,gistName:cfg.gistName,filename:cfg.filename,gistId:cfg.gistId,public:cfg.public,format:cfg.format,content:p.text}).then(function(r){if(!r.ok)throw new Error(r.error||'上传失败');if(gistById('gistRawUrl'))gistById('gistRawUrl').value=r.rawUrl||'';if(gistById('gistPageUrl'))gistById('gistPageUrl').value=r.url||'';st('Gist '+(r.action==='updated'?'已更新':'已创建')+'：'+(r.rawUrl||r.url||''));}).catch(function(e){st('上传 Gist 失败：'+(e.message||e))})}catch(e){st('上传 Gist 失败：'+(e.message||e))}}\nfunction gistEnsurePanel(){\n    if(gistById('svGistBox')) return;\n    var table=document.querySelector('table');\n    var anchor=gistById('sv133ExportGrid')||gistById('sv132ExportGrid')||document.querySelector('.exportbar')||table;\n    if(!anchor||!anchor.parentNode) return;\n    var box=document.createElement('div');\n    box.id='svGistBox';\n    box.className='rulebox sv-gist-box';\n    box.innerHTML='<details><summary>上传到 Gist / 发布远程订阅</summary>'+\n      '<div class=\"toolhint\">上传范围与当前导出一致：只上传已勾选节点。Token 保存在 Surge 持久存储，前端只显示是否已保存，不回显明文。</div>'+\n      '<div class=\"rulegrid\">'+\n      '<div><div class=\"small\">Token 状态</div><input id=\"gistTokenStatus\" value=\"读取中…\" readonly></div>'+\n      '<div><div class=\"small\">GitHub Token（留空则使用已保存 Token）</div><input id=\"gistToken\" type=\"password\" placeholder=\"github_pat_xxx / ghp_xxx\"></div>'+\n      '<div><div class=\"small\">Gist 名称 / 描述</div><input id=\"gistName\" value=\"subviz-share\"></div>'+\n      '<div><div class=\"small\">文件名</div><input id=\"gistFilename\" value=\"'+gistDefaultFile()+'\"></div>'+\n      '<div><div class=\"small\">指定 Gist ID（可选；留空则按 Gist 名称查找/创建）</div><input id=\"gistId\" placeholder=\"可选：已有 Gist ID\"></div>'+\n      '<label class=\"small\" style=\"display:flex;gap:8px;align-items:center;margin-top:30px\"><input id=\"gistPublic\" type=\"checkbox\" style=\"width:22px;height:22px\"> 创建公开 Gist（默认 Secret Gist）</label>'+\n      '</div>'+\n      '<div class=\"rulebtns\" style=\"margin-top:10px\"><button type=\"button\" id=\"gistSaveToken\" class=\"btn2\">保存/更新 Token</button><button type=\"button\" id=\"gistTestToken\" class=\"btn2\">测试 Token</button></div>'+\n      '<div class=\"rulebtns\" style=\"margin-top:10px\"><button type=\"button\" id=\"gistClearToken\" class=\"btn2\">清除已保存 Token</button><button type=\"button\" id=\"gistUpload\" class=\"btn2\">上传当前导出到 Gist</button></div>'+\n      '<div class=\"rulegrid\" style=\"margin-top:10px\"><div><div class=\"small\">Raw URL</div><input id=\"gistRawUrl\" readonly placeholder=\"上传成功后显示可订阅 raw_url\"></div><div><div class=\"small\">Gist 页面</div><input id=\"gistPageUrl\" readonly placeholder=\"上传成功后显示 Gist 页面地址\"></div></div>'+\n      '<button type=\"button\" id=\"gistCopyRaw\" class=\"btn2\">复制 Raw URL</button>'+\n      '<div class=\"toolhint\">提醒：Gist 内容就是代理订阅，包含节点密码/UUID/SNI/Host/path 等敏感信息。Secret Gist 不是加密，只是不会公开列出，拿到链接的人仍可访问。</div>'+\n      '</details>';\n    if(table&&table.parentNode===anchor.parentNode) anchor.parentNode.insertBefore(box, table); else anchor.parentNode.insertBefore(box, anchor.nextSibling);\n    bindGistPanel();\n    gistRefreshStatus().catch(function(){});\n  }\n  function bindGistPanel(){\n    var exportType=gistById('exportType'), file=gistById('gistFilename');\n    if(exportType&&file&&!file._svGistBound){file._svGistBound=1;exportType.addEventListener('change',function(){if(!String(file.value||'').trim()||/^(mihomo\\.yaml|subscription\\.txt|subscription-base64\\.txt|subviz-backup\\.json)$/.test(String(file.value||'')))file.value=gistDefaultFile()})}\n    var save=gistById('gistSaveToken');if(save&&!save._svGistBound){save._svGistBound=1;save.onclick=function(){var token=gistVal('gistToken');if(!token){st('请先粘贴新的 GitHub Token');return}st('正在保存 GitHub Token 到 Surge…');gistPost('/api/gist-token/save',{token:token}).then(function(r){if(!r.ok)throw new Error(r.error||'保存失败');gistById('gistToken').value='';gistSetTokenStatus(true,'已保存 / 可访问 Gist API','saved');st('Token 已保存/更新到 Surge。以后上传时可留空 Token。')}).catch(function(e){gistSetTokenStatus(false,'Token 保存失败','error');st('保存 Token 失败：'+(e.message||e))})}}\n    var clear=gistById('gistClearToken');if(clear&&!clear._svGistBound){clear._svGistBound=1;clear.onclick=function(){st('正在清除已保存 Token…');gistPost('/api/gist-token/delete',{}).then(function(r){if(!r.ok)throw new Error(r.error||'清除失败');gistSetTokenStatus(false,'未配置','empty');st('已清除 Surge 中保存的 GitHub Token')}).catch(function(e){gistSetTokenStatus(false,'清除 Token 失败','error');st('清除 Token 失败：'+(e.message||e))})}}\n    var test=gistById('gistTestToken');if(test&&!test._svGistBound){test._svGistBound=1;test.onclick=function(){var tokenInput=!!gistVal('gistToken');gistSetTokenStatus(false,'测试中…','loading');st('正在测试 GitHub Token…');gistPost('/api/gist-token/test',{token:gistVal('gistToken')}).then(function(r){if(!r.ok)throw new Error(r.error||'测试失败');gistSetTokenStatus(true,tokenInput?'Token 有效，但尚未保存':'已保存 Token，可访问 Gist API','valid');st('Token 测试通过：可以访问 Gist API')}).catch(function(e){gistSetTokenStatus(false,'Token 测试失败','error');st('Token 测试失败：'+(e.message||e))})}}\n    var upload=gistById('gistUpload');if(upload&&!upload._svGistBound){upload._svGistBound=1;upload.onclick=gistUploadCurrent}\n    var copy=gistById('gistCopyRaw');if(copy&&!copy._svGistBound){copy._svGistBound=1;copy.onclick=function(){var u=gistVal('gistRawUrl');if(!u){st('还没有 Raw URL，请先上传成功后再复制');return}function ok(){st('已复制 Raw URL')}if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(u).then(ok).catch(function(){if(fallbackCopy(u))ok();else st('复制 Raw URL 失败')})}else{if(fallbackCopy(u))ok();else st('复制 Raw URL 失败')}}}\n}\nwindow.svGistRefreshStatus=gistRefreshStatus;\nwindow.svGistEnsurePanel=gistEnsurePanel;\nwindow.svGistUploadCurrent=gistUploadCurrent;\nhook('afterApply', function(){ gistEnsurePanel() });\nwindow.addEventListener('DOMContentLoaded',function(){gistEnsurePanel()});\n\n/* ── sv137: finalized Linear/Raycast dark SaaS UI ── */\nvar SV137_PAGE_SIZE=20;\nvar sv137Page=1;\nvar sv137LastKey='';\nvar sv137RawOpen=false;\nvar sv137State='idle';\nvar sv137LastStatusText='';\nvar sv137DetailOpen={};\nvar sv137ChartExpanded={protocols:false,countries:false};\nfunction sv137ById(id){return document.getElementById(id)}\nfunction sv137Q(sel,root){return (root||document).querySelector? (root||document).querySelector(sel) : null}\nfunction sv137QA(sel,root){return (root||document).querySelectorAll? Array.prototype.slice.call((root||document).querySelectorAll(sel)) : []}\nfunction sv137Closest(el,sel){return el&&el.closest?el.closest(sel):null}\nfunction sv137BtnIcon(txt,ico){return '<span class=\"sv137-ico\" aria-hidden=\"true\">'+ico+'</span><span>'+txt+'</span>'}\nfunction sv137HasData(){return !!(DATA&&DATA.nodes&&DATA.nodes.length)}\nfunction sv137IsURL(u){try{var x=new URL(String(u||'').trim());return /^https?:$/.test(x.protocol)}catch(_){return false}}\nfunction sv137SetBusy(on){var b=sv137ById('pull');if(!b)return;b.disabled=!!on;b.classList.toggle('sv137-loading',!!on);b.innerHTML=on?'<span class=\"sv137-spinner\" aria-hidden=\"true\"></span><span>分析中...</span>':sv137BtnIcon('拉取分析','⧉')}\nfunction sv137StatusKind(msg,kind){\n  if(kind)return kind;\n  msg=String(msg||'');\n  if(!msg||/准备就绪/.test(msg))return 'idle';\n  if(/失败|错误|无法|无效|请先|不支持|没有|异常|拒绝/.test(msg))return 'error';\n  if(/正在|开始|检测：|上传|读取|拉取/.test(msg))return 'loading';\n  if(/完成|已|成功|通过/.test(msg))return 'success';\n  return 'info';\n}\nvar sv137BaseSt=st;\nst=function(msg,kind){\n  var el=sv137ById('status');\n  var type=sv137StatusKind(msg,kind);\n  sv137State=type;sv137LastStatusText=String(msg||'');\n  if(el){\n    el.textContent=sv137LastStatusText;\n    el.className='status sv137-status sv137-status--'+type;\n    el.style.display=(type==='idle'&&!sv137LastStatusText)?'none':'';\n  }else{try{sv137BaseSt(msg)}catch(_){}}\n};\nfunction sv137InstallStyle(){\n  if(sv137ById('sv137Style'))return;\n  var s=document.createElement('style');s.id='sv137Style';\n  s.textContent=\n  'body.sv137{--sv-bg:#0F1117;--sv-card:#1A1D27;--sv-card2:#242736;--sv-row:#1E2130;--sv-border:#2A2D3A;--sv-border2:#34384A;--sv-text:#E8E8ED;--sv-muted:#6B7084;--sv-disabled:#3D4155;--sv-blue:#3B82F6;--sv-green:#5FCB7A;--sv-green-soft:rgba(95,203,122,.12);--sv-red:#EF4444;--sv-red-soft:rgba(239,68,68,.10);--sv-yellow:#D99A32;background:var(--sv-bg)!important;color:var(--sv-text)!important;font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",\"PingFang SC\",Roboto,Helvetica,Arial,sans-serif!important;-webkit-font-smoothing:antialiased!important;}'+\n  'body.sv137:before{content:\"\";position:fixed;inset:0;pointer-events:none;background:radial-gradient(circle at 50% -18%,rgba(59,130,246,.10),transparent 34%);opacity:.55;}'+\n  'body.sv137 .wrap{position:relative;max-width:1280px!important;margin:0 auto!important;padding:24px!important;}'+\n  'body.sv137 .hero,body.sv137 .card,body.sv137 .rulebox,body.sv137 .sv137-export-card,body.sv137 .sv137-advanced-card{background:var(--sv-card)!important;border:1px solid var(--sv-border)!important;border-radius:16px!important;box-shadow:none!important;margin:0 0 24px!important;padding:24px!important;transition:border-color .2s ease,background .2s ease!important;}'+\n  'body.sv137 .hero:hover,body.sv137 .card:hover,body.sv137 .sv137-export-card:hover,body.sv137 .sv137-advanced-card:hover{border-color:#313A54!important;}'+\n  'body.sv137 .hero:before{display:none!important;}body.sv137 .hero>.small{display:none!important;}'+\n  'body.sv137 h1{font-size:24px!important;line-height:1.18!important;font-weight:700!important;letter-spacing:-.03em!important;margin:0 0 8px!important;color:var(--sv-text)!important;}'+\n  'body.sv137 h2{font-size:15px!important;line-height:1.3!important;font-weight:650!important;color:var(--sv-text)!important;margin:0 0 16px!important;letter-spacing:-.01em!important;}'+\n  'body.sv137 p,body.sv137 .muted,body.sv137 .small,body.sv137 .toolhint{color:var(--sv-muted)!important;}body.sv137 .small{font-size:12px!important;}body.sv137 .toolhint{font-size:13px!important;line-height:1.65!important;margin:8px 0 0!important;}'+\n  'body.sv137 input,body.sv137 textarea,body.sv137 select{background:#111522!important;border:1px solid var(--sv-border)!important;color:var(--sv-text)!important;border-radius:12px!important;padding:12px 14px!important;font-size:14px!important;line-height:1.4!important;box-shadow:none!important;outline:none!important;transition:border-color .18s ease,box-shadow .18s ease,background .18s ease!important;}'+\n  'body.sv137 input:focus,body.sv137 textarea:focus,body.sv137 select:focus{border-color:var(--sv-blue)!important;box-shadow:0 0 0 3px rgba(59,130,246,.18)!important;background:#121827!important;}'+\n  'body.sv137 input::placeholder,body.sv137 textarea::placeholder{color:#555B70!important;}body.sv137 #url{height:46px!important;margin:18px 0 0!important;}'+\n  'body.sv137 button{appearance:none;background:#202432!important;border:1px solid var(--sv-border)!important;color:var(--sv-text)!important;border-radius:12px!important;box-shadow:none!important;font-size:14px!important;font-weight:600!important;line-height:1!important;min-height:40px!important;padding:0 14px!important;margin:0!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:8px!important;white-space:nowrap!important;transition:background .18s ease,border-color .18s ease,color .18s ease,opacity .18s ease,transform .18s ease!important;}'+\n  'body.sv137 button:hover:not(:disabled){background:#262B3A!important;border-color:#394052!important;color:#fff!important;transform:none!important;box-shadow:none!important;}'+\n  'body.sv137 button:focus-visible{outline:none!important;border-color:var(--sv-blue)!important;box-shadow:0 0 0 3px rgba(59,130,246,.18)!important;}'+\n  'body.sv137 button:disabled{background:rgba(255,255,255,.025)!important;border-color:rgba(255,255,255,.055)!important;color:var(--sv-disabled)!important;cursor:not-allowed!important;opacity:1!important;}'+\n  'body.sv137 #pull,body.sv137 #alive,body.sv137 #exportBtn{background:var(--sv-blue)!important;border-color:var(--sv-blue)!important;color:#fff!important;}body.sv137 #pull:hover:not(:disabled),body.sv137 #alive:hover:not(:disabled),body.sv137 #exportBtn:hover:not(:disabled){background:#4D8DF8!important;border-color:#4D8DF8!important;}'+\n  'body.sv137 #demo,body.sv137 #textBtn,body.sv137 #copyBtn,body.sv137 #copyAliveBtn{background:transparent!important;}'+\n  'body.sv137 .sv137-input-actions{display:grid!important;grid-template-columns:1fr 1fr 1fr!important;gap:16px!important;margin-top:16px!important;}body.sv137 .sv137-input-actions button{height:44px!important;width:100%!important;}'+\n  'body.sv137 .sv137-paste-toggle{width:100%!important;height:42px!important;justify-content:space-between!important;margin-top:16px!important;background:#171B28!important;color:#A5ACC0!important;}body.sv137 .sv137-paste-toggle:after{content:\"⌄\";color:#8A91A6;}body.sv137.raw-open .sv137-paste-toggle:after{content:\"⌃\";}'+\n  'body.sv137 .sv137-raw-panel{display:none!important;margin-top:12px!important;}body.sv137.raw-open .sv137-raw-panel{display:block!important;}body.sv137 #raw{height:128px!important;resize:vertical!important;}'+\n  'body.sv137 .sv137-status{font-size:13px!important;line-height:1.45!important;border-radius:12px!important;padding:10px 12px!important;margin-top:12px!important;max-height:none!important;overflow:hidden!important;background:#141925!important;border:1px solid var(--sv-border)!important;color:var(--sv-muted)!important;}'+\n  'body.sv137 .sv137-status--idle{display:none!important;}body.sv137 .sv137-status--error{display:block!important;background:var(--sv-red-soft)!important;border-color:rgba(239,68,68,.30)!important;color:#F2A4A4!important;}body.sv137 .sv137-status--loading{display:block!important;background:rgba(59,130,246,.08)!important;border-color:rgba(59,130,246,.22)!important;color:#9DBEFA!important;}body.sv137 .sv137-status--success{display:block!important;background:var(--sv-green-soft)!important;border-color:rgba(95,203,122,.22)!important;color:#A5DAB3!important;}'+\n  'body.sv137 .sv137-spinner{width:14px;height:14px;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:999px;animation:sv137spin .9s linear infinite;}@keyframes sv137spin{to{transform:rotate(360deg)}}'+\n  'body.sv137 #cards.grid{display:none!important;}body.sv137 .sv135-chart-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:24px!important;margin:0 0 24px!important;}body.sv137 .sv135-chart-grid>.card{margin:0!important;padding:24px!important;border-radius:16px!important;background:var(--sv-card)!important;}'+\n  'body.sv137 .bar{display:grid!important;grid-template-columns:minmax(64px,92px) minmax(52px,1fr) 44px 56px!important;gap:8px!important;align-items:center!important;min-height:28px!important;margin:8px 0!important;font-size:13px!important;color:var(--sv-text)!important;min-width:0!important;}'+\n  'body.sv137 .sv137-dist-row{grid-template-columns:minmax(64px,92px) minmax(52px,1fr) 44px 56px!important;}body.sv137 .sv137-dist-name{min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;}body.sv137 .sv137-dist-track{width:100%!important;min-width:0!important;}body.sv137 .sv137-dist-count,body.sv137 .sv137-dist-percent{display:block!important;text-align:right!important;white-space:nowrap!important;font:500 12px/1 SFMono-Regular,\"SF Mono\",\"JetBrains Mono\",Consolas,monospace!important;color:#AAB1C4!important;font-variant-numeric:tabular-nums!important;font-feature-settings:\"tnum\" 1!important;letter-spacing:0!important;}body.sv137 .sv137-dist-count{color:#C6CCDA!important;}'+\n  'body.sv137 .track{height:10px!important;background:#252B3A!important;border-radius:999px!important;overflow:hidden!important;}body.sv137 .fill{height:10px!important;background:var(--sv-blue)!important;border-radius:999px!important;}body.sv137 .bar b{font:500 12px/1 SFMono-Regular,\"SF Mono\",\"JetBrains Mono\",Consolas,monospace!important;color:#AAB1C4!important;font-variant-numeric:tabular-nums!important;font-feature-settings:\"tnum\" 1!important;text-align:right!important;white-space:nowrap!important;}'+\n  'body.sv137 .sv137-card-head,body.sv137 .sv137-card-title{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:12px!important;margin-bottom:14px!important;}body.sv137 .sv137-card-title span:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}body.sv137 .sv137-total{font:500 12px/1.2 SFMono-Regular,\"SF Mono\",\"JetBrains Mono\",monospace;color:#AAB1C4;white-space:nowrap;font-variant-numeric:tabular-nums;font-feature-settings:\"tnum\" 1;}body.sv137 .sv137-link{width:100%!important;height:auto!important;min-height:0!important;margin-top:14px!important;padding:14px 0 0!important;border:0!important;border-top:1px solid var(--sv-border)!important;border-radius:0!important;background:transparent!important;color:#AAB1C4!important;font-size:13px!important;display:flex!important;justify-content:space-between!important;cursor:pointer!important;}body.sv137 .sv137-link:hover{color:#E8E8ED!important;background:transparent!important;border-color:var(--sv-border)!important;}'+\n  'body.sv137 #sv135Health .health-grid{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:10px!important;margin-top:12px!important;}body.sv137 #sv135Health .health-cell{background:#171C2A!important;border:1px solid var(--sv-border)!important;border-radius:12px!important;padding:12px!important;min-height:80px!important;display:grid!important;grid-template-rows:minmax(16px,auto) minmax(24px,1fr) minmax(15px,auto)!important;align-content:start!important;min-width:0!important;}body.sv137 #sv135Health .health-cell span{display:block;color:var(--sv-muted)!important;font-size:12px!important;line-height:1.2!important;font-weight:600!important;min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;}body.sv137 #sv135Health .health-cell b{display:block;margin-top:4px;font:650 22px/1.05 SFMono-Regular,\"SF Mono\",\"JetBrains Mono\",monospace!important;color:var(--sv-text)!important;font-variant-numeric:tabular-nums!important;font-feature-settings:\"tnum\" 1!important;white-space:nowrap!important;min-width:0!important;}body.sv137 #sv135Health .health-cell small{display:block;margin-top:4px;font:600 12px/1.2 SFMono-Regular,\"SF Mono\",\"JetBrains Mono\",Consolas,monospace!important;color:#AAB1C4!important;font-variant-numeric:tabular-nums!important;font-feature-settings:\"tnum\" 1!important;white-space:nowrap!important;}'+\n  'body.sv137 #sv135Health .health-cell.health-ok b{color:var(--sv-green)!important;}body.sv137 #sv135Health .health-cell.health-bad b{color:#E46F6F!important;}body.sv137 #sv135Health .health-cell.health-scope b{color:#7EABFA!important;}'+\n  'body.sv137 .sv137-health-main{background:#171C2A!important;border:1px solid var(--sv-border)!important;border-radius:14px!important;padding:16px!important;margin-bottom:12px!important;min-height:112px!important;}body.sv137 .sv137-health-label{font-size:12px;color:var(--sv-muted);font-weight:600;}body.sv137 .sv137-health-rate{display:block;margin-top:4px;font:750 40px/1 SFMono-Regular,\"SF Mono\",\"JetBrains Mono\",monospace;color:var(--sv-green);letter-spacing:-.04em;font-variant-numeric:tabular-nums;font-feature-settings:\"tnum\" 1;white-space:nowrap;}body.sv137 .sv137-health-bar{height:10px;background:#252B3A;border-radius:999px;overflow:hidden;margin-top:12px;}body.sv137 .sv137-health-bar>i{display:block;height:100%;background:var(--sv-green);border-radius:999px;}'+\n  'body.sv137 .sv137-node-card{padding:18px 18px 0!important;overflow-x:auto!important;overflow-y:visible!important;}body.sv137 .sv137-node-card>h2{display:none!important;}body.sv137 #count{margin:0!important;font-size:13px!important;}'+\n  'body.sv137 .sv137-table-controls{display:grid!important;grid-template-columns:minmax(260px,1fr) 170px 170px auto!important;gap:14px!important;align-items:center!important;margin-bottom:14px!important;}body.sv137 .sv137-table-controls input,body.sv137 .sv137-table-controls select{height:42px!important;}'+\n  'body.sv137 .sv137-toggle{height:42px;display:inline-flex!important;align-items:center!important;gap:10px!important;color:#BDC4D5!important;font-size:14px!important;white-space:nowrap!important;}body.sv137 .sv137-toggle input{position:absolute;opacity:0;pointer-events:none;}body.sv137 .sv137-switch{width:38px;height:22px;border-radius:999px;background:#34394A;border:1px solid var(--sv-border2);position:relative;transition:.18s;}body.sv137 .sv137-switch:before{content:\"\";position:absolute;width:16px;height:16px;left:3px;top:2px;border-radius:50%;background:#CDD3E0;transition:.18s;}body.sv137 .sv137-toggle input:checked+.sv137-switch{background:rgba(59,130,246,.35);border-color:rgba(59,130,246,.45);}body.sv137 .sv137-toggle input:checked+.sv137-switch:before{transform:translateX(16px);background:#fff;}'+\n  'body.sv137 table{width:100%!important;min-width:1080px!important;border-collapse:separate!important;border-spacing:0!important;table-layout:fixed!important;margin:0!important;background:#151A26!important;border:1px solid var(--sv-border)!important;border-radius:14px!important;overflow:hidden!important;}body.sv137 thead{display:table-header-group!important;}body.sv137 th{height:40px!important;background:#1B202E!important;border:0!important;border-bottom:1px solid var(--sv-border)!important;color:#A8B0C3!important;font-size:12px!important;font-weight:650!important;padding:0 12px!important;text-align:left!important;}body.sv137 td{height:48px!important;padding:0 12px!important;border:0!important;border-bottom:1px solid rgba(42,45,58,.78)!important;color:#C9CFDD!important;font-size:14px!important;vertical-align:middle!important;word-break:normal!important;}body.sv137 tbody tr:nth-child(even) td{background:rgba(255,255,255,.015)!important;}body.sv137 tbody tr:hover td{background:rgba(255,255,255,.035)!important;color:var(--sv-text)!important;}'+\n  'body.sv137 th:nth-child(1),body.sv137 td:nth-child(1){width:46px!important;}body.sv137 th:nth-child(2),body.sv137 td:nth-child(2){width:320px!important;min-width:280px!important;}body.sv137 th:nth-child(3),body.sv137 td:nth-child(3){width:86px!important;}body.sv137 th:nth-child(4),body.sv137 td:nth-child(4){width:116px!important;}body.sv137 th:nth-child(5),body.sv137 td:nth-child(5){width:108px!important;}body.sv137 th:nth-child(6),body.sv137 td:nth-child(6){width:108px!important;}body.sv137 th:nth-child(7),body.sv137 td:nth-child(7){width:106px!important;}body.sv137 th:nth-child(8),body.sv137 td:nth-child(8){width:88px!important;}body.sv137 th:nth-child(9),body.sv137 td:nth-child(9){width:46px!important;}'+\n  'body.sv137 .rowchk{width:18px!important;height:18px!important;accent-color:var(--sv-blue)!important;margin:0!important;padding:0!important;}body.sv137 .sv137-node-name{display:block;min-width:0;font-weight:560;color:var(--sv-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}body.sv137 .sv137-mobile-meta{display:none;}body.sv137 .sv137-region{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}body.sv137 .sv137-latency{font:600 13px/1 SFMono-Regular,\"SF Mono\",\"JetBrains Mono\",monospace;}body.sv137 .sv137-latency.ok{color:var(--sv-green);}body.sv137 .sv137-latency.warn{color:var(--sv-yellow);}body.sv137 .sv137-latency.bad{color:#E46F6F;}body.sv137 .sv137-latency.muted{color:var(--sv-muted);}'+\n  'body.sv137 .tag,body.sv137 .sv137-tag{display:inline-flex!important;align-items:center!important;justify-content:center!important;border-radius:999px!important;padding:4px 9px!important;font-size:12px!important;font-weight:600!important;background:rgba(59,130,246,.10)!important;border:1px solid rgba(59,130,246,.18)!important;color:#9DBEFA!important;max-width:100px!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;text-transform:none!important;}'+\n  'body.sv137 .sv137-status-pill{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:4px 9px;font-size:12px;font-weight:600;border:1px solid transparent;background:rgba(255,255,255,.04);color:#AAB1C4;}body.sv137 .sv137-status-pill:before{content:\"\";width:6px;height:6px;border-radius:50%;background:#7A8298;}body.sv137 .sv137-status-pill.ok{background:rgba(95,203,122,.10);border-color:rgba(95,203,122,.16);color:#9CDDAF;}body.sv137 .sv137-status-pill.ok:before{background:var(--sv-green);}body.sv137 .sv137-status-pill.bad{background:rgba(239,68,68,.09);border-color:rgba(239,68,68,.16);color:#F2A4A4;}body.sv137 .sv137-status-pill.bad:before{background:#E46F6F;}'+\n  'body.sv137 .sv137-actions{opacity:.28;color:#8C94A9;background:transparent!important;border-color:transparent!important;min-height:28px!important;width:28px!important;padding:0!important;border-radius:8px!important;}body.sv137 tbody tr:hover .sv137-actions,body.sv137 .sv137-actions:focus-visible{opacity:1;color:#E8E8ED!important;background:#242736!important;}body.sv137 .sv137-source-badge{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:4px 8px;font-size:12px;font-weight:600;border:1px solid var(--sv-border);background:rgba(255,255,255,.035);color:#AAB1C4;white-space:nowrap;}body.sv137 .sv137-source-badge.landing{background:rgba(95,203,122,.10);border-color:rgba(95,203,122,.18);color:#9CDDAF;}body.sv137 .sv137-source-badge.name{background:rgba(217,154,50,.10);border-color:rgba(217,154,50,.18);color:#DDB777;}body.sv137 .sv137-detail-row td{height:auto!important;padding:0!important;background:#151A26!important;border-bottom:1px solid rgba(42,45,58,.78)!important;}body.sv137 .sv137-detail{margin:0 12px 12px 58px;padding:14px;border:1px solid var(--sv-border);border-radius:12px;background:#171C2A;color:#C9CFDD;}body.sv137 .sv137-detail-grid{display:grid;grid-template-columns:1fr 1.5fr;gap:12px;}body.sv137 .sv137-detail-item{background:#131824;border:1px solid rgba(42,45,58,.72);border-radius:10px;padding:12px;}body.sv137 .sv137-detail-label{font-size:12px;color:var(--sv-muted);margin-bottom:6px;}body.sv137 .sv137-detail-value{font:500 13px/1.45 SFMono-Regular,\"SF Mono\",\"JetBrains Mono\",Consolas,monospace;color:var(--sv-text);word-break:break-word;}body.sv137 .sv137-detail-note{margin-top:10px;color:#8D95AA;font-size:12px;line-height:1.55;}'+\n  'body.sv137 .sv137-table-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 4px 14px;color:#AAB1C4;font-size:13px;}body.sv137 .sv137-pagination{display:flex;align-items:center;gap:6px;}body.sv137 .sv137-page-btn{min-height:30px!important;height:30px!important;min-width:30px!important;padding:0 8px!important;border-radius:8px!important;background:#1E2433!important;}body.sv137 .sv137-page-btn.active{background:var(--sv-blue)!important;border-color:var(--sv-blue)!important;color:#fff!important;}body.sv137 .sv137-page-btn:disabled{opacity:.55!important;}body.sv137 .sv137-page-size{width:auto!important;height:32px!important;padding:0 28px 0 10px!important;}'+\n  'body.sv137 .sv137-empty{padding:34px 14px!important;text-align:center!important;color:var(--sv-muted)!important;line-height:1.7!important;border:0!important;background:transparent!important;}'+\n  'body.sv137 .sv137-bulk-toolbar{height:54px;display:flex!important;align-items:center!important;gap:10px!important;padding:10px 18px!important;margin:0 -18px!important;border-top:1px solid var(--sv-border)!important;background:#181D2B!important;overflow-x:auto!important;}body.sv137 .sv137-bulk-toolbar button{height:32px!important;min-height:32px!important;padding:0 12px!important;font-size:13px!important;background:#202432!important;}body.sv137 .sv137-bulk-toolbar .sv137-sep{width:1px;height:22px;background:var(--sv-border);flex:0 0 auto;}'+\n  'body.sv137 .sv137-tipwrap{position:relative;display:inline-flex;}body.sv137 .sv137-tipwrap:after{content:attr(data-tip);position:absolute;right:0;bottom:calc(100% + 8px);background:#0F1117;border:1px solid var(--sv-border);color:#C6CCDA;border-radius:8px;padding:7px 9px;white-space:nowrap;font-size:12px;opacity:0;transform:translateY(4px);pointer-events:none;transition:.15s;box-shadow:0 10px 28px rgba(0,0,0,.35);z-index:10;}body.sv137 .sv137-tipwrap:hover:after,body.sv137 .sv137-tipwrap:focus-within:after{opacity:1;transform:translateY(0);}'+\n  'body.sv137 .sv137-export-card{display:grid!important;grid-template-columns:auto 1fr!important;gap:12px 24px!important;align-items:center!important;}body.sv137 .sv137-export-title{font-size:18px;font-weight:650;color:var(--sv-text);grid-row:1 / span 2;}body.sv137 .sv137-export-row{display:grid!important;grid-template-columns:220px 1fr 1fr 1.25fr!important;gap:14px!important;align-items:center!important;}body.sv137 .sv137-export-row select,body.sv137 .sv137-export-row button{height:42px!important;width:100%!important;}body.sv137 .sv137-export-help{font-size:13px;color:var(--sv-muted);line-height:1.55;}'+\n  'body.sv137 .sv137-advanced-card{padding:0!important;overflow:hidden!important;}body.sv137 .sv137-advanced-card .rulebox{margin:0!important;border:0!important;border-bottom:1px solid var(--sv-border)!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;padding:0!important;}body.sv137 .sv137-advanced-card .rulebox:last-child{border-bottom:0!important;}body.sv137 .sv137-advanced-card details{padding:0!important;}body.sv137 .sv137-advanced-card summary{display:grid!important;grid-template-columns:minmax(160px,220px) minmax(0,1fr) auto 18px!important;gap:18px!important;align-items:center!important;padding:18px 24px!important;color:var(--sv-text)!important;font-weight:650!important;cursor:pointer!important;list-style:none!important;}body.sv137 .sv137-advanced-card summary:before{display:none!important;}body.sv137 .sv137-advanced-card summary::-webkit-details-marker{display:none!important;}body.sv137 .sv137-acc-desc{color:var(--sv-muted);font-size:13px;font-weight:400;}body.sv137 .sv137-acc-state{color:#AAB1C4;font-size:12px;border:1px solid var(--sv-border);background:#1E2433;border-radius:999px;padding:5px 9px;}body.sv137 .sv137-chevron{color:#8D95AA;}body.sv137 .sv137-advanced-card details[open] .sv137-chevron{transform:rotate(180deg);}body.sv137 .sv137-advanced-card details>div:not(.toolhint),body.sv137 .sv137-advanced-card details>.rulegrid,body.sv137 .sv137-advanced-card details>label,body.sv137 .sv137-advanced-card details>textarea,body.sv137 .sv137-advanced-card details>input,body.sv137 .sv137-advanced-card details>.rulebtns{margin-left:24px!important;margin-right:24px!important;}body.sv137 .sv137-advanced-card details[open]{background:#181D2B!important;}body.sv137 .sv137-advanced-card .toolhint{margin:0 24px 16px!important;}'+\n  'body.sv137 .sectionline,body.sv137 #sv135SelectTitle,body.sv137 #sv135ActionTitle,body.sv137 #sv135AdvancedTitle,body.sv137 #sv135ExportTitle{display:none!important;}body.sv137 .selectbar,body.sv137 .toolbar,body.sv137 .sv-op-grid,body.sv137 .sv-mini-grid{display:contents!important;}body.sv137 label:has(#unique){display:none!important;}'+\n  '@media(max-width:980px){body.sv137 .sv135-chart-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important;overflow-x:visible!important;padding-bottom:0!important;gap:16px!important;}body.sv137 .sv135-chart-grid>.card{padding:18px!important;}body.sv137 .bar,body.sv137 .sv137-dist-row{grid-template-columns:minmax(52px,76px) minmax(42px,1fr) 38px 46px!important;gap:6px!important;}body.sv137 .sv137-dist-count,body.sv137 .sv137-dist-percent{font-size:11px!important;}body.sv137 .sv137-table-controls{grid-template-columns:1fr 1fr!important;}body.sv137 .sv137-export-row{grid-template-columns:1fr 1fr!important;}}'+\n  '@media(max-width:720px){body.sv137 .wrap{padding:16px 12px 40px!important;overflow-x:hidden!important;}body.sv137 .sv135-chart-grid{grid-template-columns:1fr!important;overflow-x:visible!important;gap:16px!important;}body.sv137 .sv135-chart-grid>.card{min-width:0!important;width:100%!important;}body.sv137 .bar,body.sv137 .sv137-dist-row{grid-template-columns:minmax(64px,92px) minmax(52px,1fr) 44px 56px!important;gap:8px!important;}body.sv137 #sv135Health .health-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important;}body.sv137 .hero,body.sv137 .card,body.sv137 .sv137-export-card{padding:18px!important;border-radius:14px!important;margin-bottom:16px!important;}body.sv137 .sv137-input-actions{grid-template-columns:1fr!important;gap:10px!important;}body.sv137 .sv137-table-controls{grid-template-columns:1fr!important;}body.sv137 table,body.sv137 thead,body.sv137 tbody,body.sv137 tr,body.sv137 td{display:block!important;}body.sv137 thead{display:none!important;}body.sv137 table{width:100%!important;min-width:0!important;background:transparent!important;border:0!important;border-radius:0!important;}body.sv137 tbody{display:grid!important;gap:12px!important;}body.sv137 tbody tr{display:grid!important;grid-template-columns:34px minmax(0,1fr) auto!important;grid-template-areas:\"check name status\" \"check name actions\"!important;gap:8px 10px!important;background:#171C2A!important;border:1px solid var(--sv-border)!important;border-radius:14px!important;padding:12px!important;}body.sv137 tbody td{height:auto!important;padding:0!important;border:0!important;background:transparent!important;}body.sv137 tbody tr.sv137-main-row td{width:auto!important;}body.sv137 tbody tr.sv137-main-row td:nth-child(1){grid-area:check;}body.sv137 tbody tr.sv137-main-row td:nth-child(2){display:block!important;grid-area:name!important;min-width:0!important;}body.sv137 tbody tr.sv137-main-row td:nth-child(3),body.sv137 tbody tr.sv137-main-row td:nth-child(4),body.sv137 tbody tr.sv137-main-row td:nth-child(5),body.sv137 tbody tr.sv137-main-row td:nth-child(6),body.sv137 tbody tr.sv137-main-row td:nth-child(7){display:none!important;}body.sv137 tbody tr.sv137-main-row td:nth-child(8){grid-area:status;text-align:right;}body.sv137 tbody tr.sv137-main-row td:nth-child(9){grid-area:actions;text-align:right;}body.sv137 .sv137-node-name{white-space:normal!important;line-height:1.35!important;}body.sv137 .sv137-mobile-meta{display:block!important;margin-top:7px;color:var(--sv-muted);font-size:12px;line-height:1.55;}body.sv137 tbody tr.sv137-detail-row{display:block!important;padding:0!important;background:transparent!important;border:0!important;margin-top:-8px;}body.sv137 tbody tr.sv137-detail-row td{display:block!important;width:auto!important;}body.sv137 .sv137-detail{margin:0!important;padding:12px!important;}body.sv137 .sv137-detail-grid{grid-template-columns:1fr!important;}body.sv137 .sv137-table-footer{flex-direction:column;align-items:flex-start;}body.sv137 .sv137-bulk-toolbar{margin:0 -18px!important;padding-left:18px!important;}body.sv137 .sv137-export-card{display:block!important;}body.sv137 .sv137-export-row{grid-template-columns:1fr!important;margin-top:14px;}body.sv137 .sv137-export-help{margin-top:10px;}body.sv137 .sv137-advanced-card summary{grid-template-columns:1fr auto!important;gap:6px 10px!important;}body.sv137 .sv137-acc-desc{grid-column:1 / -1;}body.sv137 .sv137-acc-state{grid-column:1;justify-self:start;}body.sv137 .sv137-chevron{grid-column:2;grid-row:1;}}'+\n  '@media(max-width:380px){body.sv137 .bar,body.sv137 .sv137-dist-row{grid-template-columns:minmax(56px,74px) minmax(42px,1fr) 38px 48px!important;gap:6px!important;}body.sv137 #sv135Health .health-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;}body.sv137 #sv135Health .health-cell{min-height:76px!important;}}';\n  document.head.appendChild(s);\n}\nfunction sv137FmtPct(count,total){return total?((count/total*100).toFixed(1).replace(/\\.0$/,'')+'%'):'--'}\nfunction sv137SetChartTitle(el,title,total){var card=sv137Closest(el,'.card'),h=card&&sv137Q('h2',card);if(h){if((' '+(h.className||'')+' ').indexOf(' sv137-card-title ')<0)h.className=(h.className?String(h.className)+' ':'')+'sv137-card-title';h.innerHTML='<span>'+esc(title)+'</span><span class=\"sv137-total\">'+esc(total)+'</span>';return ''}return '<div class=\"sv137-card-head\"><h2>'+esc(title)+'</h2><div class=\"sv137-total\">'+esc(total)+'</div></div>'}\nfunction sv137Bars(arr,total,limit){arr=arr||[];if(!arr.length)return '<div class=\"sv137-empty\">--</div>';var max=arr[0].count||1;return arr.slice(0,limit||5).map(function(x,i){var cls=i===0?' style=\"background:var(--sv-blue)!important\"':'';var pct=sv137FmtPct(x.count,total);return '<div class=\"bar sv137-dist-row\"><div class=\"sv137-dist-name\" title=\"'+esc(x.key||'未知')+'\">'+esc(x.key||'未知')+'</div><div class=\"track sv137-dist-track\"><div class=\"fill\"'+cls+' style=\"width:'+(max?Math.round(x.count/max*100):0)+'%\"></div></div><span class=\"sv137-dist-count\">'+esc(x.count)+'</span><span class=\"sv137-dist-percent\">'+esc(pct)+'</span></div>'}).join('')}\nfunction sv137ChartLink(kind,arr){arr=arr||[];if(arr.length<=5)return '';var isP=kind==='protocols',open=!!sv137ChartExpanded[kind],name=isP?'协议':'地区',label=(open?'收起':'查看全部')+name;return '<button type=\"button\" class=\"sv137-link\" data-chart=\"'+esc(kind)+'\" aria-expanded=\"'+(open?'true':'false')+'\" onclick=\"window.sv137ToggleChart&&window.sv137ToggleChart(\\''+esc(kind)+'\\');return false\"><span>'+esc(label)+'</span><span>'+(open?'⌃':'›')+'</span></button>'}\nwindow.sv137ToggleChart=function(kind){if(kind!=='protocols'&&kind!=='countries')return;sv137ChartExpanded[kind]=!sv137ChartExpanded[kind];sv137UpdateCharts()};\nfunction sv137UpdateCharts(){\n  if(!DATA)return;\n  var s=DATA.summary||{},p=DATA.stats&&DATA.stats.byProtocol||[],c=DATA.stats&&DATA.stats.byCountry||[];\n  var pc=sv137ById('protocols'),cc=sv137ById('countries'),pl=sv137ChartExpanded.protocols?p.length:5,cl=sv137ChartExpanded.countries?c.length:5;\n  if(pc)pc.innerHTML=sv137SetChartTitle(pc,'协议分布','总数 '+(s.total||0))+sv137Bars(p,s.total||0,pl)+sv137ChartLink('protocols',p);\n  if(cc)cc.innerHTML=sv137SetChartTitle(cc,'国家 / 地区分布','总数 '+(s.countries||0))+sv137Bars(c,s.total||0,cl)+sv137ChartLink('countries',c);\n}\nfunction sv137Health(nodes){var a=0,d=0,u=0;(nodes||[]).forEach(function(n){if(n.aliveOK===true)a++;else if(n.aliveOK===false)d++;else u++});return{alive:a,dead:d,unknown:u,total:(nodes||[]).length}}\nfunction sv137RenderHealth(nodes){\n  var h=sv137Health(nodes||[]),el=sv137ById('sv135Health');if(!el)return;\n  var p=h.total?Math.round(h.alive/h.total*1000)/10:0;\n  el.innerHTML='<div class=\"sv137-card-head\"><h2>节点健康状况</h2><div class=\"sv137-total\">总数 '+h.total+'</div></div>'+\n    '<div class=\"sv137-health-main\"><div class=\"sv137-health-label\">可用率</div><b class=\"sv137-health-rate\">'+(h.total?p.toFixed(1).replace(/\\.0$/,''):'--')+'%</b><div class=\"sv137-health-bar\"><i style=\"width:'+(h.total?p:0)+'%\"></i></div></div>'+\n    '<div class=\"health-grid\"><div class=\"health-cell health-ok\"><span>可用</span><b id=\"hAlive\">'+h.alive+'</b><small>'+sv137FmtPct(h.alive,h.total)+'</small></div><div class=\"health-cell health-bad\"><span>不可用</span><b id=\"hDead\">'+h.dead+'</b><small>'+sv137FmtPct(h.dead,h.total)+'</small></div><div class=\"health-cell\"><span>未知</span><b id=\"hUntested\">'+h.unknown+'</b><small>'+sv137FmtPct(h.unknown,h.total)+'</small></div><div class=\"health-cell health-scope\"><span>当前筛选</span><b id=\"hScope\">'+h.total+'</b><small>100%</small></div></div>';\n}\nfunction sv137EnsureHealthCard(){\n  var p=sv137Closest(sv137ById('protocols'),'.card'),c=sv137Closest(sv137ById('countries'),'.card');if(!p||!c)return;\n  var grid=sv137ById('sv135Charts');\n  if(!grid){grid=document.createElement('div');grid.id='sv135Charts';grid.className='sv135-chart-grid';p.parentNode.insertBefore(grid,p);grid.appendChild(p);grid.appendChild(c)}\n  if(!sv137ById('sv135Health')){var h=document.createElement('div');h.id='sv135Health';h.className='card';grid.appendChild(h)}\n}\nfunction sv137Region(n){var cc=String(n.countryCode||'').toUpperCase();return (flag(cc)+' '+(n.country||'未知')+(n.geoCity?' '+n.geoCity:''))}\nfunction sv137LatencyNumber(v){var n=parseInt(v,10);return isFinite(n)?n:null}\nfunction sv137FmtLatencyValue(v,cls){var n=sv137LatencyNumber(v);if(n==null)return '<span class=\"sv137-latency muted\">--</span>';return '<span class=\"sv137-latency '+(cls||((n>90)?'warn':'ok'))+'\">'+esc(n)+' ms</span>'}\nfunction sv137AliveLatency(n){var v=sv137LatencyNumber(n&&n.aliveLatency);if(!n||n.aliveOK!==true||v==null)return '<span class=\"sv137-latency bad\">不可用</span>';return sv137FmtLatencyValue(v)}\nfunction sv137LandingLatency(n){var v=sv137LatencyNumber(n&&n.landingLatency);if(!n)return '<span class=\"sv137-latency muted\">未检测</span>';if(n.landingOK===false||n.landingError)return '<span class=\"sv137-latency warn\">检测失败</span>';if(n.landingOK!==true||v==null)return '<span class=\"sv137-latency muted\">未检测</span>';return sv137FmtLatencyValue(v)}\nfunction sv137NodeStatus(n){if(n.aliveOK===true)return '<span class=\"sv137-status-pill ok\">可用</span>';if(n.aliveOK===false)return '<span class=\"sv137-status-pill bad\">不可用</span>';return '<span class=\"sv137-status-pill\">未知</span>'}\nfunction sv137CountrySource(n){var s=String((n&&n.countrySource)||'').toLowerCase();if(s==='landing')return '<span class=\"sv137-source-badge landing\">落地验证</span>';if(s==='flag'||s==='name')return '<span class=\"sv137-source-badge name\">名称识别</span>';if(s==='geoip')return '<span class=\"sv137-source-badge\">GeoIP</span>';return '<span class=\"sv137-source-badge\">未确认</span>'}\nfunction sv137EntryText(n){var host=(n&&n.entryServer)||((n&&n.extra&&(n.extra.server||n.extra.add))||'')||(n&&n.server)||'';var port=(n&&n.port)||((n&&n.extra&&n.extra.port)||'');if(host&&port)return String(host)+':'+String(port);return host||'--'}\nfunction sv137CleanParts(parts){return (parts||[]).map(function(x){return String(x==null?'':x).trim()}).filter(function(x){return x&&x!=='undefined'&&x!=='null'})}\nfunction sv137ExitParts(n){if(!n||!n.landingIP)return [];var asn=String(n.landingASN||n.geoASN||'').trim();if(asn&&asn.toUpperCase().indexOf('AS')!==0)asn='AS'+asn;return sv137CleanParts([n.landingIP,n.landingCountry||n.country||n.landingCountryCode,n.landingCity||n.geoCity,n.landingISP||n.geoISP,asn])}\nfunction sv137ExitText(n){var p=sv137ExitParts(n);if(p.length)return p.join(' / ');if(n&&n.landingOK===false)return '检测失败';return '未检测'}\nfunction sv137NodeDetail(n){var entry=sv137EntryText(n),exit=sv137ExitText(n),same=false;try{same=!!(n&&n.landingIP&&String(entry).split(':')[0]===String(n.landingIP))}catch(_){}return '<div class=\"sv137-detail\"><div class=\"sv137-detail-grid\"><div class=\"sv137-detail-item\"><div class=\"sv137-detail-label\">入口 IP:端口（连接目标）</div><div class=\"sv137-detail-value\">'+esc(entry)+'</div></div><div class=\"sv137-detail-item\"><div class=\"sv137-detail-label\">出口 IP / 国家 / 城市 / ISP / ASN（落地检测结果）</div><div class=\"sv137-detail-value\">'+esc(exit)+'</div></div></div><div class=\"sv137-detail-note\">'+(same?'入口 IP 与出口 IP 相同。':'入口 IP 和出口 IP 可以不同，这是正常的中转 / 转发结构。')+'</div></div>'}\nfunction sv137SearchText(n){return [n.name,n.server,n.entryServer,n.port,n.country,n.protocol,n.geoCity,n.landingIP,n.landingCountry,n.landingCity,n.landingISP,n.landingASN].map(function(x){return String(x||'')}).join(' ').toLowerCase()}\nfunction sv137AliveSortValue(n,idx){var v=sv137LatencyNumber(n&&n.aliveLatency);if(n&&n.aliveOK===true&&v!=null)return v*100000+idx;if(n&&n.aliveOK===false)return 900000000+idx;return 800000000+idx}\nfunction sv137SortByAlive(arr){return (arr||[]).map(function(n,i){return{n:n,i:i,v:sv137AliveSortValue(n,i)}}).sort(function(a,b){return a.v-b.v}).map(function(x){return x.n})}\nfunction sv137FilteredBase(){if(!DATA)return[];var ns=(sv137ById('unique')&&sv137ById('unique').checked)?uniq(DATA.nodes):DATA.nodes;var q=(sv137ById('q')&&sv137ById('q').value||'').toLowerCase(),pf=(sv137ById('pf')&&sv137ById('pf').value)||'',cf=(sv137ById('cf')&&sv137ById('cf').value)||'',alive=!!(sv137ById('onlyAlive')&&sv137ById('onlyAlive').checked);var out=(ns||[]).filter(function(n){return(!pf||n.protocol==pf)&&(!cf||n.country==cf)&&(!alive||n.aliveOK===true)&&(!q||sv137SearchText(n).indexOf(q)>=0)});return sv137SortByAlive(out)}\nfiltered=sv137FilteredBase;\nfunction sv137Key(a){var q=(sv137ById('q')&&sv137ById('q').value)||'',pf=(sv137ById('pf')&&sv137ById('pf').value)||'',cf=(sv137ById('cf')&&sv137ById('cf').value)||'',alive=(sv137ById('onlyAlive')&&sv137ById('onlyAlive').checked)?'1':'0',u=(sv137ById('unique')&&sv137ById('unique').checked)?'1':'0';return [a.length,q,pf,cf,alive,u].join('|')}\nfunction sv137Row(n,i){var sid=esc(n._sid||''),chk=SELECTED[n._sid]?' checked':'',open=!!sv137DetailOpen[n._sid],mobileMeta=[esc(n.protocol||'--')+' · '+esc(sv137Region(n)),'连通延迟 '+sv137AliveLatency(n).replace(/<[^>]+>/g,'')+' · 落地耗时 '+sv137LandingLatency(n).replace(/<[^>]+>/g,''),'入口 '+esc(sv137EntryText(n))].join('<br>');var main='<tr class=\"sv137-main-row\" data-sid=\"'+sid+'\"><td><input type=\"checkbox\" class=\"rowchk\" data-sid=\"'+sid+'\" onchange=\"window.toggleSelect&&window.toggleSelect(this.dataset.sid,this.checked);window.sv137RefreshCounts&&window.sv137RefreshCounts()\"'+chk+'></td><td><div class=\"sv137-node-name\" title=\"'+esc(n.name)+'\">'+esc(n.name)+'</div><div class=\"sv137-mobile-meta\">'+mobileMeta+'</div></td><td><span class=\"sv137-tag\">'+esc(n.protocol||'--')+'</span></td><td><div class=\"sv137-region\" title=\"'+esc(sv137Region(n))+'\">'+esc(sv137Region(n))+'</div></td><td>'+sv137AliveLatency(n)+'</td><td>'+sv137LandingLatency(n)+'</td><td>'+sv137CountrySource(n)+'</td><td>'+sv137NodeStatus(n)+'</td><td><button type=\"button\" class=\"sv137-actions\" data-sid=\"'+sid+'\" aria-expanded=\"'+(open?'true':'false')+'\" aria-label=\"更多信息\" title=\"查看入口 / 出口信息\" onclick=\"window.sv137ToggleDetail&&window.sv137ToggleDetail(this.dataset.sid)\">•••</button></td></tr>';var detail=open?'<tr class=\"sv137-detail-row\"><td colspan=\"9\">'+sv137NodeDetail(n)+'</td></tr>':'';return main+detail}\nwindow.sv137ToggleDetail=function(sid){if(!sid)return;sv137DetailOpen[sid]=!sv137DetailOpen[sid];apply()};\nfunction sv137Pagination(total){\n  var pages=Math.max(1,Math.ceil(total/SV137_PAGE_SIZE));if(sv137Page>pages)sv137Page=pages;if(sv137Page<1)sv137Page=1;\n  var start=Math.max(1,sv137Page-2),end=Math.min(pages,start+4);start=Math.max(1,end-4);var out='<select id=\"sv137PageSize\" class=\"sv137-page-size\" onchange=\"window.sv137SetPageSize&&window.sv137SetPageSize(this.value)\"><option value=\"20\"'+(SV137_PAGE_SIZE===20?' selected':'')+'>20 条/页</option><option value=\"50\"'+(SV137_PAGE_SIZE===50?' selected':'')+'>50 条/页</option><option value=\"100\"'+(SV137_PAGE_SIZE===100?' selected':'')+'>100 条/页</option></select>';\n  out+='<button type=\"button\" class=\"sv137-page-btn\" onclick=\"window.sv137SetPage&&window.sv137SetPage('+(sv137Page-1)+')\" '+(sv137Page<=1?'disabled':'')+'>‹</button>';\n  for(var i=start;i<=end;i++)out+='<button type=\"button\" class=\"sv137-page-btn '+(i===sv137Page?'active':'')+'\" onclick=\"window.sv137SetPage&&window.sv137SetPage('+i+')\">'+i+'</button>';\n  out+='<button type=\"button\" class=\"sv137-page-btn\" onclick=\"window.sv137SetPage&&window.sv137SetPage('+(sv137Page+1)+')\" '+(sv137Page>=pages?'disabled':'')+'>›</button>';\n  return out;\n}\nwindow.sv137SetPage=function(p){sv137Page=p;apply()};\nwindow.sv137SetPageSize=function(v){SV137_PAGE_SIZE=parseInt(v,10)||20;sv137Page=1;apply()};\nwindow.sv137RefreshCounts=function(){var a=filtered(),sc=selectedCount();var c=sv137ById('count');if(c)c.textContent='已选 '+sc+' / '+((DATA&&DATA.summary&&DATA.summary.total)||0)+' 个节点';var f=sv137ById('sv137TableCount');if(f)f.textContent='已选 '+sc+' / '+a.length+' 个节点';sv137UpdateRestoreState();};\nfunction sv137UpdateRestoreState(){var r=sv137ById('restoreNames');if(!r)return;var can=false;if(DATA&&DATA.nodes){can=DATA.nodes.some(function(n){var old=n.rawName||n.originalName;return old&&old!==n.name})}r.disabled=!can;r.setAttribute('aria-disabled',can?'false':'true');}\nvar sv137BaseApply=apply;\napply=function(){\n  try{\n    sv137EnsureUI();\n    if(!DATA){var tb=sv137ById('tbody');if(tb)tb.innerHTML='<tr><td colspan=\"9\"><div class=\"sv137-empty\">先输入订阅 URL，或展开“粘贴原文”粘贴订阅内容。<br>分析后可筛选、勾选节点，再执行测活、落地检测、清理和导出。</div></td></tr>';sv137RenderHealth([]);sv137RefreshCounts();emit('afterApply',[]);sv137FinalizeLayout();return}\n    var a=filtered(),key=sv137Key(a);if(key!==sv137LastKey){sv137Page=1;sv137LastKey=key}\n    var start=(sv137Page-1)*SV137_PAGE_SIZE,show=a.slice(start,start+SV137_PAGE_SIZE),tb=sv137ById('tbody');\n    if(tb)tb.innerHTML=show.length?show.map(function(n,i){return sv137Row(n,start+i)}).join(''):'<tr><td colspan=\"9\"><div class=\"sv137-empty\">当前筛选无结果。尝试调整筛选条件，或清空“仅可用”筛选。</div></td></tr>';\n    var foot=sv137ById('sv137TableFooter');if(foot)foot.innerHTML='<div id=\"sv137TableCount\">已选 '+selectedCount()+' / '+a.length+' 个节点</div><div class=\"sv137-pagination\">'+sv137Pagination(a.length)+'</div>';\n    var c=sv137ById('count');if(c)c.textContent='已选 '+selectedCount()+' / '+((DATA&&DATA.summary&&DATA.summary.total)||0)+' 个节点';\n    updateSelectUI();sv137UpdateRestoreState();sv137RenderHealth(a);sv137UpdateCharts();emit('afterApply',a);sv137FinalizeLayout();\n  }catch(e){try{sv137BaseApply()}catch(_){}console.log(e)}\n};\nvar sv137BaseRender=render;\nrender=function(d){sv137BaseRender(d);sv137EnsureUI();sv137UpdateCharts();sv137RenderHealth(filtered());sv137FinalizeLayout()};\nfunction sv137AnalyzeSuccess(d,label){if(!d||d.ok===false)throw new Error((d&&d.error)||'分析失败');render(d);st((label||'分析完成')+'：'+((d.summary&&d.summary.total)||((d.nodes||[]).length)||0)+' 个节点','success')}\nfunction analyzeURL(){var u=(sv137ById('url')&&sv137ById('url').value||'').trim();if(!u||!sv137IsURL(u)){sv137SetBusy(false);st('无法解析订阅链接。请检查 URL，或改用粘贴内容分析。','error');return}sv137SetBusy(true);st('正在拉取并分析订阅…','loading');loadJSON('/api/analyze?url='+encodeURIComponent(u)+'&t='+Date.now()).then(function(d){sv137AnalyzeSuccess(d,'分析完成')}).catch(function(e){var m='无法解析订阅链接。';if(sv137HasData())m+=' 当前显示上一次分析结果。';m+=' 请检查 URL，或改用粘贴内容分析。';st(m,'error')}).then(function(){sv137SetBusy(false)})}\nfunction sample(){sv137SetBusy(false);st('正在载入演示数据…','loading');loadJSON('/api/sample?t='+Date.now()).then(function(d){sv137AnalyzeSuccess(d,'演示数据已加载')}).catch(function(e){st('演示数据加载失败：'+(e.message||e),'error')})}\nfunction analyzeText(){var t=(sv137ById('raw')&&sv137ById('raw').value)||'';if(!t.trim()){document.body.classList.add('raw-open');st('请先在“粘贴原文”中粘贴订阅内容。','error');return}st('正在分析粘贴内容…','loading');loadJSON('/api/analyze-text?t='+Date.now(),{method:'POST',body:t,headers:{'Content-Type':'text/plain;charset=utf-8'}}).then(function(d){sv137AnalyzeSuccess(d,'粘贴内容分析完成')}).catch(function(e){var m='无法解析粘贴内容。';if(sv137HasData())m+=' 当前显示上一次分析结果。';m+=' 请检查格式后重试。';st(m,'error')})}\nfunction sv137EnsureUI(){\n  sv137InstallStyle();document.body.classList.add('sv137');document.body.classList.toggle('raw-open',sv137RawOpen);\n  var hero=sv137Q('.hero');if(hero){var h1=sv137Q('h1',hero);if(h1)h1.textContent='订阅节点分析';var p=sv137Q('p',hero);if(p)p.textContent='拉取或粘贴订阅内容，解析节点分布、协议、国家/地区、数量、健康状态，并支持筛选与导出。';var url=sv137ById('url'),pull=sv137ById('pull'),demo=sv137ById('demo'),textBtn=sv137ById('textBtn'),raw=sv137ById('raw');if(pull&&!pull._sv137Icon){pull._sv137Icon=1;pull.innerHTML=sv137BtnIcon('拉取分析','⧉')}if(demo&&!demo._sv137Icon){demo._sv137Icon=1;demo.innerHTML=sv137BtnIcon('演示数据','♙')}if(textBtn&&!textBtn._sv137Icon){textBtn._sv137Icon=1;textBtn.innerHTML=sv137BtnIcon('分析粘贴内容','▣')}var actions=sv137ById('sv137InputActions');if(!actions&&url){actions=document.createElement('div');actions.id='sv137InputActions';actions.className='sv137-input-actions';url.parentNode.insertBefore(actions,url.nextSibling)}if(actions){[pull,demo,textBtn].forEach(function(b){if(b)actions.appendChild(b)})}var toggle=sv137ById('sv137PasteToggle');if(!toggle&&raw){toggle=document.createElement('button');toggle.id='sv137PasteToggle';toggle.type='button';toggle.className='sv137-paste-toggle';toggle.innerHTML='<span>☷ 粘贴原文</span>';actions.parentNode.insertBefore(toggle,actions.nextSibling);toggle.onclick=function(){sv137RawOpen=!sv137RawOpen;document.body.classList.toggle('raw-open',sv137RawOpen)}}var panel=sv137ById('sv137RawPanel');if(!panel&&raw){panel=document.createElement('div');panel.id='sv137RawPanel';panel.className='sv137-raw-panel';raw.parentNode.insertBefore(panel,raw);panel.appendChild(raw)}var stat=sv137ById('status');if(stat&&hero&&stat.parentNode!==hero)hero.appendChild(stat)}\n  sv137EnsureHealthCard();\n  var table=sv137Q('table'),nodeCard=sv137Closest(table,'.card');if(nodeCard){nodeCard.classList.add('sv137-node-card');var nh=sv137Q('h2',nodeCard);if(nh)nh.textContent='节点列表';var thead=sv137Q('thead',table);if(thead)thead.innerHTML='<tr><th><input type=\"checkbox\" class=\"rowchk\" aria-label=\"全选\" onclick=\"if(this.checked){window.selectCurrent&&window.selectCurrent()}else{window.clearSelected&&window.clearSelected()}\"></th><th>节点名</th><th>协议</th><th>地区</th><th>连通延迟 ↓</th><th>落地耗时</th><th>国家识别</th><th>状态</th><th></th></tr>';var controls=sv137ById('sv137TableControls');if(!controls){controls=document.createElement('div');controls.id='sv137TableControls';controls.className='sv137-table-controls';nodeCard.insertBefore(controls,table)}var q=sv137ById('q'),pf=sv137ById('pf'),cf=sv137ById('cf');[q,pf,cf].forEach(function(el){if(el)controls.appendChild(el)});if(!sv137ById('onlyAlive')){var lab=document.createElement('label');lab.className='sv137-toggle';lab.innerHTML='<input type=\"checkbox\" id=\"onlyAlive\"><span class=\"sv137-switch\"></span><span>仅可用</span>';controls.appendChild(lab);var oa=sv137ById('onlyAlive');if(oa){oa.addEventListener('change',apply)}}else{controls.appendChild(sv137Closest(sv137ById('onlyAlive'),'.sv137-toggle'))}if(table&&table.parentNode===nodeCard&&!sv137ById('sv137TableFooter')){var f=document.createElement('div');f.id='sv137TableFooter';f.className='sv137-table-footer';nodeCard.insertBefore(f,table.nextSibling)}var bulk=sv137ById('sv137BulkToolbar');if(!bulk){bulk=document.createElement('div');bulk.id='sv137BulkToolbar';bulk.className='sv137-bulk-toolbar';var ref=sv137ById('sv137TableFooter')||table;nodeCard.insertBefore(bulk,ref.nextSibling)}var ids=['selectCurrent','invertCurrent','clearSelected','__sep1','alive','landing','geo','__sep2','cleanNames','restoreNames'];ids.forEach(function(id){if(id.indexOf('__sep')===0){if(!sv137ById('sv137'+id)){var sep=document.createElement('span');sep.id='sv137'+id;sep.className='sv137-sep';bulk.appendChild(sep)}return}var b=sv137ById(id);if(!b)return;if(id==='restoreNames'){var w=sv137ById('restoreNamesWrap');if(!w){w=document.createElement('span');w.id='restoreNamesWrap';w.className='sv137-tipwrap';w.tabIndex=0;w.setAttribute('data-tip','清理节点名后可用')}bulk.appendChild(w);w.appendChild(b)}else bulk.appendChild(b)});}\n  var exportType=sv137ById('exportType'),copyAlive=sv137ById('copyAliveBtn'),copyBtn=sv137ById('copyBtn'),exportBtn=sv137ById('exportBtn');if(exportBtn)exportBtn.innerHTML=sv137BtnIcon('导出文件','⇩');if(copyBtn)copyBtn.innerHTML=sv137BtnIcon('复制全部','▣');if(copyAlive)copyAlive.innerHTML=sv137BtnIcon('复制可用','▣');var exp=sv137ById('sv137ExportCard');if(!exp&&exportType){exp=document.createElement('section');exp.id='sv137ExportCard';exp.className='sv137-export-card';exp.innerHTML='<div class=\"sv137-export-title\">导出</div><div id=\"sv137ExportRow\" class=\"sv137-export-row\"></div><div class=\"sv137-export-help\">导出包含当前筛选结果的节点，支持 Clash YAML 等格式，便于快速导入使用。</div>';var table2=sv137Q('table');var nc=sv137Closest(table2,'.card');if(nc&&nc.parentNode)nc.parentNode.insertBefore(exp,nc.nextSibling)}var er=sv137ById('sv137ExportRow');if(er){[exportType,copyAlive,copyBtn,exportBtn].forEach(function(el){if(el)er.appendChild(el)})}\n  var adv=sv137ById('sv137AdvancedCard');if(!adv){adv=document.createElement('section');adv.id='sv137AdvancedCard';adv.className='sv137-advanced-card';var ec=sv137ById('sv137ExportCard');if(ec&&ec.parentNode)ec.parentNode.insertBefore(adv,ec.nextSibling)}if(adv){sv137QA('.rulebox').forEach(function(rb){adv.appendChild(rb)});sv137QA('details',adv).forEach(function(d,i){var sum=sv137Q('summary',d);if(!sum||sum._sv137)return;var title=sum.textContent.replace(/设置$/,'设置').replace('节点名清理规则设置','节点名清理规则');var desc=['配置落地检测的方式、目标、超时与重试等参数。','配置测活方式、并发、超时、重试与阈值等参数。','配置清理与替换规则，支持正则/关键词过滤。','配置 Gist Token、文件名与远程订阅发布参数。'][i]||'更多高级选项。';var state=['已配置','已配置','3 条规则','可选'][i]||'可选';sum.innerHTML='<span>'+esc(title)+'</span><span class=\"sv137-acc-desc\">'+esc(desc)+'</span><span class=\"sv137-acc-state\">'+esc(state)+'</span><span class=\"sv137-chevron\">⌄</span>';sum._sv137=1;d.open=false})}\n  sv137UpdateRestoreState();\n}\nfunction sv137FinalizeLayout(){sv137EnsureUI();var restore=sv137ById('restoreNames');if(restore&&!restore._sv137Tip){restore._sv137Tip=1;restore.setAttribute('title','清理节点名后可用')}var stEl=sv137ById('status');if(stEl&&!stEl.classList.contains('sv137-status'))st(sv137LastStatusText||'',sv137State||'idle')}\nvar sv137BaseDOMContentLoaded=function(){sv137EnsureUI();sv137SetBusy(false);['q','pf','cf','unique'].forEach(function(id){var el=sv137ById(id);if(el&&!el._sv137Bound){el._sv137Bound=1;el.addEventListener('input',apply);el.addEventListener('change',apply)}});function bind(id,fn){var el=sv137ById(id);if(el)el.onclick=fn}bind('pull',analyzeURL);bind('demo',sample);bind('textBtn',analyzeText);bind('geo',geoFill);bind('landing',landingTest);bind('alive',function(){window.aliveTest()});bind('cleanNames',window.cleanNames);bind('applyRules',window.cleanNames);bind('restoreNames',window.restoreNames);bind('exportBtn',window.doExport);bind('copyBtn',window.copyExport);bind('copyAliveBtn',window.copyAliveExport);bind('selectCurrent',window.selectCurrent);bind('invertCurrent',window.invertCurrent);bind('clearSelected',window.clearSelected);apply();st('', 'idle')};\nwindow.addEventListener('DOMContentLoaded',sv137BaseDOMContentLoaded);\nhook('afterApply',function(a){sv137RenderHealth(a||filtered());sv137UpdateRestoreState()});\n";
  function html() {
    var tpl = "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\"><title>SubViz</title><meta name=\"theme-color\" content=\"#0F0F11\"><link rel=\"icon\" type=\"image/x-icon\" href=\"{{__FAVICON_URL__}}\"><link rel=\"shortcut icon\" href=\"{{__FAVICON_URL__}}\"><link rel=\"icon\" type=\"image/png\" sizes=\"192x192\" href=\"{{__ICON_192_URL__}}\"><link rel=\"icon\" type=\"image/png\" sizes=\"512x512\" href=\"{{__ICON_512_URL__}}\"><link rel=\"apple-touch-icon\" sizes=\"180x180\" href=\"{{__APPLE_TOUCH_ICON_URL__}}\"><link rel=\"apple-touch-icon-precomposed\" sizes=\"180x180\" href=\"{{__APPLE_TOUCH_ICON_URL__}}\"><link rel=\"manifest\" href=\"{{__WEBMANIFEST_URL__}}\"><meta name=\"apple-mobile-web-app-capable\" content=\"yes\"><meta name=\"apple-mobile-web-app-status-bar-style\" content=\"black-translucent\"><meta name=\"apple-mobile-web-app-title\" content=\"SubViz\"><style>*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top,#123257,#061225 55%,#030914);color:#eaf2ff;font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif}.wrap{max-width:980px;margin:auto;padding:22px 18px 60px}.hero,.card{background:rgba(12,30,58,.78);border:1px solid #23446f;border-radius:24px;padding:22px;margin:18px 0;box-shadow:0 18px 60px rgba(0,0,0,.22)}h1{font-size:30px;margin:0 0 10px}h2{font-size:22px;margin:0 0 16px}.muted{color:#9fb0cc}.row{display:flex;gap:12px;flex-wrap:wrap}input,textarea,select{width:100%;background:#061225;color:#eaf2ff;border:1px solid #2b4e80;border-radius:18px;padding:15px;font-size:16px}textarea{height:120px}button{width:100%;border:0;border-radius:20px;padding:16px;font-size:18px;font-weight:800;color:white;background:linear-gradient(90deg,#2d8cff,#16c6f4);margin-top:12px}.btn2{background:#22334f}.toolbar{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}.selectbar{display:grid;grid-template-columns:1fr repeat(3,.8fr);gap:8px;margin:12px 0;align-items:center}.selectbar span{font-weight:900;color:#d9e8ff}.rowchk{width:22px;height:22px;accent-color:#58a6ff}.toolbar button{margin-top:0}.exportbar{display:grid;grid-template-columns:1.35fr .55fr .55fr;gap:10px;margin-top:12px}.exportbar button{margin-top:0}.rulebox{margin-top:12px;border:1px solid #284773;border-radius:18px;padding:12px;background:rgba(6,18,37,.45)}summary{cursor:pointer;font-weight:800}.rulegrid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}.rulebox textarea{height:92px;font-size:14px}.rulebox input{font-size:14px;padding:12px}.rulebtns{display:grid;grid-template-columns:1fr 1fr;gap:10px}.toolhint{font-size:13px;color:#9fb0cc;margin-top:8px}.sectionline{border-top:1px solid #263f66;margin:14px 0 10px}.status{margin-top:14px;padding:12px;border:1px solid #284773;border-radius:18px;overflow:auto}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}.stat{background:#17263d;border:1px solid #284773;border-radius:20px;padding:18px}.stat b{display:block;font-size:34px;margin-top:6px}.bar{display:grid;grid-template-columns:minmax(64px,112px) minmax(60px,1fr) minmax(48px,auto);align-items:center;gap:10px;margin:10px 0;min-width:0}.bar>div:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bar b{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;font-feature-settings:\"tnum\" 1}.track{height:14px;background:#1f314e;border-radius:20px}.fill{height:14px;background:linear-gradient(90deg,#2d8cff,#16d6e9);border-radius:20px}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border-top:1px solid #263f66;padding:12px 8px;text-align:left;word-break:break-all}th{color:#c7d7f5}.tag{display:inline-block;border:1px solid #38658f;background:#183957;border-radius:999px;padding:5px 10px;font-weight:800}.filters{display:grid;grid-template-columns:1fr 1fr;gap:10px}.small{font-size:13px;color:#9fb0cc}@media(max-width:640px){.grid{grid-template-columns:1fr 1fr}.bar{grid-template-columns:minmax(56px,76px) minmax(48px,1fr) minmax(42px,auto);gap:8px}th:nth-child(5),td:nth-child(5){display:none}.wrap{padding:16px 12px 40px}.toolbar{grid-template-columns:1fr}.selectbar{grid-template-columns:1fr}.exportbar{grid-template-columns:1fr .55fr .55fr}.rulegrid{grid-template-columns:1fr}.rulebtns{grid-template-columns:1fr}}</style>\n</head>\n\n<body>\n<div class=\"wrap\">\n    <div class=\"hero\"><div class=\"small\">Surge Local UI &middot; v{{__VERSION__}}</div><h1>订阅节点可视化分析</h1><p class=\"muted\">拉取或粘贴机场/代理订阅，解析节点分布、协议、国家/地区、数量、重复项，并支持筛选与导出。</p><input id=\"url\" placeholder=\"https://example.com/sub\"><button type=\"button\" id=\"pull\">拉取分析</button><button type=\"button\" id=\"demo\" class=\"btn2\">演示数据</button><textarea id=\"raw\" placeholder=\"或粘贴订阅原文 / Clash YAML\"></textarea><button type=\"button\" id=\"textBtn\" class=\"btn2\">分析粘贴内容</button><div id=\"status\" class=\"status\">准备就绪。</div></div>\n    <div class=\"grid\" id=\"cards\"></div><div class=\"card\"><h2>协议分布</h2><div id=\"protocols\" class=\"muted\">暂无数据</div></div><div class=\"card\"><h2>国家 / 地区分布</h2><div id=\"countries\" class=\"muted\">暂无数据</div></div><div class=\"card\"><h2>节点列表</h2><p id=\"count\" class=\"muted\">暂无数据</p><input id=\"q\" placeholder=\"搜索节点名 / 服务器 / 地区\"><div class=\"filters\"><select id=\"pf\"><option value=\"\">全部协议</option></select><select id=\"cf\"><option value=\"\">全部地区</option></select></div><label style=\"display:flex;gap:8px;align-items:center;margin:12px 0\"><input type=\"checkbox\" id=\"unique\" checked style=\"width:24px;height:24px\"> 仅唯一节点</label><div class=\"selectbar\"><span id=\"selCount\">已选 0 个</span><button type=\"button\" id=\"selectCurrent\" class=\"btn2\" onclick=\"window.selectCurrent&&window.selectCurrent();return false\">全选当前</button><button type=\"button\" id=\"invertCurrent\" class=\"btn2\" onclick=\"window.invertCurrent&&window.invertCurrent();return false\">反选当前</button><button type=\"button\" id=\"clearSelected\" class=\"btn2\" onclick=\"window.clearSelected&&window.clearSelected();return false\">清空选择</button></div><div class=\"toolhint\">批量操作仅处理已勾选节点。可以先筛选，再点“全选当前”。</div><div class=\"toolbar\"><button type=\"button\" id=\"geo\" class=\"btn2\" onclick=\"window.geoFill&&window.geoFill();return false\">快速 GeoIP 补全</button><button type=\"button\" id=\"landing\" class=\"btn2\" onclick=\"window.landingTest&&window.landingTest();return false\">落地检测</button><button type=\"button\" id=\"alive\" class=\"btn2\" onclick=\"window.aliveTest&&window.aliveTest();return false\">测活</button><button type=\"button\" id=\"cleanNames\" class=\"btn2\" onclick=\"window.cleanNames&&window.cleanNames();return false\">按规则清理节点名</button></div><div class=\"toolhint\">落地检测只检测已勾选节点：你可以先筛选“未知”、某个地区或协议，再全选当前。</div><div class=\"rulebox\"><details><summary>落地检测设置</summary><div class=\"rulegrid\"><div><div class=\"small\">并发数（1-10）</div><input id=\"landingCon\" value=\"2\"></div><div><div class=\"small\">超时（毫秒）</div><input id=\"landingTimeout\" value=\"5000\"></div><div><div class=\"small\">重试次数</div><input id=\"landingRetries\" value=\"1\"></div><div><div class=\"small\">命名格式（可选）</div><input id=\"landingFormat\" value=\"\"></div></div><label class=\"small\" style=\"display:flex;gap:8px;align-items:center;margin:10px 0\"><input type=\"checkbox\" id=\"landingInternal\" style=\"width:22px;height:22px\"> 使用内部 GEOIP（需要 Surge/Loon 支持 $utils.geoip，默认只请求出口 IP）</label><div class=\"small\">API 列表（一行一个，留空则使用内置备用：ipwho.is / ip-api / ip.sb / ipinfo / myip）</div><textarea id=\"landingApis\" placeholder=\"https://ipwho.is/?lang=zh-CN\nhttp://ip-api.com/json?lang=zh-CN\"></textarea><div class=\"toolhint\">借鉴 Sub-Store 落地脚本思路：支持自定义 API、超时、并发、重试和内部 GEOIP。</div></details></div><div class=\"rulebox\"><details><summary>节点测活设置</summary><div class=\"rulegrid\"><div><div class=\"small\">检测 URL</div><input id=\"aliveUrl\" value=\"http://connectivitycheck.platform.hicloud.com/generate_204\"></div><div><div class=\"small\">合法状态码</div><input id=\"aliveStatus\" value=\"204\"></div><div><div class=\"small\">并发数</div><input id=\"aliveCon\" value=\"5\"></div><div><div class=\"small\">超时（毫秒）</div><input id=\"aliveTimeout\" value=\"3000\"></div><div><div class=\"small\">重试次数</div><input id=\"aliveRetries\" value=\"1\"></div><div><div class=\"small\">重试间隔（毫秒）</div><input id=\"aliveRetryDelay\" value=\"1000\"></div></div><label class=\"small\" style=\"display:flex;gap:8px;align-items:center;margin:10px 0\"><input type=\"checkbox\" id=\"aliveShowLatency\" style=\"width:22px;height:22px\"> 名称前显示延迟</label><div class=\"toolhint\">测活只检测已勾选节点；可以先按协议、地区或关键词筛选，再全选当前。</div></details></div><div class=\"rulebox\"><details><summary>节点名清理规则设置</summary><div class=\"rulegrid\"><div><div class=\"small\">删除关键词（黑名单，用逗号或换行）</div><textarea id=\"dropWords\">linuxdo, History, OpenRay, Telegram, TG, GitHub, Github, DeltaKroneckerGithub, WangCai, 官网, 官方, 网站, 主页, 频道, 群组, 订阅, 免费, 公益, 剩余, 流量, 到期, 过期, 有效期, 套餐, 重置, expire, expiry, traffic, reset, GB, MB, TB, 域名, 网址</textarea></div><div><div class=\"small\">保留标签（白名单）</div><textarea id=\"keepTags\">倍率, 原生, 机房, 商宽, 家宽, 住宅, 广播, 专线, 中转, 直连, 隧道, IEPL, IPLC, BGP, CN2, CMI, 9929, 4837, 0.2x, 0.5x, 1x, 2x, 3x, 5x, 10x</textarea></div></div><div class=\"small\" style=\"margin-top:10px\">命名模板：可用 {flag} {code} {country} {index} {tags} {name}</div><input id=\"nameTpl\" value=\"{flag} {code}-{country} {index} {tags}\"><div class=\"rulebtns\"><button type=\"button\" id=\"applyRules\" class=\"btn2\" onclick=\"window.cleanNames&&window.cleanNames();return false\">应用规则并重命名</button><button type=\"button\" id=\"restoreNames\" class=\"btn2\" onclick=\"window.restoreNames&&window.restoreNames();return false\">恢复原始名</button></div><div class=\"toolhint\">思路：删除来源词/域名/过期流量信息，提取国家、倍率和线路标签，再按模板强制重构节点名。</div></details></div><div class=\"sectionline\"></div><div class=\"exportbar\"><select id=\"exportType\"><option value=\"clash\">导出 Clash YAML</option><option value=\"uri\">导出 通用 URI 订阅</option><option value=\"uri64\">导出 Base64 URI 订阅</option><option value=\"json\">导出 JSON 备份</option></select><button type=\"button\" id=\"exportBtn\" class=\"btn2\" onclick=\"window.doExport&&window.doExport();return false\">导出</button><button type=\"button\" id=\"copyBtn\" class=\"btn2\" onclick=\"window.copyExport&&window.copyExport();return false\">复制</button></div><div class=\"toolhint\">导出/复制范围：已勾选节点。可以先筛选，再点“全选当前”。</div><div class=\"toolhint\">提示：JSON 备份会包含节点密钥、UUID、密码、SNI、Host、path 等敏感信息，请不要公开分享。</div><table><thead><tr><th style=\"width:46px\">选</th><th style=\"width:48px\">#</th><th>节点名</th><th style=\"width:110px\">协议</th><th>服务器</th><th style=\"width:80px\">端口</th></tr></thead><tbody id=\"tbody\"><tr><td colspan=\"6\" class=\"muted\">暂无数据</td></tr></tbody></table></div></div>\n<script src=\"/app.js?v={{__VERSION__}}\"></script>\n</body></html>";
    return tpl
      .replace(/\{\{__VERSION__\}\}/g, VERSION)
      .replace(/\{\{__FAVICON_URL__\}\}/g, FAVICON_URL)
      .replace(/\{\{__APPLE_TOUCH_ICON_URL__\}\}/g, APPLE_TOUCH_ICON_URL)
      .replace(/\{\{__WEBMANIFEST_URL__\}\}/g, WEBMANIFEST_URL)
      .replace(/\{\{__ICON_192_URL__\}\}/g, ICON_192_URL)
      .replace(/\{\{__ICON_512_URL__\}\}/g, ICON_512_URL)
      .replace(/\{\{__CLIENT_JS__\}\}/g, CLIENT_JS);
  }

  function main() {
    var url = getURL();
    var path = (url.replace(/\?.*$/, '').replace(/^https?:\/\/[^/]+/, '') || '/').replace(/\/$/, '') || '/';
    if (path === '/app.js') return respond(200, CLIENT_JS, { 'Content-Type': 'application/javascript; charset=utf-8' });
    if (path === '/api/health') return respondJSON({ ok: true, name: 'SubViz Surge', version: VERSION, marker: MARKER });
    if (path === '/api/sample') { var r = parseSubscription(sampleText()); r.ok = true; return respondJSON(r); }
    if (path === '/api/geoip') return geoLookup(getQuery(url, 'host') || getQuery(url, 'ip'));
    if (path === '/api/landing') return landingLookup();
    if (path === '/api/availability') return availabilityLookup();
    if (path === '/api/gist-token/status') return gistTokenStatus();
    if (path === '/api/gist-token/save') return gistTokenSave();
    if (path === '/api/gist-token/delete') return gistTokenDelete();
    if (path === '/api/gist-token/test') return gistTokenTest();
    if (path === '/api/gist-upload') return gistUpload();
    if (path === '/api/analyze') return fetchURL(getQuery(url, 'url'));
    if (path === '/api/analyze-text') { try { var rt = parseSubscription(($request && $request.body) || ''); rt.ok = true; return respondJSON(rt); } catch (e) { return respondJSON({ ok:false, error:String(e) }, 500); } }
    return respond(200, html(), { 'Content-Type': 'text/html; charset=utf-8' });
  }
  return { main: main };
})();
SubViz.main();
