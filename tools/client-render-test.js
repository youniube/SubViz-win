#!/usr/bin/env node
'use strict';

/**
 * 真实运行时回归测试：在 vm 沙盒里加载 *完整* 的 src/client/app.js，
 * 模拟浏览器调用 render(data)，并直接调用 sv136 系列函数与 Gist upload
 * 表达式，确保不再出现 ReferenceError。
 *
 * 历史背景：sv135/sv136 增强块都把 apply 重写成
 *   apply = function(){ try{ ... } catch(e){ try{_baseApply()}catch(_){} console.log(e) } };
 * 这会把 ReferenceError 静默吞掉，仅通过 console.log 暴露出来。
 * 因此本测试会拦截 console.log，看见 'ReferenceError' 直接判失败。
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const clientPath = path.join(ROOT, 'src', 'client', 'app.js');
const code = fs.readFileSync(clientPath, 'utf8');

// ---- 0) UI 回归：截图反馈的冗余元素不能再出现 ----
assert(!code.includes('一键复制干净配置'), 'top quick copy button should not be rendered');
assert(!code.includes('sv136CopyAliveQuick'), 'top copy alive quick button should not be rendered');
assert(!/sv136AddTitle\('sv136(Select|Action|Advanced|Export)Title'/.test(code),
  'sv136 must not add duplicate section titles already added by sv135');
assert(/summary:before\{content:"▸"/.test(code),
  'details summary disclosure marker should stay visible');

const htmlPath = path.join(ROOT, 'src', 'server', 'index.html');
const htmlTemplate = fs.readFileSync(htmlPath, 'utf8');
assert(!/<html[\s\S]*?'\+\s*\n\s*'<style>/.test(htmlTemplate),
  'HTML template must not leak JS string concatenation fragments before <style>');
assert(!/<div class="wrap">\s*\n'\+\s*\n\s*'<div class="hero">/.test(htmlTemplate),
  'HTML template must not leak JS string concatenation fragments inside body');
assert(!/<\/html>\s*\n'\+/.test(htmlTemplate),
  'HTML template must not leak trailing concatenation fragments');

// ---- 0.1) 统计卡片对齐回归：数量 / 百分比必须拆列且使用等宽数字 ----
assert(code.includes('sv137-dist-count') && code.includes('sv137-dist-percent'),
  'distribution rows must render count and percent as separate cells');
assert(/grid-template-columns:minmax\(64px,92px\) minmax\(52px,1fr\) 44px 56px/.test(code),
  'distribution rows must use fixed 4-column grid');
assert(/font-variant-numeric:tabular-nums/.test(code) && /font-feature-settings:"tnum" 1/.test(code),
  'numeric cells must use tabular numbers');
assert(/@media\(max-width:720px\)[\s\S]*sv135-chart-grid\{grid-template-columns:1fr!important;overflow-x:visible!important/.test(code),
  'mobile chart cards should stack without horizontal overflow');
assert(/#sv135Health \.health-cell\{[\s\S]*grid-template-rows:minmax\(16px,auto\) minmax\(24px,1fr\) minmax\(15px,auto\)/.test(code),
  'health cells must reserve stable label / number / percent rows');

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

// 拦截 console.log 输出，捕获被静默吞掉的 ReferenceError / TypeError
const swallowedErrors = [];
function trackingLog() {
  for (let i = 0; i < arguments.length; i++) {
    const arg = arguments[i];
    if (arg && typeof arg === 'object' && arg.name && /Error$/.test(arg.name)) {
      swallowedErrors.push(arg.name + ': ' + arg.message);
    } else if (typeof arg === 'string' && /\b(ReferenceError|TypeError|SyntaxError)\b/.test(arg)) {
      swallowedErrors.push(arg);
    }
  }
}

// ---- 最小 DOM 桩 ----
function hasClass(el, cls) {
  return (String(el.className || '').split(/\s+/).filter(Boolean).indexOf(cls) >= 0);
}
function matchesSimple(el, sel) {
  if (!el || !sel) return false;
  if (sel[0] === '.') return hasClass(el, sel.slice(1));
  if (sel[0] === '#') return el.id === sel.slice(1);
  return String(el.tagName || '').toLowerCase() === sel.toLowerCase();
}
function walkChildren(el, fn) {
  (el.children || []).forEach(function (child) {
    fn(child);
    walkChildren(child, fn);
  });
}
function makeEl(tag) {
  const el = {
    tagName: tag || 'div',
    id: '',
    className: '',
    children: [],
    parentNode: null,
    style: {},
    dataset: {},
    value: '',
    textContent: '',
    innerHTML: '',
    checked: false,
    attributes: {},
    _listeners: {},
    classList: {
      add() { for (const name of arguments) if (!hasClass(el, name)) el.className = (el.className ? el.className + ' ' : '') + name; },
      remove() { const drop = Array.prototype.slice.call(arguments); el.className = String(el.className || '').split(/\s+/).filter(Boolean).filter((x) => drop.indexOf(x) < 0).join(' '); },
      contains(name) { return hasClass(el, name); },
      toggle(name, force) { const on = force === undefined ? !hasClass(el, name) : !!force; if (on) this.add(name); else this.remove(name); return on; }
    },
    setAttribute(k, v) { this.attributes[k] = v; if (k === 'class') this.className = String(v || ''); if (k === 'id') this.id = String(v || ''); },
    getAttribute(k) { return this.attributes[k]; },
    addEventListener(ev, fn) { (this._listeners[ev] = this._listeners[ev] || []).push(fn); },
    removeEventListener() {},
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
    insertBefore(c, ref) { c.parentNode = this; const i = ref ? this.children.indexOf(ref) : -1; if (i >= 0) this.children.splice(i, 0, c); else this.children.push(c); return c; },
    closest(sel) { let cur = this; while (cur) { if (matchesSimple(cur, sel)) return cur; cur = cur.parentNode; } return null; },
    remove() {},
    click() { if (typeof this.onclick === 'function') return this.onclick({ target: this }); },
    querySelector(sel) { let out = null; walkChildren(this, function (child) { if (!out && matchesSimple(child, sel)) out = child; }); return out; },
    querySelectorAll(sel) { const out = []; walkChildren(this, function (child) { if (matchesSimple(child, sel)) out.push(child); }); return out; },
    select() {}, setSelectionRange() {}
  };
  return el;
}

const els = {};
const doc = {
  body: makeEl('body'),
  head: makeEl('head'),
  createElement(t) { return makeEl(t); },
  createTextNode(t) { return { nodeValue: t }; },
  getElementById(id) {
    if (!els[id]) els[id] = makeEl('?');
    els[id].id = id;
    return els[id];
  },
  querySelector(sel) { return this.body.querySelector(sel); },
  querySelectorAll(sel) { return this.body.querySelectorAll(sel); },
  addEventListener() {}
};

const win = { addEventListener() {}, location: { href: 'http://subviz.store/' } };

// 假 fetch，避免 loadJSON 真实联网
const fetchCalls = [];
function fakeFetch(url, opts) {
  fetchCalls.push({ url: String(url), opts: opts || {} });
  return Promise.resolve({
    ok: true,
    json() { return Promise.resolve({ ok: true, action: 'created', rawUrl: 'https://raw.example/r' }); },
    text() { return Promise.resolve('{"ok":true,"action":"created","rawUrl":"https://raw.example/r"}'); }
  });
}

const sandbox = {
  window: win,
  document: doc,
  console: { log: trackingLog, warn: trackingLog, error: trackingLog, info: trackingLog },
  setTimeout, clearTimeout,
  navigator: {},
  location: { href: 'http://subviz.store/' },
  fetch: fakeFetch,
  URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} },
  Blob: function () {},
  btoa(s) { return Buffer.from(String(s), 'binary').toString('base64'); },
  atob(s) { return Buffer.from(String(s), 'base64').toString('binary'); },
  encodeURIComponent, decodeURIComponent, escape, unescape,
  JSON, Date, Math, Object, Array, String, Number, Boolean, RegExp, Error, Promise,
  Symbol, Set, Map, parseInt, parseFloat, isNaN, isFinite
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'src/client/app.js', timeout: 2000 });

// ---- 1) 关键标识符必须存在（防止再有 sv13X 命名漏改）----
[
  'render', 'apply', 'analyzeURL', 'analyzeText',
  'sv132ById', 'sv133ById', 'sv135ById', 'sv136ById',
  'sv136EnsureDashboard', 'sv136UpdateHealth', 'sv136Refine', 'sv136InstallAutoParse',
  'SV136_PAGE_SIZE', 'sv136ViewLimit', 'sv136LastKey',
  'gistChecked', 'gistById', 'gistVal', 'buildExportPayload'
].forEach(function (name) {
  const t = vm.runInContext('typeof ' + name, sandbox);
  assert(t !== 'undefined', 'expected identifier `' + name + '` to be defined, got typeof ' + t);
});

// ---- 2) render() 真实调用链不抛 / 不静默吞 ReferenceError ----
const data = {
  ok: true,
  nodes: [
    { name: 'JP1', protocol: 'vmess', server: 'jp.example.com', port: '443',
      countryCode: 'JP', country: '日本', network: 'tcp', tls: 'true',
      fingerprint: 'a', extra: { type: 'vmess', uuid: '11111111-1111-1111-1111-111111111111', alterId: 0, cipher: 'auto' } },
    { name: 'US1', protocol: 'trojan', server: 'us.example.com', port: '443',
      countryCode: 'US', country: '美国', network: 'tcp', tls: 'true',
      fingerprint: 'b', extra: { type: 'trojan', password: 'demo' } }
  ],
  summary: { total: 2, unique: 2, duplicates: 0, protocols: 2, countries: 2 },
  stats: {
    byProtocol: [{ key: 'vmess', count: 1 }, { key: 'trojan', count: 1 }],
    byCountry: [{ key: '日本', count: 1 }, { key: '美国', count: 1 }],
    byCountryCode: [{ key: 'JP', count: 1 }, { key: 'US', count: 1 }],
    bySourceFormat: [{ key: 'clash', count: 2 }]
  },
  meta: { version: '0.1.45' }
};

['cards', 'protocols', 'countries', 'tbody', 'count', 'status', 'pf', 'cf',
 'exportType', 'gistName', 'gistFilename', 'gistId', 'gistToken', 'gistPublic',
 'gistUpload', 'gistRawUrl', 'gistPageUrl', 'gistTokenStatus', 'url', 'raw'].forEach(function (id) {
  doc.getElementById(id);
});

// 模拟 index.html 中统计卡片的外层标题，防止增强渲染把标题再塞进内容区导致重复。
const protocolCard = makeEl('div');
protocolCard.classList.add('card');
const protocolTitle = makeEl('h2');
protocolTitle.textContent = '协议分布';
protocolCard.appendChild(protocolTitle);
protocolCard.appendChild(els.protocols);
doc.body.appendChild(protocolCard);
const countryCard = makeEl('div');
countryCard.classList.add('card');
const countryTitle = makeEl('h2');
countryTitle.textContent = '国家 / 地区分布';
countryCard.appendChild(countryTitle);
countryCard.appendChild(els.countries);
doc.body.appendChild(countryCard);

vm.runInContext('render(' + JSON.stringify(data) + ');', sandbox);
assert(swallowedErrors.length === 0,
  'render() leaked errors via console.log: ' + JSON.stringify(swallowedErrors));

assert((els.cards.innerHTML || '').length > 0, 'render did not populate #cards');
assert((els.tbody.innerHTML || '').length > 0, 'render did not populate #tbody');
assert((els.protocols.innerHTML || '').length > 0, 'render did not populate #protocols');
const distSample = vm.runInContext('sv137Bars([{key:"未知",count:246},{key:"越南超长地区名称测试",count:171},{key:"美国",count:41},{key:"英国",count:24}],616,4)', sandbox);
assert(/sv137-dist-name/.test(distSample) && /sv137-dist-track/.test(distSample),
  'distribution sample should include name and track cells');
assert((distSample.match(/sv137-dist-count/g) || []).length === 4,
  'distribution sample should render one fixed count cell per row');
assert((distSample.match(/sv137-dist-percent/g) || []).length === 4,
  'distribution sample should render one fixed percent cell per row');
assert(!/>246 \(39\.9%\)</.test(distSample),
  'distribution sample must not combine count and percent in a single text node');
function countNeedle(haystack, needle) { return (String(haystack || '').match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length; }
function countBars(html) { return (String(html || '').match(/class="bar(?:\s|")/g) || []).length; }
assert(countNeedle((protocolTitle.innerHTML || protocolTitle.textContent || '') + (els.protocols.innerHTML || ''), '协议分布') === 1,
  'protocol chart title should appear exactly once after render');
assert(countNeedle((countryTitle.innerHTML || countryTitle.textContent || '') + (els.countries.innerHTML || ''), '国家 / 地区分布') === 1,
  'country chart title should appear exactly once after render');

// ---- 3) sv136 dashboard 系列直调不抛 ----
vm.runInContext('sv136EnsureDashboard(); sv136UpdateHealth(filtered()); sv136Refine();', sandbox);
assert(swallowedErrors.length === 0,
  'sv136 dashboard helpers leaked errors: ' + JSON.stringify(swallowedErrors));

// ---- 4) Gist 上传 payload 构造（之前 Bug 2 的核心场景） ----
// 全选当前节点，让 buildExportPayload 不报"未选"
vm.runInContext('if (typeof selectCurrent === "function") selectCurrent();', sandbox);

doc.getElementById('gistName').value = 'my-subs';
doc.getElementById('gistFilename').value = 'subs.yaml';
doc.getElementById('gistToken').value = 'ghp_dummy';
doc.getElementById('exportType').value = 'clash';
doc.getElementById('gistPublic').checked = false;

// 关键：从源码里直接抽出 gistUpload.onclick 的 fetch payload 表达式来跑。
// 这样如果有人把 gistChecked 改回不存在的 checked，测试一定能抓住。
// 匹配片段：gistPost('/api/gist-upload', { ...这段... })
const uploadPayloadMatch = code.match(/gistPost\('\/api\/gist-upload',\s*(\{[\s\S]*?\})\)/);
assert(uploadPayloadMatch, 'unable to locate gistUpload payload literal in app.js');
const payloadLiteral = uploadPayloadMatch[1];

// 模拟 onclick 内部已定义的局部变量
const payload = vm.runInContext([
  '(function(){',
  '  var p = buildExportPayload();',
  '  var name = gistVal("gistName");',
  '  var filename = gistVal("gistFilename") || gistDefaultFile();',
  '  var cfg = (typeof getGistSettings === "function") ? getGistSettings() : { token:gistVal("gistToken"), gistName:name, filename:filename, gistId:gistVal("gistId"), public:gistChecked("gistPublic"), format:gistById("exportType") ? gistById("exportType").value : "clash" };',
  '  var raw = ' + payloadLiteral + ';',
  '  return {',
  '    token: raw.token,',
  '    gistName: raw.gistName,',
  '    filename: raw.filename,',
  '    gistId: raw.gistId,',
  '    public: raw.public,',
  '    format: raw.format,',
  '    contentLen: (raw.content || "").length,',
  '    label: p.label,',
  '    count: p.count',
  '  };',
  '})()'
].join('\n'), sandbox);

assert(payload.token === 'ghp_dummy', 'gist payload token wrong');
assert(payload.gistName === 'my-subs', 'gist payload name wrong');
assert(payload.filename === 'subs.yaml', 'gist payload filename wrong');
assert(payload.format === 'clash', 'gist payload format wrong');
assert(payload.public === false, 'gist payload public should be false when checkbox unchecked');
assert(payload.contentLen > 0, 'gist payload content empty');
assert(payload.count === 2, 'gist payload count mismatch');

// 勾选后应为 true
doc.getElementById('gistPublic').checked = true;
const payloadChecked = vm.runInContext([
  '(function(){',
  '  var p = buildExportPayload();',
  '  var name = gistVal("gistName");',
  '  var filename = gistVal("gistFilename") || gistDefaultFile();',
  '  var cfg = (typeof getGistSettings === "function") ? getGistSettings() : { token:gistVal("gistToken"), gistName:name, filename:filename, gistId:gistVal("gistId"), public:gistChecked("gistPublic"), format:gistById("exportType") ? gistById("exportType").value : "clash" };',
  '  return (' + payloadLiteral + ').public;',
  '})()'
].join('\n'), sandbox);
assert(payloadChecked === true, 'gistChecked should return true when checkbox checked');

// ---- 5) 统计卡片展开入口必须有可见效果，且移动端可点击元素用 button ----
const chartData = { ok: true, nodes: [] };
for (let i = 0; i < 7; i++) {
  chartData.nodes.push({
    name: 'N' + i,
    protocol: 'proto' + i,
    server: 's' + i + '.example.com',
    port: String(1000 + i),
    countryCode: 'C' + i,
    country: '地区' + i,
    fingerprint: 'fp' + i,
    extra: { type: 'demo' }
  });
}
vm.runInContext('render(' + JSON.stringify(chartData) + ');', sandbox);
assert(countNeedle((protocolTitle.innerHTML || protocolTitle.textContent || '') + (els.protocols.innerHTML || ''), '协议分布') === 1,
  'protocol chart title should not duplicate after populated render');
assert(countNeedle((countryTitle.innerHTML || countryTitle.textContent || '') + (els.countries.innerHTML || ''), '国家 / 地区分布') === 1,
  'country chart title should not duplicate after populated render');
assert(/<button[^>]+class="sv137-link"/.test(els.protocols.innerHTML) && /查看全部协议/.test(els.protocols.innerHTML),
  'protocol chart should render a clickable button when there are hidden rows');
assert(/<button[^>]+class="sv137-link"/.test(els.countries.innerHTML) && /查看全部地区/.test(els.countries.innerHTML),
  'country chart should render a clickable button when there are hidden rows');
const protocolBarsBefore = countBars(els.protocols.innerHTML);
vm.runInContext('window.sv137ToggleChart("protocols");', sandbox);
assert(countBars(els.protocols.innerHTML) > protocolBarsBefore && /收起协议/.test(els.protocols.innerHTML),
  'clicking 查看全部协议 should expand the full protocol list visibly');
const countryBarsBefore = countBars(els.countries.innerHTML);
vm.runInContext('window.sv137ToggleChart("countries");', sandbox);
assert(countBars(els.countries.innerHTML) > countryBarsBefore && /收起地区/.test(els.countries.innerHTML),
  'clicking 查看全部地区 should expand the full country list visibly');

// ---- 5.1) 健康卡片在不同总数下都保持结构稳定 ----
[0, 6, 69, 616, 1001].forEach(function (total) {
  const expr = 'sv137RenderHealth(Array.from({length:' + total + '}, function(_, i){ return i % 3 === 0 ? {aliveOK:true} : (i % 3 === 1 ? {aliveOK:false} : {}); }))';
  vm.runInContext(expr, sandbox);
  const healthHtml = els.sv135Health.innerHTML || '';
  assert(countNeedle(healthHtml, 'health-cell') === 4,
    'health card should keep four status cells for total ' + total);
  assert(/<small>/.test(healthHtml),
    'health card should render fixed percent rows for total ' + total);
});

// ---- 6) Token 测试成功状态必须写入 input.value，而不是只改 textContent ----
els.gistTokenStatus.value = '读取中…';
vm.runInContext('gistSetTokenStatus(true,"Token 有效，但尚未保存","valid");', sandbox);
assert(els.gistTokenStatus.value === 'Token 有效，但尚未保存',
  'gist token status input value should update after successful token test');
assert(/gistSetTokenStatus\(true,tokenInput\?/.test(code),
  'gist token test success path should synchronize the token status field');

// ---- 5) 二次 render（模拟用户连点两次分析）也不应漏错 ----
vm.runInContext('render(' + JSON.stringify(data) + ');', sandbox);
assert(swallowedErrors.length === 0,
  'second render() leaked errors: ' + JSON.stringify(swallowedErrors));

console.log = function () {}; // 别污染测试结果输出
process.stdout.write('SubViz client render tests passed.\n');
