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
