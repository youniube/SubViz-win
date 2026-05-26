  function html() {
    var tpl = '%%INDEX_HTML%%';
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
