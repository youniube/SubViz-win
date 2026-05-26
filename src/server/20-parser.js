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
