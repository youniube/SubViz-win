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
