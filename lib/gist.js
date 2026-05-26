'use strict';

const store = require('./store');
const { clean, fetchText } = require('./utils');

const TOKEN_KEY = 'subviz.github.token';

function gistTokenLooksValid(token) {
  token = clean(token);
  return /^(ghp_|github_pat_|gho_|ghu_|ghs_|ghr_)[A-Za-z0-9_]+/.test(token) || token.length >= 30;
}

function readStoredGistToken() {
  return store.read(TOKEN_KEY);
}

function writeStoredGistToken(token) {
  return store.write(TOKEN_KEY, clean(token));
}

async function gistTokenStatus() {
  const token = readStoredGistToken();
  return { ok: true, hasToken: !!token, tokenPreview: token ? token.slice(0, 4) + '…' + token.slice(-4) : '' };
}

async function gistTokenSave(token) {
  token = clean(token);
  if (!gistTokenLooksValid(token)) return { ok: false, error: 'Token 格式看起来不正确，请检查后再保存' };
  writeStoredGistToken(token);
  return { ok: true, saved: true, hasToken: true };
}

async function gistTokenDelete() {
  writeStoredGistToken('');
  return { ok: true, deleted: true, hasToken: false };
}

async function gistAPI(method, path, token, bodyObj, options = {}) {
  const headers = {
    'User-Agent': 'SubViz/0.2.0-node',
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = 'Bearer ' + token;
  let body;
  if (bodyObj !== undefined && bodyObj !== null) {
    headers['Content-Type'] = 'application/json; charset=utf-8';
    body = JSON.stringify(bodyObj);
  }
  const resp = await fetchText('https://api.github.com' + path, {
    method,
    headers,
    body,
    timeout: options.timeout || 30000,
  });
  let obj = null;
  try { obj = resp.body ? JSON.parse(resp.body) : null; } catch (_) { obj = { raw: String(resp.body || '').slice(0, 400) }; }
  return { status: resp.status, ok: resp.status >= 200 && resp.status < 300, obj, raw: resp.body };
}

function gistAPIError(status, obj, fallback) {
  const msg = (obj && (obj.message || obj.error)) || fallback || 'GitHub API 请求失败';
  return 'GitHub API HTTP ' + (status || 0) + '：' + msg;
}

function stableRawUrl(raw) {
  return String(raw || '').replace(/\/raw\/[0-9a-f]{6,64}\//i, '/raw/');
}

function gistFindByName(list, name) {
  name = clean(name);
  return (Array.isArray(list) ? list : []).find(item => clean(item && item.description) === name) || null;
}

function finishUpload(status, obj, filename, action) {
  if (status < 200 || status >= 300 || !obj || !obj.files) {
    return { ok: false, error: gistAPIError(status, obj, 'Gist 上传失败'), status, detail: obj || null };
  }
  const f = obj.files && obj.files[filename];
  return {
    ok: true,
    action: action || 'uploaded',
    gistId: obj.id || '',
    url: obj.html_url || '',
    rawUrl: f && f.raw_url ? stableRawUrl(f.raw_url) : '',
    filename,
    description: obj.description || '',
    updatedAt: obj.updated_at || '',
  };
}

async function gistTokenTest(token) {
  token = clean(token) || readStoredGistToken();
  if (!gistTokenLooksValid(token)) return { ok: false, error: '没有可用 Token：请先输入或保存 GitHub Token' };
  const r = await gistAPI('GET', '/gists?per_page=1', token, null);
  if (r.ok) return { ok: true, status: r.status, hasToken: true, message: 'Token 可用，已通过 Gist API 测试' };
  return { ok: false, status: r.status, error: gistAPIError(r.status, r.obj, 'Token 测试失败') };
}

async function gistUpload(payload = {}) {
  const token = clean(payload.token) || readStoredGistToken();
  const gistName = clean(payload.gistName || payload.name || payload.description);
  const filename = clean(payload.filename || payload.file);
  const content = payload.content;
  const gistId = clean(payload.gistId);
  if (!gistTokenLooksValid(token)) return { ok: false, error: '没有可用 Token：请先输入 Token 或保存到本地' };
  if (!gistName && !gistId) return { ok: false, error: '请填写 Gist 名称；为了避免误改已有 Gist，此项必填' };
  if (!filename) return { ok: false, error: '请填写文件名；为了避免误改已有文件，此项必填' };
  if (content === undefined || content === null || String(content).length === 0) return { ok: false, error: '上传内容为空' };

  const files = {};
  files[filename] = { content: String(content) };
  if (gistId) {
    const r = await gistAPI('PATCH', '/gists/' + encodeURIComponent(gistId), token, { description: gistName || undefined, files });
    return finishUpload(r.status, r.obj, filename, 'updated');
  }

  let found = null;
  let all = [];
  for (let page = 1; page <= 3 && !found; page++) {
    const r = await gistAPI('GET', '/gists?per_page=100&page=' + page, token, null);
    if (!r.ok) return { ok: false, error: gistAPIError(r.status, r.obj, '列出 Gist 失败'), status: r.status, detail: r.obj || r.raw };
    const list = Array.isArray(r.obj) ? r.obj : [];
    all = all.concat(list);
    found = gistFindByName(all, gistName);
    if (list.length < 100) break;
  }
  if (found && found.id) {
    const r = await gistAPI('PATCH', '/gists/' + encodeURIComponent(found.id), token, { description: gistName, files });
    return finishUpload(r.status, r.obj, filename, 'updated');
  }
  const r = await gistAPI('POST', '/gists', token, { description: gistName, public: !!payload.public, files });
  return finishUpload(r.status, r.obj, filename, 'created');
}

module.exports = {
  TOKEN_KEY,
  gistTokenLooksValid,
  readStoredGistToken,
  writeStoredGistToken,
  gistTokenStatus,
  gistTokenSave,
  gistTokenDelete,
  gistTokenTest,
  gistUpload,
};
