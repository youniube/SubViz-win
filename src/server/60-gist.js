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
