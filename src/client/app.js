var DATA=null;
var GEO_CACHE={};
var GEO_RUNNING=false;
var SELECTED={};
/* ── Consolidated style entry point ── */
function installStyles(){
  sv132EnsureStyle();
  sv133InstallStyle();
  sv135InstallStyle();
}

/* ── Event bus for plugin hooks ── */
var _hooks={};
function hook(event,fn){if(!_hooks[event])_hooks[event]=[];_hooks[event].push(fn)}
function emit(event){var a=[].slice.call(arguments,1);(_hooks[event]||[]).forEach(function(fn){try{fn.apply(null,a)}catch(e){console.error('[hook:'+event+']',e)}})}
function selectedCount(){return Object.keys(SELECTED).filter(function(k){return SELECTED[k]}).length}
function selectedNodes(){if(!DATA)return[];return (DATA.nodes||[]).filter(function(n){return n&&n._sid&&SELECTED[n._sid]})}
function operationNodes(action){var a=selectedNodes();if(!a.length){st('请先勾选要'+action+'的节点，或点击“全选当前”。');return []}return a}
function updateSelectUI(){var c=selectedCount();var el=$('selCount');if(el)el.textContent='已选 '+c+' 个'}
function toggleSelect(sid,checked){if(!sid)return;if(checked)SELECTED[sid]=1;else delete SELECTED[sid];updateSelectUI()}
function selectCurrent(){var a=filtered();a.forEach(function(n){if(n._sid)SELECTED[n._sid]=1});apply();st('已全选当前筛选结果：'+a.length+' 个节点')}
function invertCurrent(){filtered().forEach(function(n){if(!n._sid)return;if(SELECTED[n._sid])delete SELECTED[n._sid];else SELECTED[n._sid]=1});apply();st('已反选当前筛选结果')}
function clearSelected(){SELECTED={};apply();st('已清空选择')}
function $(id){return document.getElementById(id)}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c})}
function st(s){$('status').textContent=s}
function zhErr(s){s=String(s||'');var raw=s;var lower=s.toLowerCase();if(!s)return '';if(s.indexOf('不支持该协议')>=0||lower.indexOf('unsupported protocol')>=0)return '不支持该协议进行落地检测';if(s.indexOf('落地查询失败')>=0||lower.indexOf('landing lookup failed')>=0)return '落地查询失败：所有备用接口或临时代理尝试均失败';if(lower.indexOf('timeout')>=0||s.indexOf('超时')>=0)return '请求超时：节点不可用、速度过慢，或查询接口被阻断';if(lower.indexOf('websocket closed')>=0)return 'WebSocket 被服务端关闭：通常是 Host/SNI/path 不匹配，或 CDN/服务端拒绝握手';if(lower.indexOf('ss missing cipher')>=0||s.indexOf('SS 节点缺少')>=0)return 'SS 节点缺少加密方式或密码：多半是解析没有识别 cipher/password';if(lower.indexOf('policy descriptor')>=0)return 'Surge 临时代理策略创建失败：该节点参数可能不兼容';if(lower.indexOf('http 403')>=0)return '查询接口返回 403：接口拒绝访问，或该节点出口被限制';var m=s.match(/HTTP\s*(\d+)/i);if(m)return '查询接口返回 HTTP '+m[1];if(s.indexOf('节点数据不是有效 JSON')>=0||lower.indexOf('invalid node json')>=0)return '节点数据格式异常';if(s.indexOf('内部 GEOIP')>=0||lower.indexOf('internal geoip')>=0)return '内部 GEOIP 查询失败：当前 Surge 可能不支持 $utils.geoip 或没有 GEOIP 数据库';if(s.indexOf('查询接口返回内容解析失败')>=0||lower.indexOf('parse failed')>=0)return '查询接口返回内容解析失败';if(lower==='failed')return '检测失败';return raw}
function bar(it,max){return '<div class="bar"><div>'+esc(it.key)+'</div><div class="track"><div class="fill" style="width:'+(max?Math.round(it.count/max*100):0)+'%"></div></div><b>'+it.count+'</b></div>'}
function uniq(nodes){var m={},a=[];(nodes||[]).forEach(function(n){var k=n.fingerprint||[n.protocol,n.server,n.port,n.network,n.tls].join('|').toLowerCase();if(!m[k]){m[k]=1;a.push(n)}});return a}
function addCount(m,k){k=k||'未知';m[k]=(m[k]||0)+1}
function toArr(m){return Object.keys(m).map(function(k){return{key:k,count:m[k]}}).sort(function(a,b){return b.count-a.count})}
function recalc(d){var ns=d.nodes||[],byP={},byC={},byCC={},byF={},seen={},dups=0;ns.forEach(function(n){addCount(byP,n.protocol);addCount(byC,n.country);addCount(byCC,n.countryCode||'UN');addCount(byF,n.sourceFormat||'unknown');var fp=n.fingerprint||[n.protocol,n.server,n.port,n.network,n.tls].join('|').toLowerCase();if(seen[fp])dups++;else seen[fp]=1});d.summary={total:ns.length,unique:Object.keys(seen).length,duplicates:dups,protocols:Object.keys(byP).length,countries:Object.keys(byC).length};d.stats={byProtocol:toArr(byP),byCountry:toArr(byC),byCountryCode:toArr(byCC),bySourceFormat:toArr(byF)};return d}
function render(d){var isNew=(d!==DATA);if(isNew)SELECTED={};(d.nodes||[]).forEach(function(n,i){if(!n._sid)n._sid='sv_'+i;if(!n.originalName)n.originalName=n.name});DATA=recalc(d);var s=DATA.summary||{};var labels=['总节点','唯一节点','重复节点','协议数','国家/地区'];var vals=[s.total,s.unique,s.duplicates,s.protocols,s.countries];$('cards').innerHTML=labels.map(function(l,i){return '<div class="stat"><span class="muted">'+l+'</span><b>'+(vals[i]||0)+'</b></div>'}).join('');var p=DATA.stats.byProtocol||[],c=DATA.stats.byCountry||[];$('protocols').innerHTML=p.length?p.map(function(x){return bar(x,p[0].count)}).join(''):'暂无数据';$('countries').innerHTML=c.length?c.slice(0,30).map(function(x){return bar(x,c[0].count)}).join(''):'暂无数据';fillSelect('pf',p);fillSelect('cf',c);apply();emit('afterRender',DATA)}
function fillSelect(id,arr){var old=$(id).value;$(id).innerHTML='<option value="">'+(id=='pf'?'全部协议':'全部地区')+'</option>'+(arr||[]).map(function(x){return '<option value="'+esc(x.key)+'">'+esc(x.key)+' ('+x.count+')</option>'}).join('');$(id).value=old}
function filtered(){if(!DATA)return[];var ns=$('unique').checked?uniq(DATA.nodes):DATA.nodes;var q=$('q').value.toLowerCase(),pf=$('pf').value,cf=$('cf').value;return ns.filter(function(n){return(!pf||n.protocol==pf)&&(!cf||n.country==cf)&&(!q||(String(n.name)+String(n.server)+String(n.country)+String(n.protocol)+String(n.port)).toLowerCase().indexOf(q)>=0)})}
function meta(n){var a=[];if(n.country)a.push(esc(n.country));if(n.network)a.push(esc(n.network));if(String(n.tls)==='true')a.push('TLS');if(n.geoCity)a.push(esc(n.geoCity));if(n.aliveOK===true)a.push('可用 '+esc(String(n.aliveLatency))+'ms');else if(n.aliveOK===false)a.push('不可用:'+esc(aliveErr(n.aliveError)));if(n.landingError)a.push('失败:'+esc(zhErr(n.landingError)));return a.join(' \u00b7 ')}
function apply(){var a=filtered(),sc=selectedCount();$('count').textContent='当前显示 '+a.length+' / '+((DATA&&DATA.summary&&DATA.summary.total)||0)+' 个节点，已选 '+sc+' 个';updateSelectUI();$('tbody').innerHTML=a.map(function(n,i){var chk=SELECTED[n._sid]?' checked':'';return '<tr><td><input type="checkbox" class="rowchk" data-sid="'+esc(n._sid||'')+'" onchange="window.toggleSelect&&window.toggleSelect(this.dataset.sid,this.checked)"'+chk+'></td><td>'+(i+1)+'</td><td>'+esc(n.name)+'<div class="small">'+meta(n)+'</div></td><td><span class="tag">'+esc(n.protocol)+'</span></td><td>'+esc(n.server)+'</td><td>'+esc(n.port)+'</td></tr>'}).join('')||'<tr><td colspan="6" class="muted">暂无数据</td></tr>';emit('afterApply',a)}
function loadJSON(url,opt){return fetch(url,opt).then(function(r){return r.text().then(function(t){return{status:r.status,ok:r.ok,text:t}})}).then(function(o){try{var j=JSON.parse(o.text);return j}catch(e){throw new Error(!o.ok?'HTTP '+o.status+': '+o.text.slice(0,150):(o.text.slice(0,200)||String(e)))}})}
function analyzeURL(){var u=$('url').value.trim();if(!u){st('请先输入订阅 URL');return}st('按钮已触发，正在拉取分析…');loadJSON('/api/analyze?url='+encodeURIComponent(u)+'&t='+Date.now()).then(function(d){if(!d.ok)throw new Error(d.error||'error');render(d);st('分析完成：'+d.summary.total+' 个节点')}).catch(function(e){st('失败：'+e.message)})}
function sample(){st('正在载入演示数据…');loadJSON('/api/sample?t='+Date.now()).then(render).then(function(){st('演示数据已加载')}).catch(function(e){st('失败：'+e.message)})}
function analyzeText(){var t=$('raw').value;if(!t.trim()){st('请先粘贴订阅内容');return}st('正在分析粘贴内容…');loadJSON('/api/analyze-text?t='+Date.now(),{method:'POST',body:t,headers:{'Content-Type':'text/plain;charset=utf-8'}}).then(function(d){if(!d.ok)throw new Error(d.error||'error');render(d);st('分析完成：'+d.summary.total+' 个节点')}).catch(function(e){st('失败：'+e.message)})}
function flag(cc){cc=String(cc||'').toUpperCase();if(cc==='CDN')return '\uD83D\uDD00';if(!/^[A-Z]{2}$/.test(cc))return '\uD83C\uDFC1';return cc.replace(/./g,function(ch){return String.fromCodePoint(127397+ch.charCodeAt(0))})}
function suffix(n,i){var nm=String(n.name||'');var m=nm.match(/[-_ ]([A-Fa-f0-9]{4,10})\b/);if(m)return m[1].toUpperCase();var base=String(n.server||'')+':'+String(n.port||'')+':'+i;var h=0;for(var x=0;x<base.length;x++){h=((h<<5)-h)+base.charCodeAt(x);h|=0}return ('00000000'+(h>>>0).toString(16).toUpperCase()).slice(-8)}
function isUnknown(n){return !n.countryCode||n.countryCode==='UN'||n.country==='未知'||n.countrySource==='none'}
function applyGeoToServer(server,geo){(DATA.nodes||[]).forEach(function(n,idx){if(n.server!==server||!isUnknown(n)||!geo||!geo.countryCode)return;n.countryCode=geo.countryCode;n.country=geo.country||n.country;n.countrySource='geoip';n.countryConfidence=geo.countryConfidence||78;n.geoProvider=geo.provider;n.geoQuery=geo.query;n.geoCity=geo.city||'';n.geoRegion=geo.region||'';n.geoISP=geo.isp||'';n.geoASN=geo.asn||'';n.name=flag(n.countryCode)+' '+n.country+'-'+suffix(n,idx)})}
function applyGeoToTargets(server,geo,targets){(targets||[]).forEach(function(n,idx){if(n.server!==server||!isUnknown(n)||!geo||!geo.countryCode)return;n.countryCode=geo.countryCode;n.country=geo.country||n.country;n.countrySource='geoip';n.countryConfidence=geo.countryConfidence||78;n.geoProvider=geo.provider;n.geoQuery=geo.query;n.geoCity=geo.city||'';n.geoRegion=geo.region||'';n.geoISP=geo.isp||'';n.geoASN=geo.asn||'';n.name=flag(n.countryCode)+' '+n.country+'-'+suffix(n,idx);if(n.extra)n.extra.name=n.name})}
function geoFill(){if(!DATA){st('请先拉取或分析订阅');return}if(GEO_RUNNING){st('已有 GeoIP / 落地检测任务正在运行；如果刚才点过落地检测没继续，请刷新页面后重试。');return}var targets=operationNodes('GeoIP 补全');if(!targets.length)return;var set={},servers=[];targets.forEach(function(n){if(isUnknown(n)&&n.server&&!set[n.server]){set[n.server]=1;servers.push(n.server)}});if(!servers.length){st('选中节点里没有需要 GeoIP 补全的未知节点');return}GEO_RUNNING=true;var total=servers.length,done=0,ok=0,fail=0,idx=0,con=3;st('开始对选中节点做在线 IP 归属补全：0 / '+total);function next(){while(con>0&&idx<servers.length){(function(sv){idx++;con--;var p=GEO_CACHE[sv]?Promise.resolve(GEO_CACHE[sv]):loadJSON('/api/geoip?host='+encodeURIComponent(sv)+'&t='+Date.now()).then(function(g){GEO_CACHE[sv]=g;return g});p.then(function(g){if(g&&g.ok&&g.countryCode){applyGeoToTargets(sv,g,targets);ok++}else fail++}).catch(function(){fail++}).then(function(){done++;con++;if(done%5===0||done===total){recalc(DATA);apply();st('在线 IP 归属补全：'+done+' / '+total+'，成功 '+ok+'，失败 '+fail)}if(done>=total){GEO_RUNNING=false;render(DATA);st('补全完成：成功 '+ok+'，失败 '+fail+'。已将选中的未知节点按 GeoIP 重命名。')}else next()})})(servers[idx])}}next()}
var DEFAULT_DROP='linuxdo,History,OpenRay,Telegram,TG,GitHub,Github,DeltaKroneckerGithub,WangCai,官网,官方,网站,主页,频道,群组,订阅,免费,公益,剩余,流量,到期,过期,有效期,套餐,重置,expire,expiry,traffic,reset,GB,MB,TB,官网地址,永久官网,域名,网址,节点,机场,订阅链接,欢迎,加入,关注';
var DEFAULT_KEEP='倍率,原生,机房,商宽,家宽,住宅,广播,专线,中转,直连,隧道,IEPL,IPLC,BGP,CN2,CMI,9929,4837,0.2x,0.5x,1x,2x,3x,5x,10x';
function codeName(n){var cc=String(n.countryCode||'').toUpperCase();var cn=String(n.country||'');if(!cc||cc==='UN'){cc='UN';cn=cn&&cn!=='未知'?cn:'未知'}if(cc==='CDN'){cn='中转'}return {cc:cc,cn:cn,key:cc+'|'+cn}}
function padNum(n,w){n=String(n||'');while(n.length<w)n='0'+n;return n}
function splitRules(v,def){v=String(v||'').trim();if(!v)v=def||'';return v.split(/[\n,，;；]+/).map(function(x){return String(x||'').trim()}).filter(Boolean)}
function escRe(s){return String(s||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
function ruleValue(id,def){var el=$(id);return el?el.value:def}
function cleanupOptions(){return {drop:splitRules(ruleValue('dropWords',DEFAULT_DROP),DEFAULT_DROP),keep:splitRules(ruleValue('keepTags',DEFAULT_KEEP),DEFAULT_KEEP),tpl:String(ruleValue('nameTpl','{flag} {code}-{country} {index} {tags}')||'{flag} {code}-{country} {index} {tags}')}}
function stripNoise(t,drop){t=String(t||'');t=t.replace(/https?:\/\/\S+/ig,' ');t=t.replace(/www\.[^\s|]+/ig,' ');t=t.replace(/[A-Za-z0-9._%+-]+\.[A-Za-z]{2,}(?:[\/\w?=&%.:+-]*)?/g,' ');t=t.replace(/@\w+/g,' ');t=t.replace(/[\uD83C-\uDBFF][\uDC00-\uDFFF]/g,' ');(drop||[]).forEach(function(w){if(!w)return;var re=new RegExp(escRe(w),'ig');t=t.replace(re,' ')});return t.replace(/[\[\]【】()（）{}<>《》]/g,' ').replace(/[|｜/\\]+/g,' ').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim()}
function uniqTags(arr){var m={},out=[];arr.forEach(function(x){x=String(x||'').trim();if(!x||m[x.toLowerCase()])return;m[x.toLowerCase()]=1;out.push(x)});return out}
function normalizeRate(r){r=String(r||'').replace(/倍率\s*[:：=]?\s*/,'').replace(/\s+/g,'').replace(/×/g,'x').replace(/倍$/,'x').replace(/X$/,'x');if(/^\d+(?:\.\d+)?$/.test(r))r=r+'x';return /^\d+(?:\.\d+)?x$/.test(r)?r:''}
function extractNameTags(n,opt){opt=opt||cleanupOptions();var e=n.extra||{};var src=[n.originalName,n.rawName,n.name,e.name,e.rate,e.ratio,e['倍率'],e.tag,e.label,e.remark,e.remarks,e.note,e.sni,e.servername,e.host,e.Host,e.path,e.plugin,e.mode].join(' ');var raw=String(src||''),txt=stripNoise(raw,opt.drop);var tags=[];var ms=raw.match(/(?:\d+(?:\.\d+)?\s*(?:x|X|×|倍)|倍率\s*[:：=]?\s*\d+(?:\.\d+)?)/g)||[];ms.forEach(function(r){r=normalizeRate(r);if(r)tags.push(r)});(opt.keep||[]).forEach(function(k){var kk=String(k||'').trim();if(!kk)return;if(/^\d+(?:\.\d+)?x$/i.test(kk)){if(new RegExp(escRe(kk),'i').test(raw))tags.push(kk.toLowerCase());return}var re=new RegExp(escRe(kk),'i');if(re.test(txt)||re.test(raw))tags.push(kk.toUpperCase()===kk?kk:kk)});return uniqTags(tags)}
function cleanBaseName(n,opt){opt=opt||cleanupOptions();var e=n.extra||{};var src=[n.rawName,n.originalName,n.name,e.name].filter(function(x){return x!=null&&String(x)!==''})[0]||'';return stripNoise(src,opt.drop)}
function templateCleanName(n,seq,width,opt){opt=opt||cleanupOptions();var c=codeName(n);var tags=extractNameTags(n,opt);var cleanName=cleanBaseName(n,opt);var mp={flag:flag(c.cc),code:c.cc,country:c.cn,index:padNum(seq,width),seq:String(seq),tags:tags.join(' '),tag:tags.join(' '),name:cleanName,clean:cleanName,cleanName:cleanName};var out=String(opt.tpl||'{flag} {code}-{country} {index} {tags}').replace(/\{(flag|code|country|index|seq|tags|tag|name|clean|cleanName)\}/g,function(_,k){return mp[k]||''});return out.replace(/\s+/g,' ').replace(/\s+([,，;；])/g,'$1').trim()}
function currentOrSelectedNodes(){var nodes=selectedNodes();if(nodes.length)return {nodes:nodes,scope:'选中'};var cur=filtered();return {nodes:cur,scope:'当前显示'}}
function cleanNames(){if(!DATA){st('请先拉取或分析订阅');return}var picked=currentOrSelectedNodes();var nodes=picked.nodes;if(!nodes.length){st('当前没有可清理的节点');return}var opt=cleanupOptions();st('正在按当前清理规则重命名'+picked.scope+'节点……');var totals={},seq={},cnt=0;nodes.forEach(function(n){if(!n.originalName)n.originalName=n.name;if(!n.rawName)n.rawName=n.originalName;var k=codeName(n).key;totals[k]=(totals[k]||0)+1});nodes.forEach(function(n){var c=codeName(n),w=Math.max(2,String(totals[c.key]||1).length);seq[c.key]=(seq[c.key]||0)+1;var nn=templateCleanName(n,seq[c.key],w,opt);if(nn&&nn!==n.name){n.name=nn;if(n.extra)n.extra.name=nn;cnt++}});render(DATA);st('已按当前规则清理'+picked.scope+'节点 '+cnt+' 个。已保留 rawName/originalName，可随时恢复；复制和导出会使用清理后的名称。')}
function restoreNames(){if(!DATA){st('请先拉取或分析订阅');return}var nodes=operationNodes('恢复原始名');if(!nodes.length)return;var cnt=0;nodes.forEach(function(n){var old=n.rawName||n.originalName;if(old&&old!==n.name){n.name=old;if(n.extra)n.extra.name=old;cnt++}});render(DATA);st('已恢复选中节点原始名称 '+cnt+' 个')}
function dl(name,txt,type){var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt],{type:type||'text/plain;charset=utf-8'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},1000)}
function b64utf8(s){return btoa(unescape(encodeURIComponent(String(s||''))))}
function b64url(s){return b64utf8(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function enc(s){return encodeURIComponent(String(s==null?'':s))}
function qyaml(s){s=String(s==null?'':s);return '"'+s.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n')+'"'}
function yamlKey(k){k=String(k||'');return /^[A-Za-z0-9_-]+$/.test(k)?k:qyaml(k)}
function isBoolKey(k){return /^(tls|udp|skip-cert-verify|allow-insecure|insecure|udp-relay|fast-open|tfo|smux|xudp)$/i.test(String(k||''))}
function isNumKey(k){return /^(port|alterId|alterid|aid|up|down|mtu|recv-window|recv_window|hop-interval|hop_interval|download-bandwidth|upload-bandwidth)$/i.test(String(k||''))}
function yval(v,k){if(v===true||v===false)return String(v);if(v===null||v===undefined||v==='')return '""';var s=String(v);if(isBoolKey(k)&&/^(true|false)$/i.test(s))return s.toLowerCase();if(isNumKey(k)&&/^[-+]?\d+(\.\d+)?$/.test(s))return s;return qyaml(s)}
function deepClone(v){if(v===undefined||typeof v==='function')return undefined;if(Array.isArray(v))return v.map(deepClone).filter(function(x){return x!==undefined});if(v&&typeof v==='object'){var r={};Object.keys(v).forEach(function(k){var x=deepClone(v[k]);if(x!==undefined)r[k]=x});return r}return v}
function clone(o){var r={},drop={raw:1,extra:1,fingerprint:1,_sid:1,originalName:1,rawName:1,nameBeforeAlive:1,aliveOK:1,aliveLatency:1,aliveStatus:1,aliveError:1,landingError:1,geoProvider:1,geoQuery:1,geoCity:1,geoRegion:1,geoISP:1,geoASN:1,country:1,countryCode:1,countrySource:1,countryConfidence:1,sourceFormat:1};o=o||{};Object.keys(o).forEach(function(k){if(drop[k]||o[k]===undefined)return;var v=deepClone(o[k]);if(v!==undefined)r[k]=v});return r}
function firstNonEmpty(){for(var i=0;i<arguments.length;i++){var v=arguments[i];if(v!==null&&v!==undefined&&String(v)!=='')return v}return ''}
function pruneEmpty(v){if(Array.isArray(v)){for(var i=v.length-1;i>=0;i--){var x=pruneEmpty(v[i]);if(x===undefined)v.splice(i,1);else v[i]=x}return v.length?v:undefined}if(v&&typeof v==='object'){Object.keys(v).forEach(function(k){var x=pruneEmpty(v[k]);if(x===undefined)delete v[k];else v[k]=x});return Object.keys(v).length?v:undefined}if(v===undefined||v===null||v==='')return undefined;return v}
function getWSPath(e){return firstNonEmpty(e.path,e['ws-path'],e['ws-opts']&&e['ws-opts'].path)}
function getWSHost(e){return firstNonEmpty(e.Host,e.host,e['ws-host'],e['ws-opts']&&e['ws-opts'].headers&&e['ws-opts'].headers.Host,e['ws-opts']&&e['ws-opts'].headers&&e['ws-opts'].headers.host,e.headers&&e.headers.Host,e.headers&&e.headers.host)}
function getGrpcService(e){return firstNonEmpty(e['grpc-service-name'],e.serviceName,e['service-name'],e['grpc-opts']&&e['grpc-opts']['grpc-service-name'],e['grpc-opts']&&e['grpc-opts']['service-name'],e['grpc-opts']&&e['grpc-opts'].serviceName)}
function getRealityPBK(e){return firstNonEmpty(e['reality-public-key'],e['public-key'],e.publicKey,e.pbk,e['reality-opts']&&e['reality-opts']['public-key'],e['reality-opts']&&e['reality-opts'].publicKey,e['reality-opts']&&e['reality-opts'].pbk)}
function getRealitySID(e){return firstNonEmpty(e['reality-short-id'],e['short-id'],e.shortId,e.sid,e['reality-opts']&&e['reality-opts']['short-id'],e['reality-opts']&&e['reality-opts'].shortId,e['reality-opts']&&e['reality-opts'].sid)}
function getFP(e){return firstNonEmpty(e['client-fingerprint'],e.fingerprint,e.fp)}
function getSNI(e){return firstNonEmpty(e.sni,e.servername,e.serverName,e['server-name'],e.server_name)}
function getALPN(e){var a=e.alpn;if(Array.isArray(a))return a.join(',');return firstNonEmpty(a,e.alpns)}
function normalizeClashForExport(o,n){o=o||{};n=n||{};if(!o.name)o.name=n.name;if(!o.type)o.type=n.protocol;if(!o.server)o.server=n.server;if(!o.port)o.port=n.port;if(n.network&&!o.network)o.network=n.network;if(n.tls&&!o.tls)o.tls=n.tls;var net=String(o.network||'').toLowerCase();if(net==='websocket')o.network='ws';if(net==='h2')o.network='grpc';if(String(o.network||'').toLowerCase()==='ws'){var path=getWSPath(o);var host=getWSHost(o);if(path||host){if(!o['ws-opts']||typeof o['ws-opts']!=='object')o['ws-opts']={};if(path&&!o['ws-opts'].path)o['ws-opts'].path=path;if(host){if(!o['ws-opts'].headers||typeof o['ws-opts'].headers!=='object')o['ws-opts'].headers={};if(!o['ws-opts'].headers.Host&&!o['ws-opts'].headers.host)o['ws-opts'].headers.Host=host}}delete o.path;delete o['ws-path'];delete o.Host;delete o.host;delete o['ws-host']}var svc=getGrpcService(o);if(String(o.network||'').toLowerCase()==='grpc'||svc){o.network='grpc';if(svc){if(!o['grpc-opts']||typeof o['grpc-opts']!=='object')o['grpc-opts']={};if(!o['grpc-opts']['grpc-service-name'])o['grpc-opts']['grpc-service-name']=svc}delete o['grpc-service-name'];delete o.serviceName;delete o['service-name']}var pbk=getRealityPBK(o);var sid=getRealitySID(o);if(pbk||sid){if(!o['reality-opts']||typeof o['reality-opts']!=='object')o['reality-opts']={};if(pbk&&!o['reality-opts']['public-key'])o['reality-opts']['public-key']=pbk;if(sid&&!o['reality-opts']['short-id'])o['reality-opts']['short-id']=sid;delete o['reality-public-key'];delete o['public-key'];delete o.publicKey;delete o.pbk;delete o['reality-short-id'];delete o['short-id'];delete o.shortId;delete o.sid}return pruneEmpty(o)||{} }
function yamlEmit(lines,indent,key,val){if(val===undefined||typeof val==='function')return;var sp=' '.repeat(indent);if(Array.isArray(val)){if(!val.length){lines.push(sp+yamlKey(key)+': []');return}lines.push(sp+yamlKey(key)+':');val.forEach(function(x){if(x&&typeof x==='object'){lines.push(sp+'  -');Object.keys(x).forEach(function(ck){yamlEmit(lines,indent+4,ck,x[ck])})}else lines.push(sp+'  - '+yval(x,key))});return}if(val&&typeof val==='object'){var ks=Object.keys(val).filter(function(k){return val[k]!==undefined&&typeof val[k]!=='function'});if(!ks.length){lines.push(sp+yamlKey(key)+': {}');return}lines.push(sp+yamlKey(key)+':');ks.forEach(function(ck){yamlEmit(lines,indent+2,ck,val[ck])});return}lines.push(sp+yamlKey(key)+': '+yval(val,key))}
function orderedKeys(o){var order=['type','server','port','cipher','uuid','password','username','alterId','alterid','network','tls','udp','sni','servername','server-name','client-fingerprint','flow','encryption','skip-cert-verify','alpn','ws-opts','grpc-opts','reality-opts','plugin','plugin-opts','headers','obfs','obfs-password','up','down','auth','auth-str','token','version'];var used={},out=[];order.forEach(function(k){if(o[k]!==undefined&&k!=='name'){out.push(k);used[k]=1}});Object.keys(o).forEach(function(k){if(k!=='name'&&!used[k])out.push(k)});return out}
function exportNodes(){var a=selectedNodes();if(!a.length)throw new Error('请先勾选要复制/导出的节点，或点击“全选当前”');return a}
function toClashYAML(){var a=exportNodes();if(!a.length)throw new Error('没有可导出的节点');var lines=['mixed-port: 7890','allow-lan: false','mode: rule','log-level: info','','proxies:'];a.forEach(function(n){var o=normalizeClashForExport(clone(n.extra),n);o.name=n.name;o.type=o.type||n.protocol;o.server=o.server||n.server;o.port=o.port||n.port;lines.push('  - name: '+qyaml(o.name));orderedKeys(o).forEach(function(k){yamlEmit(lines,4,k,o[k])})});lines.push('','proxy-groups:','  - name: '+qyaml('🚀 节点选择'),'    type: select','    proxies:');a.forEach(function(n){lines.push('      - '+qyaml(n.name))});lines.push('','rules:','  - MATCH,'+qyaml('🚀 节点选择'));return lines.join('\n')+'\n'}
function uriHost(h){h=String(h||'');return h.indexOf(':')>=0&&h[0]!=='['?'['+h+']':h}
function addQ(q,k,v){if(v===null||v===undefined||String(v)==='')return;q.push(enc(k)+'='+enc(v))}
function addBoolQ(q,k,v){if(v===null||v===undefined||v==='')return;var s=String(v).toLowerCase();q.push(enc(k)+'='+(s==='true'||s==='1'||s==='yes'?'1':'0'))}
function tlsSecurity(e){var sec=String(e.security||'').toLowerCase();if(sec==='reality')return 'reality';if(sec==='tls'||String(e.tls).toLowerCase()==='true')return 'tls';return ''}
function addTransportQ(q,e){var net=String(e.network||e.net||'').toLowerCase();if(net==='websocket')net='ws';if(net==='h2')net='grpc';if(net)addQ(q,'type',net);if(net==='ws'){addQ(q,'host',getWSHost(e));addQ(q,'path',getWSPath(e))}if(net==='grpc'){addQ(q,'serviceName',getGrpcService(e));addQ(q,'mode',e.mode)}}
function uriFor(n){var e=n.extra||{},p=String(n.protocol||e.type||'').toLowerCase(),name=enc(n.name),server=uriHost(e.server||n.server),port=e.port||n.port;if(p==='hy2')p='hysteria2';if(p==='socks')p='socks5';if(!server||!port)return null;
if(p==='ss'){var method=e.cipher||e.method||e['encrypt-method']||'none',pass=e.password||n.id||'';var u='ss://'+b64url(method+':'+pass)+'@'+server+':'+port;var plug=e.plugin||'';if(plug){var ps=[plug];['mode','host','path','tls','mux'].forEach(function(k){if(e[k])ps.push(k+'='+e[k])});u+='?plugin='+enc(ps.join(';'))}return u+'#'+name}
if(p==='trojan'){var q=[];var pass=e.password||n.id||'';var sec=tlsSecurity(e);if(sec)addQ(q,'security',sec);addQ(q,'sni',getSNI(e));addTransportQ(q,e);return 'trojan://'+enc(pass)+'@'+server+':'+port+(q.length?'?'+q.join('&'):'')+'#'+name}
if(p==='vless'){var pbk=getRealityPBK(e),sid=getRealitySID(e),fp=getFP(e),q2=['encryption='+enc(e.encryption||'none')];var sec=tlsSecurity(e);if(pbk)sec='reality';if(sec)addQ(q2,'security',sec);addTransportQ(q2,e);addQ(q2,'sni',getSNI(e));addQ(q2,'flow',e.flow);addQ(q2,'pbk',pbk);addQ(q2,'sid',sid);addQ(q2,'fp',fp);return 'vless://'+enc(e.uuid||n.id||'')+'@'+server+':'+port+'?'+q2.join('&')+'#'+name}
if(p==='vmess'){var net=String(e.network||n.network||'tcp').toLowerCase();if(net==='websocket')net='ws';var obj={v:'2',ps:n.name,add:e.server||n.server,port:String(port),id:e.uuid||n.id||'',aid:String(e.alterId||e.aid||'0'),scy:e.cipher||e.scy||'auto',net:net,type:e.type||'',host:getWSHost(e),path:getWSPath(e)||getGrpcService(e)||'',tls:tlsSecurity(e)==='tls'?'tls':'',sni:getSNI(e)};return 'vmess://'+b64utf8(JSON.stringify(obj))}
if(p==='hysteria2'||p==='hysteria'){var qh=[],pass=e.password||e.auth||e['auth-str']||n.id||'';addQ(qh,'sni',getSNI(e));addBoolQ(qh,'insecure',e.insecure||e['skip-cert-verify']||e.allowInsecure);addQ(qh,'obfs',e.obfs);addQ(qh,'obfs-password',e['obfs-password']||e.obfsPassword);addQ(qh,'alpn',getALPN(e));addQ(qh,'up',e.up||e['upload-bandwidth']||e.uploadBandwidth);addQ(qh,'down',e.down||e['download-bandwidth']||e.downloadBandwidth);return 'hysteria2://'+enc(pass)+'@'+server+':'+port+(qh.length?'?'+qh.join('&'):'')+'#'+name}
if(p==='tuic'){var qt=[],uuid=e.uuid||e.id||n.id||'',pwd=e.password||e.passwd||'';addQ(qt,'sni',getSNI(e));addQ(qt,'alpn',getALPN(e)||'h3');addQ(qt,'congestion_control',e.congestion_control||e['congestion-controller']||e.congestionController);addQ(qt,'udp_relay_mode',e.udp_relay_mode||e['udp-relay-mode']||e.udpRelayMode);addBoolQ(qt,'allow_insecure',e['skip-cert-verify']||e.allowInsecure||e.insecure);return 'tuic://'+enc(uuid)+(pwd?':'+enc(pwd):'')+'@'+server+':'+port+(qt.length?'?'+qt.join('&'):'')+'#'+name}
if(p==='snell'){var qs=[],psk=e.psk||e.password||n.id||'';addQ(qs,'version',e.version||'4');addQ(qs,'obfs',e.obfs);addQ(qs,'obfs-host',e['obfs-host']||e.obfsHost||e.host);return 'snell://'+enc(psk)+'@'+server+':'+port+(qs.length?'?'+qs.join('&'):'')+'#'+name}
if(p==='socks5'||p==='http'||p==='https'){var user=e.username||e.user||'',pwd=e.password||e.pass||'',auth=user?enc(user)+(pwd?':'+enc(pwd):'')+'@':'';return p+'://'+auth+server+':'+port+'#'+name}
if(p==='anytls'){var qa=[],ap=e.password||e.passwd||n.id||'';addQ(qa,'security','tls');addQ(qa,'sni',getSNI(e));addBoolQ(qa,'insecure',e.insecure||e['skip-cert-verify']||e.allowInsecure);return 'anytls://'+enc(ap)+'@'+server+':'+port+(qa.length?'?'+qa.join('&'):'')+'#'+name}
if(/^\w+:\/\//.test(String(n.raw||'')))return String(n.raw);return null}
function toURIText(){var a=exportNodes(),out=[],skip=0;a.forEach(function(n){var u=uriFor(n);if(u)out.push(u);else skip++});if(!out.length)throw new Error('当前节点无法导出为 URI');if(skip)st('已跳过 '+skip+' 个暂不支持 URI 的节点');return out.join('\n')+'\n'}
function jsn(){var a=exportNodes();return JSON.stringify({ok:true,summary:{selected:a.length,total:(DATA&&DATA.nodes&&DATA.nodes.length)||0},nodes:a,meta:(DATA&&DATA.meta)||{}},null,2)}
function buildExportPayload(){if(!DATA)throw new Error('请先拉取或分析订阅');var t=$('exportType').value,c=selectedNodes().length;if(!c)throw new Error('请先勾选要复制/导出的节点，或点击“全选当前”');if(t==='json')return {name:'subviz-selected.json',text:jsn(),type:'application/json;charset=utf-8',label:'JSON 备份',count:c};if(t==='clash'){var y=toClashYAML();return {name:'subviz-selected-clash.yaml',text:y,type:'application/x-yaml;charset=utf-8',label:'Clash YAML',count:c}}if(t==='uri64'){var u64=b64utf8(toURIText());return {name:'subviz-selected-uri-base64.txt',text:u64,type:'text/plain;charset=utf-8',label:'Base64 URI 订阅',count:c}}var u=toURIText();return {name:'subviz-selected-uri.txt',text:u,type:'text/plain;charset=utf-8',label:'通用 URI 订阅',count:c}}
window.doExport=function doExport(){try{var p=buildExportPayload();dl(p.name,p.text,p.type);st('已导出 '+p.label+(p.count!=null?'：'+p.count+' 个节点':''))}catch(e){st('导出失败：'+e.message)}}
function fallbackCopy(txt){var ta=document.createElement('textarea');ta.value=txt;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.left='-9999px';document.body.appendChild(ta);ta.select();ta.setSelectionRange(0,ta.value.length);var ok=false;try{ok=document.execCommand('copy')}catch(e){}ta.remove();return ok}
window.copyExport=function copyExport(){try{var p=buildExportPayload();var done=function(){st('已复制 '+p.label+' 到剪贴板'+(p.count!=null?'：'+p.count+' 个节点':''))};if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(p.text).then(done).catch(function(){if(fallbackCopy(p.text))done();else st('复制失败：请改用导出文件')})}else{if(fallbackCopy(p.text))done();else st('复制失败：当前浏览器不允许写入剪贴板')}}catch(e){st('复制失败：'+e.message)}}


function aliveErr(s){s=String(s||'');var l=s.toLowerCase();if(!s)return '检测失败';if(l.indexOf('timeout')>=0||s.indexOf('超时')>=0)return '请求超时：节点无响应、速度过慢，或当前检测超时设置偏短';if(l.indexOf('connection refused')>=0)return '连接被拒绝：服务器端口关闭、节点失效，或服务端主动拒绝';if(l.indexOf('websocket closed')>=0)return 'WebSocket 被关闭：常见原因是 Host/SNI/path 不匹配、CDN 回源拒绝，或节点已失效';if(l.indexOf('load failed')>=0)return '连接失败：节点不可达、TLS/握手失败，或当前网络阻断';if(s.indexOf('状态码不匹配')>=0)return s;if(l.indexOf('policy descriptor')>=0||s.indexOf('临时代理策略')>=0)return 'Surge 临时代理策略创建失败';if(l.indexOf('unsupported')>=0||s.indexOf('不支持')>=0)return '当前协议不支持测活';return s}
function cfgVal(id,def){var el=$(id);var v=el?String(el.value==null?'':el.value).trim():'';return v?v:String(def==null?'':def)}
function cfgChecked(id){var el=$(id);return !!(el&&el.checked)}
function cfgInt(id,def,min,max){var raw=cfgVal(id,def),n=parseInt(raw,10);if(!isFinite(n)||n<min||n>max)n=def;return Math.max(min,Math.min(max,n))}
function cfgString(id,def){return cfgVal(id,def)}
function cfgList(id){var raw=cfgVal(id,'');return raw?raw.split(/[\n|,，]+/).map(function(x){return String(x||'').trim()}).filter(Boolean):[]}
function qsAdd(k,v){v=String(v==null?'':v).trim();return v?'&'+encodeURIComponent(k)+'='+encodeURIComponent(v):''}
function getAliveSettings(){return {url:cfgString('aliveUrl','http://connectivitycheck.platform.hicloud.com/generate_204'),status:cfgString('aliveStatus','204'),concurrency:cfgInt('aliveCon',5,1,20),timeout:cfgInt('aliveTimeout',3000,200,30000),retries:cfgInt('aliveRetries',1,0,3),retryDelay:cfgInt('aliveRetryDelay',1000,0,5000),showLatency:cfgChecked('aliveShowLatency')}}
function aliveQS(cfg){cfg=cfg||getAliveSettings();var q='';q+=qsAdd('url',cfg.url);q+=qsAdd('status',cfg.status);q+=qsAdd('timeout',cfg.timeout);q+=qsAdd('retries',cfg.retries);q+=qsAdd('retry_delay',cfg.retryDelay);return q}
function applyAliveName(n,cfg){cfg=cfg||getAliveSettings();if(!cfg.showLatency)return;if(n.aliveOK!==true||!n.aliveLatency)return;if(!n.nameBeforeAlive)n.nameBeforeAlive=n.name;n.name=String(n.nameBeforeAlive).replace(/^\[\d+ms\]\s*/,'');n.name='['+n.aliveLatency+'ms] '+n.name;if(n.extra)n.extra.name=n.name}
function runLimitedTasks(items,limit,worker,onProgress,onDone){items=items||[];limit=Math.max(1,Math.min(Number(limit)||1,items.length||1));var idx=0,active=0,done=0,stopped=false,maxActive=0;function pump(){if(stopped)return;if(done>=items.length&&active===0){if(onDone)onDone({done:done,maxActive:maxActive});return}while(active<limit&&idx<items.length){(function(item,order){idx++;active++;if(active>maxActive)maxActive=active;Promise.resolve().then(function(){return worker(item,order)}).catch(function(e){if(onProgress)onProgress(item,order,e)}).then(function(){active--;done++;if(onProgress)onProgress(item,order,null,done,items.length,maxActive);pump()})})(items[idx],idx)}}pump();return {cancel:function(){stopped=true},getMaxActive:function(){return maxActive}}}
function aliveTest(){try{if(!DATA){st('请先拉取或分析订阅');return}if(GEO_RUNNING){st('已有检测任务正在运行；如果刚才没有进度，请刷新页面后重试。');return}var nodes=operationNodes('测活');if(!nodes.length)return;var cfg=getAliveSettings(),q=aliveQS(cfg);GEO_RUNNING=true;var total=nodes.length,done=0,ok=0,fail=0,errMap={};st('开始对选中的 '+total+' 个节点测活：并发 '+cfg.concurrency+'，超时 '+cfg.timeout+'ms，0 / '+total);runLimitedTasks(nodes,cfg.concurrency,function(n){return loadJSON('/api/availability?t='+Date.now()+q,{method:'POST',body:JSON.stringify(n),headers:{'Content-Type':'application/json;charset=utf-8'}}).then(function(r){if(r&&r.ok&&r.alive){n.aliveOK=true;n.aliveLatency=r.latency||r.totalLatency||0;n.aliveStatus=r.status;n.aliveError='';applyAliveName(n,cfg);ok++}else{var er=aliveErr((r&&r.error)||'检测失败');n.aliveOK=false;n.aliveError=er;errMap[er]=(errMap[er]||0)+1;fail++}}).catch(function(e){var er=aliveErr(e.message||String(e));n.aliveOK=false;n.aliveError=er;errMap[er]=(errMap[er]||0)+1;fail++})},function(_n,_i,_err,d,t){if(d){done=d;recalc(DATA);apply();st('测活：'+done+' / '+t+'，并发 '+cfg.concurrency+'，可用 '+ok+'，不可用 '+fail)}},function(){GEO_RUNNING=false;render(DATA);var es=Object.keys(errMap).slice(0,3).map(function(k){return k+'×'+errMap[k]}).join('；');st('测活完成：已检测选中的 '+total+' 个节点，实际按 '+cfg.concurrency+' 并发调度，超时 '+cfg.timeout+'ms，可用 '+ok+'，不可用 '+fail+(es?'。失败原因：'+es:''))})}catch(e){GEO_RUNNING=false;st('测活启动失败：'+aliveErr(e&&e.message?e.message:String(e)))}}
function getLandingSettings(){var apis=cfgList('landingApis');return {concurrency:cfgInt('landingCon',2,1,10),timeout:cfgInt('landingTimeout',5000,200,30000),retries:cfgInt('landingRetries',1,0,3),retryDelay:800,format:cfgString('landingFormat',''),internal:cfgChecked('landingInternal'),apis:apis}}
function landingQS(cfg){cfg=cfg||getLandingSettings();var q='';q+=qsAdd('timeout',cfg.timeout);q+=qsAdd('retries',cfg.retries);if(cfg.retryDelay!=null)q+=qsAdd('retry_delay',cfg.retryDelay);if(cfg.apis&&cfg.apis.length)q+=qsAdd('api',cfg.apis.join('|'));q+=qsAdd('format',cfg.format);if(cfg.internal)q+=qsAdd('internal','1');return q}
function landingFormatName(format,n,seq,width){format=String(format||'').trim();if(!format)return '';var cc=String(n.countryCode||n.landingCountryCode||'UN').toUpperCase();var cn=String(n.country||n.landingCountry||'未知');var tags=(extractNameTags?extractNameTags(n,cleanupOptions()):[]).join(' ');var mp={flag:flag(cc),code:cc,country:cn,index:padNum(seq,width),seq:String(seq),tags:tags,tag:tags,ip:n.landingIP||'',city:n.landingCity||n.geoCity||'',isp:n.landingISP||n.geoISP||'',asn:n.landingASN||n.geoASN||''};return format.replace(/\{(flag|code|country|index|seq|tags|tag|ip|city|isp|asn)\}/g,function(_,k){return mp[k]||''}).replace(/\s+/g,' ').trim()}
function landingApplyOne(n,r,cfg){if(!r||!r.ok)return;var cc=String(r.countryCode||'').toUpperCase();if(!cc)return;n.landingOK=true;n.landingIP=r.landingIP||r.query||'';n.landingCountryCode=cc;n.landingCountry=r.country||cc;n.landingProvider=r.provider||'';n.landingCity=r.city||'';n.landingRegion=r.region||'';n.landingISP=r.isp||'';n.landingASN=r.asn||'';n.landingAPI=r.usedAPI||r.landingAPI||'';n.landingLatency=r.latency||'';n.landingAttempts=r.attempts||'';n.entryServer=r.entryServer||n.server;n.entryPort=r.entryPort||n.port;n.countryCode=cc;n.country=r.country||n.country||cc;n.countrySource='landing';n.countryConfidence=96;n.geoCity=r.city||'';n.geoISP=r.isp||'';n.geoASN=r.asn||'';n.landingFormattedName=r.formattedName||'';n._landingNameFormat=(cfg&&cfg.format)||'';}
function applyLandingNames(cfg){if(!DATA)return;cfg=cfg||getLandingSettings();var totals={},counters={};(DATA.nodes||[]).forEach(function(n){if(n.countrySource!=='landing')return;var cc=String(n.countryCode||'UN').toUpperCase();var cn=String(n.country||'未知');var key=cc+'|'+cn;totals[key]=(totals[key]||0)+1});(DATA.nodes||[]).forEach(function(n){var cc=String(n.countryCode||'UN').toUpperCase();var cn=String(n.country||'未知');var key=cc+'|'+cn;if(n.countrySource==='landing'){counters[key]=(counters[key]||0)+1;var width=Math.max(2,String(totals[key]||1).length);var idx=padNum(counters[key],width);var old=n.name;if(!n.originalName)n.originalName=old;var formatted=n.landingFormattedName||landingFormatName(cfg.format,n,counters[key],width);n.name=formatted||flag(cc)+' '+cc+'-'+cn+' '+idx;if(n.extra)n.extra.name=n.name;}})}
function landingTest(){try{if(!DATA){st('请先拉取或分析订阅');return}if(GEO_RUNNING){st('已有 GeoIP / 落地检测任务正在运行；如果刚才没有进度，请刷新页面后重试。');return}var nodes=operationNodes('落地检测');if(!nodes.length)return;var cfg=getLandingSettings(),q=landingQS(cfg);GEO_RUNNING=true;var total=nodes.length,done=0,ok=0,fail=0,errMap={};st('开始对选中的 '+total+' 个节点做落地检测：并发 '+cfg.concurrency+'，超时 '+cfg.timeout+'ms，0 / '+total+'。');runLimitedTasks(nodes,cfg.concurrency,function(n){return loadJSON('/api/landing?t='+Date.now()+q,{method:'POST',body:JSON.stringify(n),headers:{'Content-Type':'application/json;charset=utf-8'}}).then(function(r){if(r&&r.ok){landingApplyOne(n,r,cfg);ok++}else{var er=(r&&r.error)||'failed'; if(r&&r.descriptorProtocol)er+='('+r.descriptorProtocol+')'; var z=zhErr(er); n.landingOK=false;n.landingError=z;n.landingErrorRaw=er;errMap[z]=(errMap[z]||0)+1;fail++}}).catch(function(e){var er=e.message||String(e);var z=zhErr(er);n.landingOK=false;n.landingError=z;n.landingErrorRaw=er;errMap[z]=(errMap[z]||0)+1;fail++})},function(_n,_i,_err,d,t){if(d){done=d;applyLandingNames(cfg);recalc(DATA);apply();st('落地检测：'+done+' / '+t+'，并发 '+cfg.concurrency+'，成功 '+ok+'，失败 '+fail)}},function(){GEO_RUNNING=false;applyLandingNames(cfg);render(DATA);var es=Object.keys(errMap).slice(0,3).map(function(k){return k+'×'+errMap[k]}).join('；');st('落地检测完成：已检测选中的 '+total+' 个节点，实际按 '+cfg.concurrency+' 并发调度，超时 '+cfg.timeout+'ms，成功 '+ok+'，失败 '+fail+'。仅对成功获取落地的节点重命名。'+(es?' 失败原因：'+es:''))})}catch(e){GEO_RUNNING=false;st('落地检测启动失败：'+zhErr(e&&e.message?e.message:String(e)))}}
/* ── Centralized window exports ── */
window.toggleSelect=toggleSelect;
window.selectCurrent=selectCurrent;
window.invertCurrent=invertCurrent;
window.clearSelected=clearSelected;
window.cleanNames=cleanNames;
window.restoreNames=restoreNames;
window.geoFill=geoFill;
window.landingTest=landingTest;
window.aliveTest=aliveTest;
/* ── End exports ── */
window.addEventListener('DOMContentLoaded',function(){['q','pf','cf','unique'].forEach(function(id){var el=$(id);if(!el)return;el.addEventListener('input',apply);el.addEventListener('change',apply)});function bind(id,fn){var el=$(id);if(el)el.onclick=fn}bind('pull',analyzeURL);bind('demo',sample);bind('textBtn',analyzeText);bind('geo',geoFill);bind('landing',landingTest);bind('alive',function(){window.aliveTest()});bind('cleanNames',window.cleanNames);bind('applyRules',window.cleanNames);bind('restoreNames',window.restoreNames);bind('exportBtn',window.doExport);bind('copyBtn',window.copyExport);bind('selectCurrent',window.selectCurrent);bind('invertCurrent',window.invertCurrent);bind('clearSelected',window.clearSelected);});

/* ── sv132: layout grid / meta row / copyAlive ── */
function sv132ById(id){return document.getElementById(id)}
function sv132EnsureStyle(){
  if(sv132ById('sv132Style')) return;
  var style=document.createElement('style');
  style.id='sv132Style';
  style.textContent=
    '.sv-meta-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:10px 0 14px;}'+
    '.sv-meta-row label{margin:0!important;}'+
    '.sv-pill{display:inline-flex;align-items:center;justify-content:center;padding:8px 14px;border-radius:999px;background:rgba(76,132,255,.16);color:#dce7ff;font-weight:700;margin:0;}'+
    '.sv-mini-grid,.sv-op-grid{display:grid;gap:12px;margin:12px 0;}'+
    '.sv-mini-grid{grid-template-columns:repeat(3,minmax(0,1fr));}'+
    '.sv-op-grid-3{grid-template-columns:repeat(3,minmax(0,1fr));}'+
    '.sv-op-grid-2{grid-template-columns:repeat(2,minmax(0,1fr));}'+
    '.sv-mini-grid button,.sv-op-grid button{width:100%;margin:0!important;padding:14px 10px!important;min-height:0;font-size:16px;line-height:1.25;}'+
    '#sv132SelectGrid{margin-top:6px;margin-bottom:14px;}'+
    '#sv132MainOps,#sv132NameOps,#sv132ExportGrid{margin-top:14px;}'+
    '@media (max-width:640px){.sv-mini-grid,.sv-op-grid-3{grid-template-columns:repeat(2,minmax(0,1fr));}.sv-op-grid-2{grid-template-columns:repeat(2,minmax(0,1fr));}}'+
    '@media (max-width:430px){.sv-mini-grid,.sv-op-grid-3,.sv-op-grid-2{grid-template-columns:repeat(2,minmax(0,1fr));}.sv-meta-row{align-items:flex-start;}}';
  document.head.appendChild(style);
}
function sv132MakeGrid(id, cls, beforeEl){
  var wrap=sv132ById(id);
  if(!wrap){
    wrap=document.createElement('div');
    wrap.id=id;
    wrap.className=cls;
    if(beforeEl&&beforeEl.parentNode) beforeEl.parentNode.insertBefore(wrap,beforeEl);
  }
  return wrap;
}
function sv132MoveIntoGrid(ids, gridId, cls){
  var first=null;
  ids.forEach(function(id){if(!first&&sv132ById(id)) first=sv132ById(id)});
  if(!first) return null;
  var grid=sv132MakeGrid(gridId, cls, first);
  ids.forEach(function(id){
    var el=sv132ById(id);
    if(el){
      el.classList.add('sv-compact-btn');
      grid.appendChild(el);
    }
  });
  return grid;
}
function sv132RefineLayout(){
  sv132EnsureStyle();
  var unique=sv132ById('unique');
  var sel=sv132ById('selCount');
  var uniqueLabel = unique && unique.closest ? unique.closest('label') : (unique ? unique.parentNode : null);
  if(uniqueLabel && sel && !sv132ById('sv132Meta')){
    var row=document.createElement('div');
    row.id='sv132Meta';
    row.className='sv-meta-row';
    uniqueLabel.parentNode.insertBefore(row, uniqueLabel);
    row.appendChild(uniqueLabel);
    row.appendChild(sel);
  }
  if(sel) sel.classList.add('sv-pill');
  sv132MoveIntoGrid(['selectCurrent','invertCurrent','clearSelected'], 'sv132SelectGrid', 'sv-mini-grid');
  sv132MoveIntoGrid(['geo','landing','alive'], 'sv132MainOps', 'sv-op-grid sv-op-grid-3');
  sv132MoveIntoGrid(['cleanNames','restoreNames'], 'sv132NameOps', 'sv-op-grid sv-op-grid-2');
  var cleanBtn=sv132ById('cleanNames');
  if(cleanBtn) cleanBtn.textContent='清理节点名';
  var restoreBtn=sv132ById('restoreNames');
  if(restoreBtn) restoreBtn.textContent='恢复原名';
  var copyBtn=sv132ById('copyBtn');
  if(copyBtn && !sv132ById('copyAliveBtn')){
    var btn=document.createElement('button');
    btn.id='copyAliveBtn';
    btn.className=copyBtn.className||'';
    btn.textContent='复制可用节点';
    copyBtn.parentNode.insertBefore(btn, copyBtn.nextSibling);
    btn.addEventListener('click', window.copyAliveExport);
  }
  sv132MoveIntoGrid(['copyAliveBtn','copyBtn','exportBtn'], 'sv132ExportGrid', 'sv-op-grid sv-op-grid-3');
}
function sv132WithNodes(nodes, fn){
  var oldSelectedNodes=selectedNodes;
  try{
    selectedNodes=function(){return nodes};
    return fn();
  } finally {
    selectedNodes=oldSelectedNodes;
  }
}
window.copyAliveExport=function copyAliveExport(){
  try{
    if(!DATA){st('请先拉取或分析订阅');return}
    var picked=operationNodes('复制可用节点');
    if(!picked.length) return;
    var alive=picked.filter(function(n){return n&&n.aliveOK===true});
    if(!alive.length){st('当前勾选节点中没有可用节点。请先执行测活，或调整勾选范围。');return}
    var payload=sv132WithNodes(alive, buildExportPayload);
    payload.name=String(payload.name||'').replace('selected','alive');
    function ok(){st('已复制可用节点：'+alive.length+' 个（'+payload.label+'）')}
    if(navigator.clipboard && window.isSecureContext){
      navigator.clipboard.writeText(payload.text).then(ok).catch(function(){
        if(fallbackCopy(payload.text)) ok();
        else st('复制失败：当前浏览器不允许写入剪贴板');
      });
    } else if(fallbackCopy(payload.text)){
      ok();
    } else {
      st('复制失败：当前浏览器不允许写入剪贴板');
    }
  }catch(e){
    st('复制可用节点失败：'+e.message);
  }
};
function sv132UpdateSelectUI(){
  var c=selectedCount();
  var el=sv132ById('selCount');
  if(el){
    el.textContent='已选 '+c+' 个';
    el.classList.add('sv-pill');
  }
  var countEl=sv132ById('count');
  if(countEl && DATA){
    var total=((DATA&&DATA.summary&&DATA.summary.total)||0);
    var current=filtered().length;
    countEl.textContent='当前显示 '+current+' / '+total+' 个节点';
  }
}
hook('afterApply', function(){ sv132UpdateSelectUI(); sv132RefineLayout(); });
window.addEventListener('DOMContentLoaded', function(){ sv132RefineLayout(); sv132UpdateSelectUI(); });


/* ── sv133: theme / selectAlive / autoAlive ── */
function sv133ById(id){return document.getElementById(id)}
function sv133InstallStyle(){
  if(sv133ById('sv133Style')) return;
  var style=document.createElement('style');
  style.id='sv133Style';
  style.textContent =
    'body.sv133 .wrap{max-width:980px;padding-bottom:70px;}'+
      'body.sv133 .hero,body.sv133 .card{border-radius:22px;padding:18px;margin:14px 0;}'+
      'body.sv133 h1{font-size:28px;line-height:1.2}body.sv133 h2{font-size:22px;margin-bottom:14px;}'+
      'body.sv133 button{min-height:48px;border-radius:18px;padding:13px 12px;font-size:16px;line-height:1.25;margin-top:0;}'+
      'body.sv133 input,body.sv133 textarea,body.sv133 select{border-radius:16px;padding:13px 14px;font-size:15px;}'+
      'body.sv133 .status{font-size:14px;line-height:1.55;max-height:150px;}'+
      'body.sv133 #cards.grid{grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;}'+
      'body.sv133 .stat{padding:14px;border-radius:18px;}body.sv133 .stat b{font-size:30px;}'+
      'body.sv133 #protocols,body.sv133 #countries{max-height:320px;overflow:auto;padding-right:4px;}'+
      'body.sv133 .bar{grid-template-columns:108px 1fr 42px;gap:8px;font-size:14px;}'+
      'body.sv133 .track,body.sv133 .fill{height:12px;}'+
      'body.sv133 .filters{grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;}'+
      'body.sv133 .sv-section-title{font-size:13px;color:#9fb0cc;font-weight:800;margin:14px 0 8px;}'+
      'body.sv133 .sv-auto-row{display:flex;align-items:center;gap:9px;margin:8px 0 10px;color:#dbe8ff;font-size:14px;}'+
      'body.sv133 .sv-auto-row input{width:22px!important;height:22px!important;accent-color:#58a6ff;padding:0;}'+
      'body.sv133 .sv133-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:10px 0 12px;}'+
      'body.sv133 .sv133-grid.three{grid-template-columns:repeat(3,minmax(0,1fr));}'+
      'body.sv133 .sv133-grid button{width:100%;}'+
      'body.sv133 .rulebox{padding:10px 12px;border-radius:16px;margin-top:10px;}'+
      'body.sv133 .rulebox summary{font-size:15px;}'+
      'body.sv133 .exportbar{display:grid;grid-template-columns:1.3fr .7fr .7fr;gap:10px;}'+
      'body.sv133 #sv133ExportGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:10px;}'+
      'body.sv133 #sv133ExportGrid button{margin:0;}'+
      'body.sv133 table{table-layout:fixed;}'+
      'body.sv133 th,body.sv133 td{padding:10px 8px;}'+
      '@media(max-width:760px){'+
        'body.sv133 .wrap{padding:14px 10px 56px;}'+
        'body.sv133 .hero,body.sv133 .card{padding:15px 13px;border-radius:20px;margin:12px 0;}'+
        'body.sv133 h1{font-size:24px}body.sv133 h2{font-size:20px;}'+
        'body.sv133 #cards.grid{grid-template-columns:repeat(2,minmax(0,1fr));}'+
        'body.sv133 .stat{min-height:82px;}body.sv133 .stat b{font-size:28px;}'+
        'body.sv133 #protocols,body.sv133 #countries{max-height:260px;}'+
        'body.sv133 .bar{grid-template-columns:82px 1fr 34px;font-size:13px;}'+
        'body.sv133 .filters{grid-template-columns:1fr 1fr;}'+
        'body.sv133 .selectbar{display:block;}'+
        'body.sv133 #sv132Meta,body.sv133 .sv-meta-row{display:flex!important;gap:10px;align-items:center;justify-content:space-between;margin:10px 0;}'+
        'body.sv133 .sv-pill{font-size:14px;padding:7px 10px;}'+
        'body.sv133 .sv133-grid,body.sv133 .sv133-grid.three{grid-template-columns:repeat(2,minmax(0,1fr));}'+
        'body.sv133 .toolbar{grid-template-columns:repeat(2,minmax(0,1fr))!important;}'+
        'body.sv133 .toolhint{font-size:12px;line-height:1.5;}'+
        'body.sv133 .exportbar{grid-template-columns:1fr;}'+
        'body.sv133 table,body.sv133 thead,body.sv133 tbody{display:block;width:100%;}'+
        'body.sv133 thead{display:none;}'+
        'body.sv133 tbody tr{display:grid;grid-template-columns:34px minmax(0,1fr) 78px;grid-template-areas:"check name proto" "check name port";gap:4px 10px;align-items:center;border-top:1px solid #263f66;padding:12px 0;}'+
        'body.sv133 tbody td{display:block;border:0!important;padding:0!important;min-width:0;}'+
        'body.sv133 tbody td:nth-child(1){grid-area:check;}'+
        'body.sv133 tbody td:nth-child(2){display:none;}'+
        'body.sv133 tbody td:nth-child(3){grid-area:name;font-size:15px;line-height:1.35;word-break:break-word;}'+
        'body.sv133 tbody td:nth-child(4){grid-area:proto;text-align:right;}'+
        'body.sv133 tbody td:nth-child(5){display:none!important;}'+
        'body.sv133 tbody td:nth-child(6){grid-area:port;text-align:right;color:#dbe8ff;font-weight:800;font-size:15px;}'+
        'body.sv133 .tag{padding:5px 9px;font-size:13px;}'+
        'body.sv133 .small{font-size:12px;line-height:1.45;word-break:break-word;}'+
      '}'+
      '@media(max-width:390px){body.sv133 .bar{grid-template-columns:72px 1fr 30px;}body.sv133 button{font-size:15px;padding-left:8px;padding-right:8px;}body.sv133 tbody tr{grid-template-columns:32px minmax(0,1fr) 70px;}}';
    document.head.appendChild(style);
  }
  function sv133Move(ids, gridId, cls, before){
    var first=null;
    ids.forEach(function(id){if(!first&&sv133ById(id)) first=sv133ById(id)});
    if(!first) return null;
    var grid=sv133ById(gridId);
    if(!grid){
      grid=document.createElement('div');
      grid.id=gridId;
      grid.className=cls;
      var ref=before&&sv133ById(before)?sv133ById(before):first;
      if(ref&&ref.parentNode) ref.parentNode.insertBefore(grid, ref);
    }
    ids.forEach(function(id){var el=sv133ById(id); if(el) grid.appendChild(el);});
    return grid;
  }
  function sv133EnsureAliveControls(){
    var clear=sv133ById('clearSelected');
    if(clear && !sv133ById('selectAliveBtn')){
      var b=document.createElement('button');
      b.id='selectAliveBtn';
      b.type='button';
      b.className=clear.className||'btn2';
      b.textContent='勾选可用';
      b.onclick=function(){window.selectAliveCurrent&&window.selectAliveCurrent();return false};
      clear.parentNode.insertBefore(b, clear.nextSibling);
    }
    var hint=sv133ById('autoAliveWrap');
    var anchor=sv133ById('selectAliveBtn')||sv133ById('alive');
    if(!hint && anchor){
      hint=document.createElement('label');
      hint.id='autoAliveWrap';
      hint.className='sv-auto-row';
      hint.innerHTML='<input type="checkbox" id="autoSelectAlive" checked> 测活完成后自动只勾选可用节点';
      var parent=(sv133ById('sv133SelectGrid')||anchor.parentNode);
      if(parent&&parent.parentNode) parent.parentNode.insertBefore(hint, parent.nextSibling);
    }
  }
  function sv133Refine(){
    document.body.classList.add('sv133');
    sv133InstallStyle();
    sv133EnsureAliveControls();
    var unique=sv133ById('unique'), sel=sv133ById('selCount');
    var uniqueLabel=unique&&unique.closest?unique.closest('label'):(unique?unique.parentNode:null);
    if(uniqueLabel && sel && !sv133ById('sv133Meta')){
      var row=document.createElement('div'); row.id='sv133Meta'; row.className='sv-meta-row';
      uniqueLabel.parentNode.insertBefore(row, uniqueLabel); row.appendChild(uniqueLabel); row.appendChild(sel);
    }
    if(sel) sel.classList.add('sv-pill');
    sv133Move(['selectCurrent','invertCurrent','clearSelected','selectAliveBtn'], 'sv133SelectGrid', 'sv133-grid', 'autoAliveWrap');
    sv133Move(['geo','landing','alive','cleanNames','restoreNames'], 'sv133MainGrid', 'sv133-grid', null);
    sv133Move(['copyAliveBtn','copyBtn','exportBtn'], 'sv133ExportGrid', 'sv133-grid three', null);
    var clean=sv133ById('cleanNames'); if(clean) clean.textContent='清理节点名';
    var alive=sv133ById('alive'); if(alive) alive.textContent='测活';
    var selAlive=sv133ById('selectAliveBtn'); if(selAlive) selAlive.textContent='勾选可用';
  }
  window.selectAliveCurrent=function(){
    try{
      if(!DATA){st('请先拉取或分析订阅');return}
      var scope=filtered();
      var alive=scope.filter(function(n){return n&&n.aliveOK===true});
      SELECTED={};
      alive.forEach(function(n){if(n._sid)SELECTED[n._sid]=1});
      apply();
      st('已勾选当前筛选中的可用节点：'+alive.length+' / '+scope.length+' 个');
    }catch(e){st('勾选可用节点失败：'+(e&&e.message?e.message:String(e)))}
  };
  function sv133AutoEnabled(){var el=sv133ById('autoSelectAlive');return !el || el.checked}
  function sv133AutoPick(nodes){
    var alive=(nodes||[]).filter(function(n){return n&&n.aliveOK===true});
    if(sv133AutoEnabled()){
      SELECTED={};
      alive.forEach(function(n){if(n._sid)SELECTED[n._sid]=1});
    }
    return alive.length;
  }
  window.aliveTest=function(){
    try{
      if(!DATA){st('请先拉取或分析订阅');return}
      if(GEO_RUNNING){st('已有检测任务正在运行；如果刚才没有进度，请刷新页面后重试。');return}
      var nodes=operationNodes('测活');
      if(!nodes.length) return;
      var cfg=getAliveSettings(), q=aliveQS(cfg);
      GEO_RUNNING=true;
      var total=nodes.length, done=0, ok=0, fail=0, errMap={};
      st('开始对选中的 '+total+' 个节点测活：并发 '+cfg.concurrency+'，超时 '+cfg.timeout+'ms，0 / '+total);
      function finish(){
        GEO_RUNNING=false;
        var autoCount=sv133AutoPick(nodes);
        recalc(DATA);
        render(DATA);
        sv133Refine();
        var es=Object.keys(errMap).slice(0,3).map(function(k){return k+'×'+errMap[k]}).join('；');
        st('测活完成：已检测选中的 '+total+' 个节点，实际按 '+cfg.concurrency+' 并发调度，超时 '+cfg.timeout+'ms，可用 '+ok+'，不可用 '+fail+(sv133AutoEnabled()?'。已自动勾选可用节点 '+autoCount+' 个':'')+(es?'。失败原因：'+es:''));
      }
      runLimitedTasks(nodes,cfg.concurrency,function(n){
        return loadJSON('/api/availability?t='+Date.now()+q,{method:'POST',body:JSON.stringify(n),headers:{'Content-Type':'application/json;charset=utf-8'}})
          .then(function(r){
            if(r&&r.ok&&r.alive){
              n.aliveOK=true;
              n.aliveLatency=r.latency||r.totalLatency||0;
              n.aliveStatus=r.status;
              n.aliveError='';
              applyAliveName(n,cfg);
              ok++;
            }else{
              var er=aliveErr((r&&r.error)||'检测失败');
              n.aliveOK=false; n.aliveError=er; errMap[er]=(errMap[er]||0)+1; fail++;
            }
          })
          .catch(function(e){
            var er=aliveErr(e.message||String(e));
            n.aliveOK=false; n.aliveError=er; errMap[er]=(errMap[er]||0)+1; fail++;
          });
      },function(_n,_i,_err,d,t){
        if(d){done=d;recalc(DATA);apply();st('测活：'+done+' / '+t+'，并发 '+cfg.concurrency+'，可用 '+ok+'，不可用 '+fail)}
      },finish);
    }catch(e){GEO_RUNNING=false;st('测活启动失败：'+aliveErr(e&&e.message?e.message:String(e)))}
  };
hook('afterApply', sv133Refine);
window.addEventListener('DOMContentLoaded',function(){sv133Refine()});

/* ── sv135: dashboard / health / pagination ── */
var SV135_PAGE_SIZE=120;
var sv135ViewLimit=SV135_PAGE_SIZE;
var sv135LastKey='';
function sv135ById(id){return document.getElementById(id)}
function sv135ParentCard(el){return el&&el.closest?el.closest('.card'):(el?el.parentNode:null)}
function sv135AddTitle(id,text,before){
    if(!before||sv135ById(id)) return;
    var t=document.createElement('div');
    t.id=id;t.className='sv135-section-title';t.textContent=text;
    before.parentNode.insertBefore(t,before);
  }
  function sv135InstallStyle(){
    if(sv135ById('sv135Style')) return;
    var s=document.createElement('style');
    s.id='sv135Style';
    s.textContent=
      'body.sv135{--sv-card:#10243d;--sv-line:#29466f;--sv-soft:#9fb0cc;--sv-accent:#35c5ff;}'+
      'body.sv135 .wrap{max-width:980px;}'+
      'body.sv135 .hero input#url{border-color:#2f6fb2;box-shadow:0 0 0 1px rgba(53,197,255,.16),0 0 26px rgba(30,144,255,.08) inset;}'+
      'body.sv135 .hero input#url:focus{border-color:#35c5ff;box-shadow:0 0 0 3px rgba(53,197,255,.16);}'+
      'body.sv135 #cards.grid{grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-top:14px;}'+
      'body.sv135 .stat{background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.015));border-color:rgba(92,137,201,.58);}'+
      'body.sv135 .sv135-chart-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;}'+
      'body.sv135 .sv135-chart-grid>.card{margin:0;}'+
      'body.sv135 #protocols,body.sv135 #countries{max-height:280px;overflow:auto;padding-right:3px;}'+
      'body.sv135 .bar{grid-template-columns:104px 1fr 42px;min-height:22px;}'+
      'body.sv135 .track{height:12px;background:rgba(73,102,148,.38);}'+
      'body.sv135 .fill{height:12px;background:linear-gradient(90deg,#338fff,#23d1e9);border-radius:999px;}'+
      'body.sv135 #sv135Health .health-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:6px 0 12px;}'+
      'body.sv135 #sv135Health .health-cell{padding:11px 12px;border:1px solid rgba(92,137,201,.45);border-radius:16px;background:rgba(255,255,255,.025);}'+
      'body.sv135 #sv135Health .health-cell span{display:block;color:#9fb0cc;font-size:13px;font-weight:700;}'+
      'body.sv135 #sv135Health .health-cell b{display:block;color:#f2f7ff;font-size:28px;line-height:1.1;margin-top:3px;}'+
      'body.sv135 .sv135-section-title{color:#9fb0cc;font-size:13px;font-weight:900;letter-spacing:.04em;margin:15px 0 8px;}'+
      'body.sv135 .sv133-grid,body.sv135 .sv133-grid.three,body.sv135 .sv-mini-grid,body.sv135 .sv-op-grid{grid-template-columns:repeat(auto-fit,minmax(136px,1fr))!important;gap:10px!important;margin:10px 0 12px!important;}'+
      'body.sv135 .sv133-grid button,body.sv135 .sv-mini-grid button,body.sv135 .sv-op-grid button,body.sv135 .toolbar button{min-height:48px!important;white-space:normal!important;word-break:keep-all!important;overflow-wrap:normal!important;line-height:1.25!important;}'+
      'body.sv135 #alive{background:linear-gradient(180deg,#3187f7,#2167ca)!important;color:#fff!important;}'+
      'body.sv135 .toolhint{margin:8px 0 12px;font-size:13px;line-height:1.55;}'+
      'body.sv135 .rulebox{margin-top:10px;}'+
      'body.sv135 .exportbar{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(96px,.45fr) minmax(96px,.45fr);gap:10px;align-items:stretch;}'+
      'body.sv135 #sv133ExportGrid{grid-template-columns:repeat(auto-fit,minmax(126px,1fr))!important;}'+
      'body.sv135 .sv135-empty{padding:22px 14px;text-align:center;color:#9fb0cc;line-height:1.6;border:1px dashed rgba(92,137,201,.55);border-radius:18px;background:rgba(255,255,255,.018);}'+
      'body.sv135 .sv135-more-row td{text-align:center!important;padding:14px 0!important;}'+
      'body.sv135 .sv135-more{width:min(360px,100%);margin:0 auto!important;}'+
      'body.sv135 table{table-layout:fixed;}'+
      'body.sv135 th:nth-child(1){width:48px}body.sv135 th:nth-child(2){width:48px}body.sv135 th:nth-child(4){width:112px}body.sv135 th:nth-child(6){width:86px}'+
      'body.sv135 .tag{white-space:nowrap;word-break:keep-all;max-width:104px;overflow:hidden;text-overflow:ellipsis;text-align:center;}'+
      '@media(max-width:820px){body.sv135 .sv135-chart-grid{grid-template-columns:1fr;}body.sv135 #cards.grid{grid-template-columns:repeat(2,minmax(0,1fr));}body.sv135 #cards .stat:last-child{grid-column:span 2;}}'+
      '@media(max-width:760px){body.sv135 .exportbar{grid-template-columns:1fr;}body.sv135 .filters{grid-template-columns:1fr 1fr!important;}body.sv135 table,body.sv135 thead,body.sv135 tbody{display:block;width:100%;}body.sv135 thead{display:none;}body.sv135 tbody tr{display:grid!important;grid-template-columns:38px minmax(0,1fr) 92px!important;grid-template-areas:"check name proto" "check name port"!important;gap:4px 10px;align-items:center;border-top:1px solid #263f66;padding:12px 0;}body.sv135 tbody td{display:block;border:0!important;padding:0!important;min-width:0;}body.sv135 tbody td:nth-child(1){grid-area:check;}body.sv135 tbody td:nth-child(2){display:none!important;}body.sv135 tbody td:nth-child(3){grid-area:name;font-size:15px;line-height:1.36;word-break:break-word;}body.sv135 tbody td:nth-child(4){grid-area:proto;text-align:right;}body.sv135 tbody td:nth-child(5){display:none!important;}body.sv135 tbody td:nth-child(6){grid-area:port;text-align:right;color:#eaf2ff;font-weight:900;font-size:16px;}body.sv135 .rowchk{width:24px!important;height:24px!important;}body.sv135 .tag{max-width:90px;padding:5px 8px;font-size:13px;}body.sv135 .small{font-size:12px;line-height:1.45;}}'+
      '@media(max-width:390px){body.sv135 .sv133-grid,body.sv135 .sv133-grid.three,body.sv135 .sv-mini-grid,body.sv135 .sv-op-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;}body.sv135 tbody tr{grid-template-columns:36px minmax(0,1fr) 86px!important;}body.sv135 button{font-size:15px!important;padding-left:8px!important;padding-right:8px!important;}}';
    document.head.appendChild(s);
  }
  function sv135EnsureDashboard(){
    document.body.classList.add('sv135');sv135InstallStyle();
    var p=sv135ParentCard(sv135ById('protocols')), c=sv135ParentCard(sv135ById('countries'));
    if(p&&c&&!sv135ById('sv135Charts')){
      var grid=document.createElement('div');grid.id='sv135Charts';grid.className='sv135-chart-grid';
      p.parentNode.insertBefore(grid,p);grid.appendChild(p);grid.appendChild(c);
      var h=document.createElement('div');h.id='sv135Health';h.className='card';h.innerHTML='<h2>节点健康状况</h2><div class="health-grid"><div class="health-cell"><span>可用</span><b id="hAlive">0</b></div><div class="health-cell"><span>不可用</span><b id="hDead">0</b></div><div class="health-cell"><span>未测</span><b id="hUntested">0</b></div><div class="health-cell"><span>当前筛选</span><b id="hScope">0</b></div></div><div id="hBars" class="small muted">测活后这里会显示可用比例。</div>';
      grid.appendChild(h);
    }
  }
  function health(nodes){var a=0,d=0,u=0;(nodes||[]).forEach(function(n){if(n.aliveOK===true)a++;else if(n.aliveOK===false)d++;else u++});return{alive:a,dead:d,untested:u,total:(nodes||[]).length}}
  function sv135UpdateHealth(nodes){sv135EnsureDashboard();var h=health(nodes||filtered());[['hAlive',h.alive],['hDead',h.dead],['hUntested',h.untested],['hScope',h.total]].forEach(function(x){var el=sv135ById(x[0]);if(el)el.textContent=x[1]});var b=sv135ById('hBars');if(b){var p=h.total?Math.round(h.alive/h.total*100):0;b.innerHTML='<div class="bar"><div>可用率</div><div class="track"><div class="fill" style="width:'+p+'%"></div></div><b>'+p+'%</b></div>';}}
  function sv135Refine(){
    sv135EnsureDashboard();
    var selectGrid=sv135ById('sv133SelectGrid')||sv135ById('sv132SelectGrid');
    var mainGrid=sv135ById('sv133MainGrid')||sv135ById('sv132MainOps');
    var exportGrid=sv135ById('sv133ExportGrid')||sv135ById('sv132ExportGrid');
    sv135AddTitle('sv135SelectTitle','选择范围',selectGrid);
    sv135AddTitle('sv135ActionTitle','常用操作',mainGrid);
    var firstRule=document.querySelector('.rulebox');
    sv135AddTitle('sv135AdvancedTitle','高级设置',firstRule);
    sv135AddTitle('sv135ExportTitle','导出与复制',exportGrid||sv135ById('exportType'));
    var alive=sv135ById('alive');if(alive)alive.textContent='测活';
    var geo=sv135ById('geo');if(geo)geo.textContent='GeoIP补全';
    var landing=sv135ById('landing');if(landing)landing.textContent='落地检测';
    var clean=sv135ById('cleanNames');if(clean)clean.textContent='清理节点名';
    var copyAlive=sv135ById('copyAliveBtn');if(copyAlive)copyAlive.textContent='复制可用';
    if(!DATA){var tb=sv135ById('tbody');if(tb)tb.innerHTML='<tr><td colspan="6"><div class="sv135-empty">先输入订阅 URL 或粘贴订阅内容，再点击分析。<br>分析后可筛选、勾选节点，再执行测活、落地检测、清理和复制。</div></td></tr>';}
  }
  function keyOf(a){var q=(sv135ById('q')&&sv135ById('q').value)||'',pf=(sv135ById('pf')&&sv135ById('pf').value)||'',cf=(sv135ById('cf')&&sv135ById('cf').value)||'',u=(sv135ById('unique')&&sv135ById('unique').checked)?'1':'0';return [a.length,q,pf,cf,u].join('|')}
  function row(n,i){var chk=SELECTED[n._sid]?' checked':'';return '<tr><td><input type="checkbox" class="rowchk" data-sid="'+esc(n._sid||'')+'" onchange="window.toggleSelect&&window.toggleSelect(this.dataset.sid,this.checked)"'+chk+'></td><td>'+(i+1)+'</td><td>'+esc(n.name)+'<div class="small">'+meta(n)+'</div></td><td><span class="tag" title="'+esc(n.protocol)+'">'+esc(n.protocol)+'</span></td><td>'+esc(n.server)+'</td><td>'+esc(n.port)+'</td></tr>'}
window.sv135LoadMore=function(){sv135ViewLimit+=SV135_PAGE_SIZE;apply();};
var _sv135BaseApply=apply;
apply=function(){
  try{
    if(!DATA){sv135Refine();emit('afterApply',filtered());return}
    var a=filtered(),sc=selectedCount(),k=keyOf(a);if(k!==sv135LastKey){sv135ViewLimit=SV135_PAGE_SIZE;sv135LastKey=k}
    var c=sv135ById('count');if(c)c.textContent='当前显示 '+a.length+' / '+((DATA&&DATA.summary&&DATA.summary.total)||0)+' 个节点，已选 '+sc+' 个';
    updateSelectUI();
    var show=a.slice(0,sv135ViewLimit), html=show.map(row).join('');
    if(a.length>show.length){html+='<tr class="sv135-more-row"><td colspan="6"><button type="button" class="btn2 sv135-more" onclick="window.sv135LoadMore&&window.sv135LoadMore();return false">继续显示 '+Math.min(SV135_PAGE_SIZE,a.length-show.length)+' 个，剩余 '+(a.length-show.length)+' 个</button></td></tr>'}
    if(!html) html='<tr><td colspan="6" class="muted">当前筛选没有节点</td></tr>';
    var tb=sv135ById('tbody');if(tb)tb.innerHTML=html;
    sv135UpdateHealth(a);sv135Refine();emit('afterApply',a);
  }catch(e){try{_sv135BaseApply()}catch(_){ } console.log(e)}
};
var _sv135BaseRender=render;
render=function(d){_sv135BaseRender(d);sv135EnsureDashboard();sv135UpdateHealth(filtered());sv135Refine();};
window.addEventListener('DOMContentLoaded',function(){sv135Refine();sv135UpdateHealth([]);});

/* ── sv136: gold theme / quickCopy / drag / autoParse ── */
  var SV136_PAGE_SIZE=120;
  var sv136ViewLimit=SV136_PAGE_SIZE;
  var sv136LastKey='';
  function sv136ById(id){return document.getElementById(id)}
  function closestCard(el){return el&&el.closest?el.closest('.card'):(el?el.parentNode:null)}
  function addMeta(name,content){
    if(document.querySelector('meta[name="'+name+'"]')) return;
    var m=document.createElement('meta');m.name=name;m.content=content;document.head.appendChild(m);
  }
  function sv136PulseButton(btn,okText){
    if(!btn)return;
    var old=btn.textContent;
    btn.textContent=okText||'✓ SUCCESS';
    btn.classList.add('sv136-success');
    setTimeout(function(){btn.textContent=old;btn.classList.remove('sv136-success')},1500);
  }
  function installStyle(){
    if(sv136ById('sv136Style'))return;
    var stl=document.createElement('style');stl.id='sv136Style';
    stl.textContent=
      'body.sv136{--bg-main:#0B0C10;--bg-card:#171921;--bg-card-2:#1E212B;--color-gold:#F1B813;--color-gold-2:#D4A00E;--color-gold-dim:rgba(241,184,19,.12);--border-color:#262938;--text-main:#fff;--text-soft:#94A3B8;--text-dim:#64748B;margin:0!important;background:radial-gradient(circle at 50% -10%,rgba(241,184,19,.12),transparent 34%),#0B0C10!important;color:var(--text-soft)!important;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;}'+
      'body.sv136 .wrap{max-width:1080px!important;margin:0 auto!important;padding:calc(22px + env(safe-area-inset-top)) 18px calc(58px + env(safe-area-inset-bottom))!important;}'+
      'body.sv136 .hero,body.sv136 .card,body.sv136 .rulebox{background:rgba(23,25,33,.92)!important;border:1px solid var(--border-color)!important;border-radius:22px!important;box-shadow:0 18px 50px rgba(0,0,0,.30)!important;}'+
      'body.sv136 .hero{position:relative;overflow:hidden;padding:24px!important;}body.sv136 .hero:before{content:"";position:absolute;inset:0 0 auto 0;height:3px;background:linear-gradient(90deg,transparent,var(--color-gold),transparent);opacity:.85;}'+
      'body.sv136 h1,body.sv136 h2{color:var(--text-main)!important;letter-spacing:-.02em;}body.sv136 h1{font-size:30px!important;margin:6px 0 10px!important;}body.sv136 h2{font-size:21px!important;margin-bottom:14px!important;}'+
      'body.sv136 .small,body.sv136 .muted,body.sv136 .toolhint{color:var(--text-soft)!important;}body.sv136 .toolhint{line-height:1.7!important;font-size:13px!important;margin:9px 0 13px!important;}'+
      'body.sv136 input,body.sv136 textarea,body.sv136 select{background:#0F1118!important;border:1px solid var(--border-color)!important;color:var(--text-main)!important;border-radius:14px!important;padding:13px 15px!important;transition:border-color .22s ease,box-shadow .22s ease,background .22s ease!important;}'+
      'body.sv136 input:focus,body.sv136 textarea:focus,body.sv136 select:focus{border-color:var(--color-gold)!important;box-shadow:0 0 0 3px rgba(241,184,19,.15)!important;outline:none!important;background:#11141D!important;}'+
      'body.sv136 input::placeholder,body.sv136 textarea::placeholder{color:#64748B!important;}'+
      'body.sv136 button{background:#202432!important;color:#fff!important;border:1px solid rgba(255,255,255,.04)!important;border-radius:14px!important;box-shadow:none!important;font-weight:800!important;letter-spacing:.01em!important;transition:transform .18s ease,box-shadow .18s ease,background .18s ease,color .18s ease!important;}'+
      'body.sv136 button:hover{transform:translateY(-1px)!important;box-shadow:0 10px 24px rgba(0,0,0,.28)!important;}body.sv136 #pull,body.sv136 #alive,body.sv136 .sv136-primary{background:linear-gradient(135deg,var(--color-gold),var(--color-gold-2))!important;color:#0B0C10!important;box-shadow:0 8px 24px rgba(241,184,19,.18)!important;}body.sv136 .sv136-success{background:linear-gradient(135deg,#2dd4bf,#10b981)!important;color:#07110f!important;}'+
      'body.sv136 .status{background:#0F1118!important;border-color:var(--border-color)!important;border-radius:16px!important;color:#D8DEE9!important;}'+
      'body.sv136 #cards.grid{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:14px!important;margin:22px 0 16px!important;}'+
      'body.sv136 .stat{background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.012))!important;border:1px solid var(--border-color)!important;border-radius:18px!important;padding:18px!important;text-align:left!important;}'+
      'body.sv136 .stat span{display:block;color:var(--text-dim)!important;font-size:12px!important;text-transform:uppercase;letter-spacing:.05em;font-weight:800!important;}body.sv136 .stat b{display:block;color:var(--color-gold)!important;font-size:32px!important;line-height:1.1;margin-top:8px!important;}'+
      'body.sv136 .sv135-chart-grid{display:grid!important;grid-template-columns:1fr 1fr 1fr!important;gap:16px!important;margin:8px 0 18px!important;}body.sv136 .sv135-chart-grid>.card{margin:0!important;}'+
      'body.sv136 #protocols,body.sv136 #countries{max-height:310px;overflow:auto;padding-right:3px;}body.sv136 .bar{display:grid!important;grid-template-columns:minmax(76px,120px) minmax(90px,1fr) 38px!important;align-items:center!important;gap:10px!important;margin:11px 0!important;min-height:24px!important;}'+
      'body.sv136 .track{height:11px!important;background:#262938!important;border-radius:999px!important;overflow:hidden!important;}body.sv136 .fill{height:11px!important;background:linear-gradient(90deg,var(--color-gold),#F6D36C)!important;border-radius:999px!important;}body.sv136 .bar b{color:#E5E7EB!important;}'+
      'body.sv136 #sv135Health .health-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:6px 0 12px;}body.sv136 #sv135Health .health-cell{padding:13px 12px;border:1px solid var(--border-color);border-radius:16px;background:#0F1118;}body.sv136 #sv135Health .health-cell span{display:block;color:var(--text-dim);font-size:12px;font-weight:800;}body.sv136 #sv135Health .health-cell b{display:block;color:var(--color-gold);font-size:29px;line-height:1.05;margin-top:5px;}'+
      'body.sv136 .sv135-section-title,body.sv136 .sv136-section-title{color:var(--color-gold)!important;font-size:12px!important;font-weight:900!important;letter-spacing:.08em!important;text-transform:uppercase!important;margin:18px 0 9px!important;}'+
      'body.sv136 .sv133-grid,body.sv136 .sv133-grid.three,body.sv136 .sv-mini-grid,body.sv136 .sv-op-grid,body.sv136 .toolbar{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(138px,1fr))!important;gap:10px!important;margin:10px 0 14px!important;}'+
      'body.sv136 .sv133-grid button,body.sv136 .sv-mini-grid button,body.sv136 .sv-op-grid button,body.sv136 .toolbar button{min-height:48px!important;margin:0!important;padding:12px 10px!important;white-space:normal!important;word-break:keep-all!important;line-height:1.28!important;}'+
      'body.sv136 .sv-meta-row{background:#0F1118;border:1px solid var(--border-color);border-radius:16px;padding:10px 12px;}body.sv136 .sv-pill{background:var(--color-gold-dim)!important;color:var(--color-gold)!important;border:1px solid rgba(241,184,19,.22)!important;}'+
      'body.sv136 .rowchk{accent-color:var(--color-gold)!important;width:23px!important;height:23px!important;}body.sv136 input[type="checkbox"]{accent-color:var(--color-gold)!important;}'+
      'body.sv136 details summary{color:#fff!important;list-style:none;}body.sv136 details summary::-webkit-details-marker{display:none;}body.sv136 details summary:before{content:"▸";color:var(--color-gold);margin-right:8px;}body.sv136 details[open] summary:before{content:"▾";}'+
      'body.sv136 .exportbar{display:grid!important;grid-template-columns:minmax(0,1.35fr) minmax(94px,.45fr) minmax(94px,.45fr)!important;gap:10px!important;align-items:stretch!important;}body.sv136 #sv133ExportGrid{grid-template-columns:repeat(auto-fit,minmax(124px,1fr))!important;}'+
      'body.sv136 table{width:100%!important;border-collapse:collapse!important;table-layout:fixed!important;background:var(--bg-card)!important;border:1px solid var(--border-color)!important;border-radius:18px!important;overflow:hidden!important;margin-top:18px!important;}'+
      'body.sv136 th{background:var(--bg-card-2)!important;color:#fff!important;font-size:13px!important;font-weight:800!important;letter-spacing:.04em!important;text-align:left!important;padding:14px 14px!important;border-bottom:1px solid var(--border-color)!important;border-top:0!important;}'+
      'body.sv136 td{padding:15px 14px!important;color:var(--text-soft)!important;border-top:0!important;border-bottom:1px solid #1E212B!important;word-break:normal!important;vertical-align:middle!important;}body.sv136 tr:hover td{background:rgba(255,255,255,.025)!important;color:#fff!important;}'+
      'body.sv136 th:nth-child(1){width:48px!important}body.sv136 th:nth-child(2){width:54px!important}body.sv136 th:nth-child(4){width:104px!important}body.sv136 th:nth-child(6){width:84px!important}body.sv136 td.sv136-server{max-width:240px!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;color:#7F8EA3!important;}body.sv136 td.sv136-port{color:#fff!important;font-weight:800!important;}'+
      'body.sv136 .tag{display:inline-flex!important;align-items:center!important;justify-content:center!important;background:var(--color-gold-dim)!important;color:var(--color-gold)!important;border:1px solid rgba(241,184,19,.22)!important;border-radius:999px!important;padding:5px 10px!important;font-size:12px!important;font-weight:900!important;text-transform:uppercase!important;white-space:nowrap!important;max-width:96px!important;overflow:hidden!important;text-overflow:ellipsis!important;}'+
      'body.sv136 .sv136-empty{padding:26px 14px;text-align:center;color:var(--text-soft);line-height:1.7;border:1px dashed rgba(241,184,19,.28);border-radius:18px;background:#0F1118;}body.sv136 .sv135-more-row td,body.sv136 .sv136-more-row td{text-align:center!important;padding:16px!important;}body.sv136 .sv136-more{width:min(360px,100%);margin:0 auto!important;}'+
      'body.sv136 .sv136-quick-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0 0;}body.sv136 .sv136-dragging{box-shadow:0 0 0 3px rgba(241,184,19,.2),0 24px 60px rgba(0,0,0,.45)!important;border-color:var(--color-gold)!important;}'+
      '@media(max-width:860px){body.sv136 .sv135-chart-grid{grid-template-columns:1fr!important;}body.sv136 #cards.grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;}body.sv136 #cards .stat:last-child{grid-column:span 2;}body.sv136 .wrap{padding-left:14px!important;padding-right:14px!important;}}'+
      '@media(max-width:720px){body.sv136 .exportbar{grid-template-columns:1fr!important;}body.sv136 .filters{grid-template-columns:1fr 1fr!important;}body.sv136 .sv136-quick-row{grid-template-columns:1fr;}body.sv136 table,body.sv136 thead,body.sv136 tbody{display:block;width:100%;}body.sv136 thead{display:none;}body.sv136 tbody tr{display:grid!important;grid-template-columns:36px minmax(0,1fr) 92px!important;grid-template-areas:"check name proto" "check server port"!important;gap:6px 10px;align-items:center;border-bottom:1px solid #1E212B!important;padding:13px 0!important;}body.sv136 tbody td{display:block!important;border:0!important;padding:0!important;min-width:0!important;}body.sv136 tbody td:nth-child(1){grid-area:check;}body.sv136 tbody td:nth-child(2){display:none!important;}body.sv136 tbody td:nth-child(3){grid-area:name;color:#fff!important;font-size:15px!important;line-height:1.35!important;word-break:break-word!important;}body.sv136 tbody td:nth-child(4){grid-area:proto;text-align:right!important;}body.sv136 tbody td:nth-child(5){grid-area:server;display:block!important;max-width:none!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;font-size:12px!important;color:#64748B!important;}body.sv136 tbody td:nth-child(6){grid-area:port;text-align:right!important;color:#fff!important;font-size:15px!important;font-weight:900!important;}body.sv136 .tag{max-width:90px!important;font-size:12px!important;padding:5px 9px!important;}body.sv136 .small{font-size:12px!important;line-height:1.42!important;}}'+
      '@media(max-width:390px){body.sv136 #cards.grid{gap:10px!important;}body.sv136 .stat{padding:15px!important;}body.sv136 .stat b{font-size:28px!important;}body.sv136 .sv133-grid,body.sv136 .sv133-grid.three,body.sv136 .sv-mini-grid,body.sv136 .sv-op-grid,body.sv136 .toolbar{grid-template-columns:repeat(2,minmax(0,1fr))!important;}body.sv136 tbody tr{grid-template-columns:34px minmax(0,1fr) 84px!important;}body.sv136 button{font-size:15px!important;padding-left:8px!important;padding-right:8px!important;}}';
    document.head.appendChild(stl);
  }
  function sv136EnsureDashboard(){
    document.body.classList.add('sv136');installStyles();
    addMeta('apple-mobile-web-app-capable','yes');addMeta('apple-mobile-web-app-status-bar-style','black-translucent');addMeta('apple-mobile-web-app-title','SubViz');
    var p=closestCard(sv136ById('protocols')),c=closestCard(sv136ById('countries'));
    if(p&&c&&!sv136ById('sv135Charts')){var grid=document.createElement('div');grid.id='sv135Charts';grid.className='sv135-chart-grid';p.parentNode.insertBefore(grid,p);grid.appendChild(p);grid.appendChild(c);var h=document.createElement('div');h.id='sv135Health';h.className='card';h.innerHTML='<h2>节点健康状况</h2><div class="health-grid"><div class="health-cell"><span>可用</span><b id="hAlive">0</b></div><div class="health-cell"><span>不可用</span><b id="hDead">0</b></div><div class="health-cell"><span>未测</span><b id="hUntested">0</b></div><div class="health-cell"><span>当前筛选</span><b id="hScope">0</b></div></div><div id="hBars" class="small muted">测活后这里会显示可用比例。</div>';grid.appendChild(h)}
  }
  function health(nodes){var a=0,d=0,u=0;(nodes||[]).forEach(function(n){if(n.aliveOK===true)a++;else if(n.aliveOK===false)d++;else u++});return{alive:a,dead:d,untested:u,total:(nodes||[]).length}}
  function sv136UpdateHealth(nodes){sv136EnsureDashboard();var h=health(nodes||[]);[['hAlive',h.alive],['hDead',h.dead],['hUntested',h.untested],['hScope',h.total]].forEach(function(x){var el=sv136ById(x[0]);if(el)el.textContent=x[1]});var b=sv136ById('hBars');if(b){var p=h.total?Math.round(h.alive/h.total*100):0;b.innerHTML='<div class="bar"><div>可用率</div><div class="track"><div class="fill" style="width:'+p+'%"></div></div><b>'+p+'%</b></div>'}}
  function sv136Refine(){
    sv136EnsureDashboard();
    /* Section titles are added by sv135. Keep sv136 focused on visual polish to avoid duplicate labels. */
    var alive=sv136ById('alive');if(alive)alive.textContent='测活';
    var geo=sv136ById('geo');if(geo)geo.textContent='GeoIP 补全';
    var landing=sv136ById('landing');if(landing)landing.textContent='落地检测';
    var clean=sv136ById('cleanNames');if(clean)clean.textContent='清理节点名';
    var copyAlive=sv136ById('copyAliveBtn');if(copyAlive)copyAlive.textContent='复制可用';
    if(!DATA){var tb=sv136ById('tbody');if(tb)tb.innerHTML='<tr><td colspan="6"><div class="sv136-empty">先输入订阅 URL，或直接粘贴 / 拖入订阅内容。<br>分析后可筛选、勾选节点，再执行测活、落地检测、清理和复制。</div></td></tr>'}
  }
  function keyOf(a){var q=(sv136ById('q')&&sv136ById('q').value)||'',pf=(sv136ById('pf')&&sv136ById('pf').value)||'',cf=(sv136ById('cf')&&sv136ById('cf').value)||'',u=(sv136ById('unique')&&sv136ById('unique').checked)?'1':'0';return [a.length,q,pf,cf,u].join('|')}
  function row(n,i){var chk=SELECTED[n._sid]?' checked':'';return '<tr><td><input type="checkbox" class="rowchk" data-sid="'+esc(n._sid||'')+'" onchange="window.toggleSelect&&window.toggleSelect(this.dataset.sid,this.checked)"'+chk+'></td><td>'+(i+1)+'</td><td>'+esc(n.name)+'<div class="small">'+meta(n)+'</div></td><td><span class="tag" title="'+esc(n.protocol)+'">'+esc(n.protocol)+'</span></td><td class="sv136-server" title="'+esc(n.server||'')+'">'+esc(n.server)+'</td><td class="sv136-port">'+esc(n.port)+'</td></tr>'}
  window.sv136LoadMore=function(){sv136ViewLimit+=SV136_PAGE_SIZE;apply()};
var _sv136BaseApply=apply;
apply=function(){
  try{
    if(!DATA){sv136Refine();sv136UpdateHealth([]);emit('afterApply',filtered());return}
    var a=filtered(),sc=selectedCount(),k=keyOf(a);if(k!==sv136LastKey){sv136ViewLimit=SV136_PAGE_SIZE;sv136LastKey=k}
    var c=sv136ById('count');if(c)c.textContent='当前显示 '+a.length+' / '+((DATA&&DATA.summary&&DATA.summary.total)||0)+' 个节点，已选 '+sc+' 个';
    updateSelectUI();
    var show=a.slice(0,sv136ViewLimit),html=show.map(row).join('');
    if(a.length>show.length){html+='<tr class="sv136-more-row"><td colspan="6"><button type="button" class="btn2 sv136-more" onclick="window.sv136LoadMore&&window.sv136LoadMore();return false">继续显示 '+Math.min(SV136_PAGE_SIZE,a.length-show.length)+' 个，剩余 '+(a.length-show.length)+' 个</button></td></tr>'}
    if(!html)html='<tr><td colspan="6" class="muted">当前筛选没有节点</td></tr>';
    var tb=sv136ById('tbody');if(tb)tb.innerHTML=html;
    sv136UpdateHealth(a);sv136Refine();emit('afterApply',a);
  }catch(e){try{_sv136BaseApply()}catch(_){ }console.log(e)}
};
var _sv136BaseRender=render;
render=function(d){_sv136BaseRender(d);sv136EnsureDashboard();sv136UpdateHealth(filtered());sv136Refine()};
function sv136AutoAnalyzeText(){var raw=sv136ById('raw');if(!raw)return;var t=String(raw.value||'').trim();if(t.length<20)return;if(/^(https?:\/\/\S+)$/i.test(t)){var u=sv136ById('url');if(u){u.value=t;analyzeURL();return}}analyzeText()}
function sv136InstallAutoParse(){
  var raw=sv136ById('raw'),url=sv136ById('url'),hero=document.querySelector('.hero');
  if(url&&!url._sv136Paste){url._sv136Paste=1;url.addEventListener('paste',function(){setTimeout(function(){var v=String(url.value||'').trim();if(/^https?:\/\//i.test(v))analyzeURL()},80)});url.addEventListener('drop',function(e){try{e.preventDefault();var txt=e.dataTransfer.getData('text');if(txt){url.value=txt.trim();if(/^https?:\/\//i.test(url.value))analyzeURL()}}catch(_){}})}
  if(raw&&!raw._sv136Paste){raw._sv136Paste=1;raw.addEventListener('paste',function(){setTimeout(sv136AutoAnalyzeText,120)});raw.addEventListener('drop',function(e){try{e.preventDefault();var f=e.dataTransfer.files&&e.dataTransfer.files[0];if(f){var r=new FileReader();r.onload=function(){raw.value=String(r.result||'');sv136AutoAnalyzeText()};r.readAsText(f);return}var txt=e.dataTransfer.getData('text');if(txt){raw.value=txt;sv136AutoAnalyzeText()}}catch(err){st('拖拽读取失败：'+(err.message||err))}})}
  if(hero&&!hero._sv136Drop){hero._sv136Drop=1;['dragenter','dragover'].forEach(function(ev){hero.addEventListener(ev,function(e){e.preventDefault();hero.classList.add('sv136-dragging')})});['dragleave','drop'].forEach(function(ev){hero.addEventListener(ev,function(){hero.classList.remove('sv136-dragging')})})}
}
hook('afterApply', function(){ var b=sv136ById('copyBtn'); if(b){var txt=(sv136ById('status')&&sv136ById('status').textContent)||''; if(txt.indexOf('已复制')>=0)sv136PulseButton(b)} });
window.addEventListener('DOMContentLoaded',function(){sv136EnsureDashboard();sv136InstallAutoParse();sv136Refine();sv136UpdateHealth(DATA?filtered():[])});

/* ── Gist: token / upload panel ── */
function gistById(id){return document.getElementById(id)}
function gistVal(id){var el=gistById(id);return el?String(el.value||'').trim():''}
function gistChecked(id){var el=gistById(id);return !!(el&&el.checked)}
function gistDefaultFile(){var t=gistById('exportType')?gistById('exportType').value:'clash';if(t==='json')return 'subviz-backup.json';if(t==='uri')return 'subscription.txt';if(t==='uri64')return 'subscription-base64.txt';return 'mihomo.yaml'}
function gistSetTokenStatus(has, text, state){var el=gistById('gistTokenStatus'),msg=text||(has?'已保存 Token':'未配置');if(el){el.value=msg;el.textContent=msg;el.dataset.status=state||(has?'ok':'empty')}}
function gistPost(path, body){return loadJSON(path+'?t='+Date.now(),{method:'POST',body:JSON.stringify(body||{}),headers:{'Content-Type':'application/json;charset=utf-8'}})}
function gistRefreshStatus(){gistSetTokenStatus(false,'读取中…','loading');return loadJSON('/api/gist-token/status?t='+Date.now()).then(function(r){gistSetTokenStatus(!!(r&&r.hasToken), r&&r.hasToken?'已保存 Token':'未配置',r&&r.hasToken?'saved':'empty');return r}).catch(function(e){gistSetTokenStatus(false,'Token 状态读取失败','error');throw e})}
function getGistSettings(){return {token:gistVal('gistToken'),gistName:gistVal('gistName'),filename:gistVal('gistFilename')||gistDefaultFile(),gistId:gistVal('gistId'),public:gistChecked('gistPublic'),format:gistById('exportType')?gistById('exportType').value:'clash'}}
function gistUploadCurrent(){try{var p=buildExportPayload();var cfg=getGistSettings();if(!cfg.gistName&&!cfg.gistId){st('请填写 Gist 名称，或指定 Gist ID');return}if(!cfg.filename){st('请填写文件名');return}st('正在上传 '+p.label+' 到 Gist：'+p.count+' 个节点…');gistPost('/api/gist-upload',{token:cfg.token,gistName:cfg.gistName,filename:cfg.filename,gistId:cfg.gistId,public:cfg.public,format:cfg.format,content:p.text}).then(function(r){if(!r.ok)throw new Error(r.error||'上传失败');if(gistById('gistRawUrl'))gistById('gistRawUrl').value=r.rawUrl||'';if(gistById('gistPageUrl'))gistById('gistPageUrl').value=r.url||'';st('Gist '+(r.action==='updated'?'已更新':'已创建')+'：'+(r.rawUrl||r.url||''));}).catch(function(e){st('上传 Gist 失败：'+(e.message||e))})}catch(e){st('上传 Gist 失败：'+(e.message||e))}}
function gistEnsurePanel(){
    if(gistById('svGistBox')) return;
    var table=document.querySelector('table');
    var anchor=gistById('sv133ExportGrid')||gistById('sv132ExportGrid')||document.querySelector('.exportbar')||table;
    if(!anchor||!anchor.parentNode) return;
    var box=document.createElement('div');
    box.id='svGistBox';
    box.className='rulebox sv-gist-box';
    box.innerHTML='<details><summary>上传到 Gist / 发布远程订阅</summary>'+ 
      '<div class="toolhint">上传范围与当前导出一致：只上传已勾选节点。Token 保存在 Surge 持久存储，前端只显示是否已保存，不回显明文。</div>'+ 
      '<div class="rulegrid">'+
      '<div><div class="small">Token 状态</div><input id="gistTokenStatus" value="读取中…" readonly></div>'+ 
      '<div><div class="small">GitHub Token（留空则使用已保存 Token）</div><input id="gistToken" type="password" placeholder="github_pat_xxx / ghp_xxx"></div>'+ 
      '<div><div class="small">Gist 名称 / 描述</div><input id="gistName" value="subviz-share"></div>'+ 
      '<div><div class="small">文件名</div><input id="gistFilename" value="'+gistDefaultFile()+'"></div>'+ 
      '<div><div class="small">指定 Gist ID（可选；留空则按 Gist 名称查找/创建）</div><input id="gistId" placeholder="可选：已有 Gist ID"></div>'+ 
      '<label class="small" style="display:flex;gap:8px;align-items:center;margin-top:30px"><input id="gistPublic" type="checkbox" style="width:22px;height:22px"> 创建公开 Gist（默认 Secret Gist）</label>'+ 
      '</div>'+ 
      '<div class="rulebtns" style="margin-top:10px"><button type="button" id="gistSaveToken" class="btn2">保存/更新 Token</button><button type="button" id="gistTestToken" class="btn2">测试 Token</button></div>'+ 
      '<div class="rulebtns" style="margin-top:10px"><button type="button" id="gistClearToken" class="btn2">清除已保存 Token</button><button type="button" id="gistUpload" class="btn2">上传当前导出到 Gist</button></div>'+ 
      '<div class="rulegrid" style="margin-top:10px"><div><div class="small">Raw URL</div><input id="gistRawUrl" readonly placeholder="上传成功后显示可订阅 raw_url"></div><div><div class="small">Gist 页面</div><input id="gistPageUrl" readonly placeholder="上传成功后显示 Gist 页面地址"></div></div>'+ 
      '<button type="button" id="gistCopyRaw" class="btn2">复制 Raw URL</button>'+ 
      '<div class="toolhint">提醒：Gist 内容就是代理订阅，包含节点密码/UUID/SNI/Host/path 等敏感信息。Secret Gist 不是加密，只是不会公开列出，拿到链接的人仍可访问。</div>'+ 
      '</details>';
    if(table&&table.parentNode===anchor.parentNode) anchor.parentNode.insertBefore(box, table); else anchor.parentNode.insertBefore(box, anchor.nextSibling);
    bindGistPanel();
    gistRefreshStatus().catch(function(){});
  }
  function bindGistPanel(){
    var exportType=gistById('exportType'), file=gistById('gistFilename');
    if(exportType&&file&&!file._svGistBound){file._svGistBound=1;exportType.addEventListener('change',function(){if(!String(file.value||'').trim()||/^(mihomo\.yaml|subscription\.txt|subscription-base64\.txt|subviz-backup\.json)$/.test(String(file.value||'')))file.value=gistDefaultFile()})}
    var save=gistById('gistSaveToken');if(save&&!save._svGistBound){save._svGistBound=1;save.onclick=function(){var token=gistVal('gistToken');if(!token){st('请先粘贴新的 GitHub Token');return}st('正在保存 GitHub Token 到 Surge…');gistPost('/api/gist-token/save',{token:token}).then(function(r){if(!r.ok)throw new Error(r.error||'保存失败');gistById('gistToken').value='';gistSetTokenStatus(true,'已保存 / 可访问 Gist API','saved');st('Token 已保存/更新到 Surge。以后上传时可留空 Token。')}).catch(function(e){gistSetTokenStatus(false,'Token 保存失败','error');st('保存 Token 失败：'+(e.message||e))})}}
    var clear=gistById('gistClearToken');if(clear&&!clear._svGistBound){clear._svGistBound=1;clear.onclick=function(){st('正在清除已保存 Token…');gistPost('/api/gist-token/delete',{}).then(function(r){if(!r.ok)throw new Error(r.error||'清除失败');gistSetTokenStatus(false,'未配置','empty');st('已清除 Surge 中保存的 GitHub Token')}).catch(function(e){gistSetTokenStatus(false,'清除 Token 失败','error');st('清除 Token 失败：'+(e.message||e))})}}
    var test=gistById('gistTestToken');if(test&&!test._svGistBound){test._svGistBound=1;test.onclick=function(){var tokenInput=!!gistVal('gistToken');gistSetTokenStatus(false,'测试中…','loading');st('正在测试 GitHub Token…');gistPost('/api/gist-token/test',{token:gistVal('gistToken')}).then(function(r){if(!r.ok)throw new Error(r.error||'测试失败');gistSetTokenStatus(true,tokenInput?'Token 有效，但尚未保存':'已保存 Token，可访问 Gist API','valid');st('Token 测试通过：可以访问 Gist API')}).catch(function(e){gistSetTokenStatus(false,'Token 测试失败','error');st('Token 测试失败：'+(e.message||e))})}}
    var upload=gistById('gistUpload');if(upload&&!upload._svGistBound){upload._svGistBound=1;upload.onclick=gistUploadCurrent}
    var copy=gistById('gistCopyRaw');if(copy&&!copy._svGistBound){copy._svGistBound=1;copy.onclick=function(){var u=gistVal('gistRawUrl');if(!u){st('还没有 Raw URL，请先上传成功后再复制');return}function ok(){st('已复制 Raw URL')}if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(u).then(ok).catch(function(){if(fallbackCopy(u))ok();else st('复制 Raw URL 失败')})}else{if(fallbackCopy(u))ok();else st('复制 Raw URL 失败')}}}
}
window.svGistRefreshStatus=gistRefreshStatus;
window.svGistEnsurePanel=gistEnsurePanel;
window.svGistUploadCurrent=gistUploadCurrent;
hook('afterApply', function(){ gistEnsurePanel() });
window.addEventListener('DOMContentLoaded',function(){gistEnsurePanel()});

/* ── sv137: finalized Linear/Raycast dark SaaS UI ── */
var SV137_PAGE_SIZE=20;
var sv137Page=1;
var sv137LastKey='';
var sv137RawOpen=false;
var sv137State='idle';
var sv137LastStatusText='';
var sv137DetailOpen={};
var sv137ChartExpanded={protocols:false,countries:false};
function sv137ById(id){return document.getElementById(id)}
function sv137Q(sel,root){return (root||document).querySelector? (root||document).querySelector(sel) : null}
function sv137QA(sel,root){return (root||document).querySelectorAll? Array.prototype.slice.call((root||document).querySelectorAll(sel)) : []}
function sv137Closest(el,sel){return el&&el.closest?el.closest(sel):null}
function sv137BtnIcon(txt,ico){return '<span class="sv137-ico" aria-hidden="true">'+ico+'</span><span>'+txt+'</span>'}
function sv137HasData(){return !!(DATA&&DATA.nodes&&DATA.nodes.length)}
function sv137IsURL(u){try{var x=new URL(String(u||'').trim());return /^https?:$/.test(x.protocol)}catch(_){return false}}
function sv137SetBusy(on){var b=sv137ById('pull');if(!b)return;b.disabled=!!on;b.classList.toggle('sv137-loading',!!on);b.innerHTML=on?'<span class="sv137-spinner" aria-hidden="true"></span><span>分析中...</span>':sv137BtnIcon('拉取分析','⧉')}
function sv137StatusKind(msg,kind){
  if(kind)return kind;
  msg=String(msg||'');
  if(!msg||/准备就绪/.test(msg))return 'idle';
  if(/失败|错误|无法|无效|请先|不支持|没有|异常|拒绝/.test(msg))return 'error';
  if(/正在|开始|检测：|上传|读取|拉取/.test(msg))return 'loading';
  if(/完成|已|成功|通过/.test(msg))return 'success';
  return 'info';
}
var sv137BaseSt=st;
st=function(msg,kind){
  var el=sv137ById('status');
  var type=sv137StatusKind(msg,kind);
  sv137State=type;sv137LastStatusText=String(msg||'');
  if(el){
    el.textContent=sv137LastStatusText;
    el.className='status sv137-status sv137-status--'+type;
    el.style.display=(type==='idle'&&!sv137LastStatusText)?'none':'';
  }else{try{sv137BaseSt(msg)}catch(_){}}
};
function sv137InstallStyle(){
  if(sv137ById('sv137Style'))return;
  var s=document.createElement('style');s.id='sv137Style';
  s.textContent=
  'body.sv137{--sv-bg:#0F1117;--sv-card:#1A1D27;--sv-card2:#242736;--sv-row:#1E2130;--sv-border:#2A2D3A;--sv-border2:#34384A;--sv-text:#E8E8ED;--sv-muted:#6B7084;--sv-disabled:#3D4155;--sv-blue:#3B82F6;--sv-green:#5FCB7A;--sv-green-soft:rgba(95,203,122,.12);--sv-red:#EF4444;--sv-red-soft:rgba(239,68,68,.10);--sv-yellow:#D99A32;background:var(--sv-bg)!important;color:var(--sv-text)!important;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",Roboto,Helvetica,Arial,sans-serif!important;-webkit-font-smoothing:antialiased!important;}'+
  'body.sv137:before{content:"";position:fixed;inset:0;pointer-events:none;background:radial-gradient(circle at 50% -18%,rgba(59,130,246,.10),transparent 34%);opacity:.55;}'+
  'body.sv137 .wrap{position:relative;max-width:1280px!important;margin:0 auto!important;padding:24px!important;}'+
  'body.sv137 .hero,body.sv137 .card,body.sv137 .rulebox,body.sv137 .sv137-export-card,body.sv137 .sv137-advanced-card{background:var(--sv-card)!important;border:1px solid var(--sv-border)!important;border-radius:16px!important;box-shadow:none!important;margin:0 0 24px!important;padding:24px!important;transition:border-color .2s ease,background .2s ease!important;}'+
  'body.sv137 .hero:hover,body.sv137 .card:hover,body.sv137 .sv137-export-card:hover,body.sv137 .sv137-advanced-card:hover{border-color:#313A54!important;}'+
  'body.sv137 .hero:before{display:none!important;}body.sv137 .hero>.small{display:none!important;}'+
  'body.sv137 h1{font-size:24px!important;line-height:1.18!important;font-weight:700!important;letter-spacing:-.03em!important;margin:0 0 8px!important;color:var(--sv-text)!important;}'+
  'body.sv137 h2{font-size:15px!important;line-height:1.3!important;font-weight:650!important;color:var(--sv-text)!important;margin:0 0 16px!important;letter-spacing:-.01em!important;}'+
  'body.sv137 p,body.sv137 .muted,body.sv137 .small,body.sv137 .toolhint{color:var(--sv-muted)!important;}body.sv137 .small{font-size:12px!important;}body.sv137 .toolhint{font-size:13px!important;line-height:1.65!important;margin:8px 0 0!important;}'+
  'body.sv137 input,body.sv137 textarea,body.sv137 select{background:#111522!important;border:1px solid var(--sv-border)!important;color:var(--sv-text)!important;border-radius:12px!important;padding:12px 14px!important;font-size:14px!important;line-height:1.4!important;box-shadow:none!important;outline:none!important;transition:border-color .18s ease,box-shadow .18s ease,background .18s ease!important;}'+
  'body.sv137 input:focus,body.sv137 textarea:focus,body.sv137 select:focus{border-color:var(--sv-blue)!important;box-shadow:0 0 0 3px rgba(59,130,246,.18)!important;background:#121827!important;}'+
  'body.sv137 input::placeholder,body.sv137 textarea::placeholder{color:#555B70!important;}body.sv137 #url{height:46px!important;margin:18px 0 0!important;}'+
  'body.sv137 button{appearance:none;background:#202432!important;border:1px solid var(--sv-border)!important;color:var(--sv-text)!important;border-radius:12px!important;box-shadow:none!important;font-size:14px!important;font-weight:600!important;line-height:1!important;min-height:40px!important;padding:0 14px!important;margin:0!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:8px!important;white-space:nowrap!important;transition:background .18s ease,border-color .18s ease,color .18s ease,opacity .18s ease,transform .18s ease!important;}'+
  'body.sv137 button:hover:not(:disabled){background:#262B3A!important;border-color:#394052!important;color:#fff!important;transform:none!important;box-shadow:none!important;}'+
  'body.sv137 button:focus-visible{outline:none!important;border-color:var(--sv-blue)!important;box-shadow:0 0 0 3px rgba(59,130,246,.18)!important;}'+
  'body.sv137 button:disabled{background:rgba(255,255,255,.025)!important;border-color:rgba(255,255,255,.055)!important;color:var(--sv-disabled)!important;cursor:not-allowed!important;opacity:1!important;}'+
  'body.sv137 #pull,body.sv137 #alive,body.sv137 #exportBtn{background:var(--sv-blue)!important;border-color:var(--sv-blue)!important;color:#fff!important;}body.sv137 #pull:hover:not(:disabled),body.sv137 #alive:hover:not(:disabled),body.sv137 #exportBtn:hover:not(:disabled){background:#4D8DF8!important;border-color:#4D8DF8!important;}'+
  'body.sv137 #demo,body.sv137 #textBtn,body.sv137 #copyBtn,body.sv137 #copyAliveBtn{background:transparent!important;}'+
  'body.sv137 .sv137-input-actions{display:grid!important;grid-template-columns:1fr 1fr 1fr!important;gap:16px!important;margin-top:16px!important;}body.sv137 .sv137-input-actions button{height:44px!important;width:100%!important;}'+
  'body.sv137 .sv137-paste-toggle{width:100%!important;height:42px!important;justify-content:space-between!important;margin-top:16px!important;background:#171B28!important;color:#A5ACC0!important;}body.sv137 .sv137-paste-toggle:after{content:"⌄";color:#8A91A6;}body.sv137.raw-open .sv137-paste-toggle:after{content:"⌃";}'+
  'body.sv137 .sv137-raw-panel{display:none!important;margin-top:12px!important;}body.sv137.raw-open .sv137-raw-panel{display:block!important;}body.sv137 #raw{height:128px!important;resize:vertical!important;}'+
  'body.sv137 .sv137-status{font-size:13px!important;line-height:1.45!important;border-radius:12px!important;padding:10px 12px!important;margin-top:12px!important;max-height:none!important;overflow:hidden!important;background:#141925!important;border:1px solid var(--sv-border)!important;color:var(--sv-muted)!important;}'+
  'body.sv137 .sv137-status--idle{display:none!important;}body.sv137 .sv137-status--error{display:block!important;background:var(--sv-red-soft)!important;border-color:rgba(239,68,68,.30)!important;color:#F2A4A4!important;}body.sv137 .sv137-status--loading{display:block!important;background:rgba(59,130,246,.08)!important;border-color:rgba(59,130,246,.22)!important;color:#9DBEFA!important;}body.sv137 .sv137-status--success{display:block!important;background:var(--sv-green-soft)!important;border-color:rgba(95,203,122,.22)!important;color:#A5DAB3!important;}'+
  'body.sv137 .sv137-spinner{width:14px;height:14px;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:999px;animation:sv137spin .9s linear infinite;}@keyframes sv137spin{to{transform:rotate(360deg)}}'+
  'body.sv137 #cards.grid{display:none!important;}body.sv137 .sv135-chart-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:24px!important;margin:0 0 24px!important;}body.sv137 .sv135-chart-grid>.card{margin:0!important;padding:24px!important;border-radius:16px!important;background:var(--sv-card)!important;}'+
  'body.sv137 .bar{display:grid!important;grid-template-columns:minmax(64px,92px) minmax(52px,1fr) 44px 56px!important;gap:8px!important;align-items:center!important;min-height:28px!important;margin:8px 0!important;font-size:13px!important;color:var(--sv-text)!important;min-width:0!important;}'+
  'body.sv137 .sv137-dist-row{grid-template-columns:minmax(64px,92px) minmax(52px,1fr) 44px 56px!important;}body.sv137 .sv137-dist-name{min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;}body.sv137 .sv137-dist-track{width:100%!important;min-width:0!important;}body.sv137 .sv137-dist-count,body.sv137 .sv137-dist-percent{display:block!important;text-align:right!important;white-space:nowrap!important;font:500 12px/1 SFMono-Regular,"SF Mono","JetBrains Mono",Consolas,monospace!important;color:#AAB1C4!important;font-variant-numeric:tabular-nums!important;font-feature-settings:"tnum" 1!important;letter-spacing:0!important;}body.sv137 .sv137-dist-count{color:#C6CCDA!important;}'+
  'body.sv137 .track{height:10px!important;background:#252B3A!important;border-radius:999px!important;overflow:hidden!important;}body.sv137 .fill{height:10px!important;background:var(--sv-blue)!important;border-radius:999px!important;}body.sv137 .bar b{font:500 12px/1 SFMono-Regular,"SF Mono","JetBrains Mono",Consolas,monospace!important;color:#AAB1C4!important;font-variant-numeric:tabular-nums!important;font-feature-settings:"tnum" 1!important;text-align:right!important;white-space:nowrap!important;}'+
  'body.sv137 .sv137-card-head,body.sv137 .sv137-card-title{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:12px!important;margin-bottom:14px!important;}body.sv137 .sv137-card-title span:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}body.sv137 .sv137-total{font:500 12px/1.2 SFMono-Regular,"SF Mono","JetBrains Mono",monospace;color:#AAB1C4;white-space:nowrap;font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1;}body.sv137 .sv137-link{width:100%!important;height:auto!important;min-height:0!important;margin-top:14px!important;padding:14px 0 0!important;border:0!important;border-top:1px solid var(--sv-border)!important;border-radius:0!important;background:transparent!important;color:#AAB1C4!important;font-size:13px!important;display:flex!important;justify-content:space-between!important;cursor:pointer!important;}body.sv137 .sv137-link:hover{color:#E8E8ED!important;background:transparent!important;border-color:var(--sv-border)!important;}'+
  'body.sv137 #sv135Health .health-grid{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:10px!important;margin-top:12px!important;}body.sv137 #sv135Health .health-cell{background:#171C2A!important;border:1px solid var(--sv-border)!important;border-radius:12px!important;padding:12px!important;min-height:80px!important;display:grid!important;grid-template-rows:minmax(16px,auto) minmax(24px,1fr) minmax(15px,auto)!important;align-content:start!important;min-width:0!important;}body.sv137 #sv135Health .health-cell span{display:block;color:var(--sv-muted)!important;font-size:12px!important;line-height:1.2!important;font-weight:600!important;min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;}body.sv137 #sv135Health .health-cell b{display:block;margin-top:4px;font:650 22px/1.05 SFMono-Regular,"SF Mono","JetBrains Mono",monospace!important;color:var(--sv-text)!important;font-variant-numeric:tabular-nums!important;font-feature-settings:"tnum" 1!important;white-space:nowrap!important;min-width:0!important;}body.sv137 #sv135Health .health-cell small{display:block;margin-top:4px;font:600 12px/1.2 SFMono-Regular,"SF Mono","JetBrains Mono",Consolas,monospace!important;color:#AAB1C4!important;font-variant-numeric:tabular-nums!important;font-feature-settings:"tnum" 1!important;white-space:nowrap!important;}'+
  'body.sv137 #sv135Health .health-cell.health-ok b{color:var(--sv-green)!important;}body.sv137 #sv135Health .health-cell.health-bad b{color:#E46F6F!important;}body.sv137 #sv135Health .health-cell.health-scope b{color:#7EABFA!important;}'+
  'body.sv137 .sv137-health-main{background:#171C2A!important;border:1px solid var(--sv-border)!important;border-radius:14px!important;padding:16px!important;margin-bottom:12px!important;min-height:112px!important;}body.sv137 .sv137-health-label{font-size:12px;color:var(--sv-muted);font-weight:600;}body.sv137 .sv137-health-rate{display:block;margin-top:4px;font:750 40px/1 SFMono-Regular,"SF Mono","JetBrains Mono",monospace;color:var(--sv-green);letter-spacing:-.04em;font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1;white-space:nowrap;}body.sv137 .sv137-health-bar{height:10px;background:#252B3A;border-radius:999px;overflow:hidden;margin-top:12px;}body.sv137 .sv137-health-bar>i{display:block;height:100%;background:var(--sv-green);border-radius:999px;}'+
  'body.sv137 .sv137-node-card{padding:18px 18px 0!important;overflow-x:auto!important;overflow-y:visible!important;}body.sv137 .sv137-node-card>h2{display:none!important;}body.sv137 #count{margin:0!important;font-size:13px!important;}'+
  'body.sv137 .sv137-table-controls{display:grid!important;grid-template-columns:minmax(260px,1fr) 170px 170px auto!important;gap:14px!important;align-items:center!important;margin-bottom:14px!important;}body.sv137 .sv137-table-controls input,body.sv137 .sv137-table-controls select{height:42px!important;}'+
  'body.sv137 .sv137-toggle{height:42px;display:inline-flex!important;align-items:center!important;gap:10px!important;color:#BDC4D5!important;font-size:14px!important;white-space:nowrap!important;}body.sv137 .sv137-toggle input{position:absolute;opacity:0;pointer-events:none;}body.sv137 .sv137-switch{width:38px;height:22px;border-radius:999px;background:#34394A;border:1px solid var(--sv-border2);position:relative;transition:.18s;}body.sv137 .sv137-switch:before{content:"";position:absolute;width:16px;height:16px;left:3px;top:2px;border-radius:50%;background:#CDD3E0;transition:.18s;}body.sv137 .sv137-toggle input:checked+.sv137-switch{background:rgba(59,130,246,.35);border-color:rgba(59,130,246,.45);}body.sv137 .sv137-toggle input:checked+.sv137-switch:before{transform:translateX(16px);background:#fff;}'+
  'body.sv137 table{width:100%!important;min-width:1080px!important;border-collapse:separate!important;border-spacing:0!important;table-layout:fixed!important;margin:0!important;background:#151A26!important;border:1px solid var(--sv-border)!important;border-radius:14px!important;overflow:hidden!important;}body.sv137 thead{display:table-header-group!important;}body.sv137 th{height:40px!important;background:#1B202E!important;border:0!important;border-bottom:1px solid var(--sv-border)!important;color:#A8B0C3!important;font-size:12px!important;font-weight:650!important;padding:0 12px!important;text-align:left!important;}body.sv137 td{height:48px!important;padding:0 12px!important;border:0!important;border-bottom:1px solid rgba(42,45,58,.78)!important;color:#C9CFDD!important;font-size:14px!important;vertical-align:middle!important;word-break:normal!important;}body.sv137 tbody tr:nth-child(even) td{background:rgba(255,255,255,.015)!important;}body.sv137 tbody tr:hover td{background:rgba(255,255,255,.035)!important;color:var(--sv-text)!important;}'+
  'body.sv137 th:nth-child(1),body.sv137 td:nth-child(1){width:46px!important;}body.sv137 th:nth-child(2),body.sv137 td:nth-child(2){width:320px!important;min-width:280px!important;}body.sv137 th:nth-child(3),body.sv137 td:nth-child(3){width:86px!important;}body.sv137 th:nth-child(4),body.sv137 td:nth-child(4){width:116px!important;}body.sv137 th:nth-child(5),body.sv137 td:nth-child(5){width:108px!important;}body.sv137 th:nth-child(6),body.sv137 td:nth-child(6){width:108px!important;}body.sv137 th:nth-child(7),body.sv137 td:nth-child(7){width:106px!important;}body.sv137 th:nth-child(8),body.sv137 td:nth-child(8){width:88px!important;}body.sv137 th:nth-child(9),body.sv137 td:nth-child(9){width:46px!important;}'+
  'body.sv137 .rowchk{width:18px!important;height:18px!important;accent-color:var(--sv-blue)!important;margin:0!important;padding:0!important;}body.sv137 .sv137-node-name{display:block;min-width:0;font-weight:560;color:var(--sv-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}body.sv137 .sv137-mobile-meta{display:none;}body.sv137 .sv137-region{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}body.sv137 .sv137-latency{font:600 13px/1 SFMono-Regular,"SF Mono","JetBrains Mono",monospace;}body.sv137 .sv137-latency.ok{color:var(--sv-green);}body.sv137 .sv137-latency.warn{color:var(--sv-yellow);}body.sv137 .sv137-latency.bad{color:#E46F6F;}body.sv137 .sv137-latency.muted{color:var(--sv-muted);}'+
  'body.sv137 .tag,body.sv137 .sv137-tag{display:inline-flex!important;align-items:center!important;justify-content:center!important;border-radius:999px!important;padding:4px 9px!important;font-size:12px!important;font-weight:600!important;background:rgba(59,130,246,.10)!important;border:1px solid rgba(59,130,246,.18)!important;color:#9DBEFA!important;max-width:100px!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;text-transform:none!important;}'+
  'body.sv137 .sv137-status-pill{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:4px 9px;font-size:12px;font-weight:600;border:1px solid transparent;background:rgba(255,255,255,.04);color:#AAB1C4;}body.sv137 .sv137-status-pill:before{content:"";width:6px;height:6px;border-radius:50%;background:#7A8298;}body.sv137 .sv137-status-pill.ok{background:rgba(95,203,122,.10);border-color:rgba(95,203,122,.16);color:#9CDDAF;}body.sv137 .sv137-status-pill.ok:before{background:var(--sv-green);}body.sv137 .sv137-status-pill.bad{background:rgba(239,68,68,.09);border-color:rgba(239,68,68,.16);color:#F2A4A4;}body.sv137 .sv137-status-pill.bad:before{background:#E46F6F;}'+
  'body.sv137 .sv137-actions{opacity:.28;color:#8C94A9;background:transparent!important;border-color:transparent!important;min-height:28px!important;width:28px!important;padding:0!important;border-radius:8px!important;}body.sv137 tbody tr:hover .sv137-actions,body.sv137 .sv137-actions:focus-visible{opacity:1;color:#E8E8ED!important;background:#242736!important;}body.sv137 .sv137-source-badge{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:4px 8px;font-size:12px;font-weight:600;border:1px solid var(--sv-border);background:rgba(255,255,255,.035);color:#AAB1C4;white-space:nowrap;}body.sv137 .sv137-source-badge.landing{background:rgba(95,203,122,.10);border-color:rgba(95,203,122,.18);color:#9CDDAF;}body.sv137 .sv137-source-badge.name{background:rgba(217,154,50,.10);border-color:rgba(217,154,50,.18);color:#DDB777;}body.sv137 .sv137-detail-row td{height:auto!important;padding:0!important;background:#151A26!important;border-bottom:1px solid rgba(42,45,58,.78)!important;}body.sv137 .sv137-detail{margin:0 12px 12px 58px;padding:14px;border:1px solid var(--sv-border);border-radius:12px;background:#171C2A;color:#C9CFDD;}body.sv137 .sv137-detail-grid{display:grid;grid-template-columns:1fr 1.5fr;gap:12px;}body.sv137 .sv137-detail-item{background:#131824;border:1px solid rgba(42,45,58,.72);border-radius:10px;padding:12px;}body.sv137 .sv137-detail-label{font-size:12px;color:var(--sv-muted);margin-bottom:6px;}body.sv137 .sv137-detail-value{font:500 13px/1.45 SFMono-Regular,"SF Mono","JetBrains Mono",Consolas,monospace;color:var(--sv-text);word-break:break-word;}body.sv137 .sv137-detail-note{margin-top:10px;color:#8D95AA;font-size:12px;line-height:1.55;}'+
  'body.sv137 .sv137-table-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 4px 14px;color:#AAB1C4;font-size:13px;}body.sv137 .sv137-pagination{display:flex;align-items:center;gap:6px;}body.sv137 .sv137-page-btn{min-height:30px!important;height:30px!important;min-width:30px!important;padding:0 8px!important;border-radius:8px!important;background:#1E2433!important;}body.sv137 .sv137-page-btn.active{background:var(--sv-blue)!important;border-color:var(--sv-blue)!important;color:#fff!important;}body.sv137 .sv137-page-btn:disabled{opacity:.55!important;}body.sv137 .sv137-page-size{width:auto!important;height:32px!important;padding:0 28px 0 10px!important;}'+
  'body.sv137 .sv137-empty{padding:34px 14px!important;text-align:center!important;color:var(--sv-muted)!important;line-height:1.7!important;border:0!important;background:transparent!important;}'+
  'body.sv137 .sv137-bulk-toolbar{height:54px;display:flex!important;align-items:center!important;gap:10px!important;padding:10px 18px!important;margin:0 -18px!important;border-top:1px solid var(--sv-border)!important;background:#181D2B!important;overflow-x:auto!important;}body.sv137 .sv137-bulk-toolbar button{height:32px!important;min-height:32px!important;padding:0 12px!important;font-size:13px!important;background:#202432!important;}body.sv137 .sv137-bulk-toolbar .sv137-sep{width:1px;height:22px;background:var(--sv-border);flex:0 0 auto;}'+
  'body.sv137 .sv137-tipwrap{position:relative;display:inline-flex;}body.sv137 .sv137-tipwrap:after{content:attr(data-tip);position:absolute;right:0;bottom:calc(100% + 8px);background:#0F1117;border:1px solid var(--sv-border);color:#C6CCDA;border-radius:8px;padding:7px 9px;white-space:nowrap;font-size:12px;opacity:0;transform:translateY(4px);pointer-events:none;transition:.15s;box-shadow:0 10px 28px rgba(0,0,0,.35);z-index:10;}body.sv137 .sv137-tipwrap:hover:after,body.sv137 .sv137-tipwrap:focus-within:after{opacity:1;transform:translateY(0);}'+
  'body.sv137 .sv137-export-card{display:grid!important;grid-template-columns:auto 1fr!important;gap:12px 24px!important;align-items:center!important;}body.sv137 .sv137-export-title{font-size:18px;font-weight:650;color:var(--sv-text);grid-row:1 / span 2;}body.sv137 .sv137-export-row{display:grid!important;grid-template-columns:220px 1fr 1fr 1.25fr!important;gap:14px!important;align-items:center!important;}body.sv137 .sv137-export-row select,body.sv137 .sv137-export-row button{height:42px!important;width:100%!important;}body.sv137 .sv137-export-help{font-size:13px;color:var(--sv-muted);line-height:1.55;}'+
  'body.sv137 .sv137-advanced-card{padding:0!important;overflow:hidden!important;}body.sv137 .sv137-advanced-card .rulebox{margin:0!important;border:0!important;border-bottom:1px solid var(--sv-border)!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;padding:0!important;}body.sv137 .sv137-advanced-card .rulebox:last-child{border-bottom:0!important;}body.sv137 .sv137-advanced-card details{padding:0!important;}body.sv137 .sv137-advanced-card summary{display:grid!important;grid-template-columns:minmax(160px,220px) minmax(0,1fr) auto 18px!important;gap:18px!important;align-items:center!important;padding:18px 24px!important;color:var(--sv-text)!important;font-weight:650!important;cursor:pointer!important;list-style:none!important;}body.sv137 .sv137-advanced-card summary:before{display:none!important;}body.sv137 .sv137-advanced-card summary::-webkit-details-marker{display:none!important;}body.sv137 .sv137-acc-desc{color:var(--sv-muted);font-size:13px;font-weight:400;}body.sv137 .sv137-acc-state{color:#AAB1C4;font-size:12px;border:1px solid var(--sv-border);background:#1E2433;border-radius:999px;padding:5px 9px;}body.sv137 .sv137-chevron{color:#8D95AA;}body.sv137 .sv137-advanced-card details[open] .sv137-chevron{transform:rotate(180deg);}body.sv137 .sv137-advanced-card details>div:not(.toolhint),body.sv137 .sv137-advanced-card details>.rulegrid,body.sv137 .sv137-advanced-card details>label,body.sv137 .sv137-advanced-card details>textarea,body.sv137 .sv137-advanced-card details>input,body.sv137 .sv137-advanced-card details>.rulebtns{margin-left:24px!important;margin-right:24px!important;}body.sv137 .sv137-advanced-card details[open]{background:#181D2B!important;}body.sv137 .sv137-advanced-card .toolhint{margin:0 24px 16px!important;}'+
  'body.sv137 .sectionline,body.sv137 #sv135SelectTitle,body.sv137 #sv135ActionTitle,body.sv137 #sv135AdvancedTitle,body.sv137 #sv135ExportTitle{display:none!important;}body.sv137 .selectbar,body.sv137 .toolbar,body.sv137 .sv-op-grid,body.sv137 .sv-mini-grid{display:contents!important;}body.sv137 label:has(#unique){display:none!important;}'+
  '@media(max-width:980px){body.sv137 .sv135-chart-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important;overflow-x:visible!important;padding-bottom:0!important;gap:16px!important;}body.sv137 .sv135-chart-grid>.card{padding:18px!important;}body.sv137 .bar,body.sv137 .sv137-dist-row{grid-template-columns:minmax(52px,76px) minmax(42px,1fr) 38px 46px!important;gap:6px!important;}body.sv137 .sv137-dist-count,body.sv137 .sv137-dist-percent{font-size:11px!important;}body.sv137 .sv137-table-controls{grid-template-columns:1fr 1fr!important;}body.sv137 .sv137-export-row{grid-template-columns:1fr 1fr!important;}}'+
  '@media(max-width:720px){body.sv137 .wrap{padding:16px 12px 40px!important;overflow-x:hidden!important;}body.sv137 .sv135-chart-grid{grid-template-columns:1fr!important;overflow-x:visible!important;gap:16px!important;}body.sv137 .sv135-chart-grid>.card{min-width:0!important;width:100%!important;}body.sv137 .bar,body.sv137 .sv137-dist-row{grid-template-columns:minmax(64px,92px) minmax(52px,1fr) 44px 56px!important;gap:8px!important;}body.sv137 #sv135Health .health-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important;}body.sv137 .hero,body.sv137 .card,body.sv137 .sv137-export-card{padding:18px!important;border-radius:14px!important;margin-bottom:16px!important;}body.sv137 .sv137-input-actions{grid-template-columns:1fr!important;gap:10px!important;}body.sv137 .sv137-table-controls{grid-template-columns:1fr!important;}body.sv137 table,body.sv137 thead,body.sv137 tbody,body.sv137 tr,body.sv137 td{display:block!important;}body.sv137 thead{display:none!important;}body.sv137 table{width:100%!important;min-width:0!important;background:transparent!important;border:0!important;border-radius:0!important;}body.sv137 tbody{display:grid!important;gap:12px!important;}body.sv137 tbody tr{display:grid!important;grid-template-columns:34px minmax(0,1fr) auto!important;grid-template-areas:"check name status" "check name actions"!important;gap:8px 10px!important;background:#171C2A!important;border:1px solid var(--sv-border)!important;border-radius:14px!important;padding:12px!important;}body.sv137 tbody td{height:auto!important;padding:0!important;border:0!important;background:transparent!important;}body.sv137 tbody tr.sv137-main-row td{width:auto!important;}body.sv137 tbody tr.sv137-main-row td:nth-child(1){grid-area:check;}body.sv137 tbody tr.sv137-main-row td:nth-child(2){display:block!important;grid-area:name!important;min-width:0!important;}body.sv137 tbody tr.sv137-main-row td:nth-child(3),body.sv137 tbody tr.sv137-main-row td:nth-child(4),body.sv137 tbody tr.sv137-main-row td:nth-child(5),body.sv137 tbody tr.sv137-main-row td:nth-child(6),body.sv137 tbody tr.sv137-main-row td:nth-child(7){display:none!important;}body.sv137 tbody tr.sv137-main-row td:nth-child(8){grid-area:status;text-align:right;}body.sv137 tbody tr.sv137-main-row td:nth-child(9){grid-area:actions;text-align:right;}body.sv137 .sv137-node-name{white-space:normal!important;line-height:1.35!important;}body.sv137 .sv137-mobile-meta{display:block!important;margin-top:7px;color:var(--sv-muted);font-size:12px;line-height:1.55;}body.sv137 tbody tr.sv137-detail-row{display:block!important;padding:0!important;background:transparent!important;border:0!important;margin-top:-8px;}body.sv137 tbody tr.sv137-detail-row td{display:block!important;width:auto!important;}body.sv137 .sv137-detail{margin:0!important;padding:12px!important;}body.sv137 .sv137-detail-grid{grid-template-columns:1fr!important;}body.sv137 .sv137-table-footer{flex-direction:column;align-items:flex-start;}body.sv137 .sv137-bulk-toolbar{margin:0 -18px!important;padding-left:18px!important;}body.sv137 .sv137-export-card{display:block!important;}body.sv137 .sv137-export-row{grid-template-columns:1fr!important;margin-top:14px;}body.sv137 .sv137-export-help{margin-top:10px;}body.sv137 .sv137-advanced-card summary{grid-template-columns:1fr auto!important;gap:6px 10px!important;}body.sv137 .sv137-acc-desc{grid-column:1 / -1;}body.sv137 .sv137-acc-state{grid-column:1;justify-self:start;}body.sv137 .sv137-chevron{grid-column:2;grid-row:1;}}'+
  '@media(max-width:380px){body.sv137 .bar,body.sv137 .sv137-dist-row{grid-template-columns:minmax(56px,74px) minmax(42px,1fr) 38px 48px!important;gap:6px!important;}body.sv137 #sv135Health .health-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;}body.sv137 #sv135Health .health-cell{min-height:76px!important;}}';
  document.head.appendChild(s);
}
function sv137FmtPct(count,total){return total?((count/total*100).toFixed(1).replace(/\.0$/,'')+'%'):'--'}
function sv137SetChartTitle(el,title,total){var card=sv137Closest(el,'.card'),h=card&&sv137Q('h2',card);if(h){if((' '+(h.className||'')+' ').indexOf(' sv137-card-title ')<0)h.className=(h.className?String(h.className)+' ':'')+'sv137-card-title';h.innerHTML='<span>'+esc(title)+'</span><span class="sv137-total">'+esc(total)+'</span>';return ''}return '<div class="sv137-card-head"><h2>'+esc(title)+'</h2><div class="sv137-total">'+esc(total)+'</div></div>'}
function sv137Bars(arr,total,limit){arr=arr||[];if(!arr.length)return '<div class="sv137-empty">--</div>';var max=arr[0].count||1;return arr.slice(0,limit||5).map(function(x,i){var cls=i===0?' style="background:var(--sv-blue)!important"':'';var pct=sv137FmtPct(x.count,total);return '<div class="bar sv137-dist-row"><div class="sv137-dist-name" title="'+esc(x.key||'未知')+'">'+esc(x.key||'未知')+'</div><div class="track sv137-dist-track"><div class="fill"'+cls+' style="width:'+(max?Math.round(x.count/max*100):0)+'%"></div></div><span class="sv137-dist-count">'+esc(x.count)+'</span><span class="sv137-dist-percent">'+esc(pct)+'</span></div>'}).join('')}
function sv137ChartLink(kind,arr){arr=arr||[];if(arr.length<=5)return '';var isP=kind==='protocols',open=!!sv137ChartExpanded[kind],name=isP?'协议':'地区',label=(open?'收起':'查看全部')+name;return '<button type="button" class="sv137-link" data-chart="'+esc(kind)+'" aria-expanded="'+(open?'true':'false')+'" onclick="window.sv137ToggleChart&&window.sv137ToggleChart(\''+esc(kind)+'\');return false"><span>'+esc(label)+'</span><span>'+(open?'⌃':'›')+'</span></button>'}
window.sv137ToggleChart=function(kind){if(kind!=='protocols'&&kind!=='countries')return;sv137ChartExpanded[kind]=!sv137ChartExpanded[kind];sv137UpdateCharts()};
function sv137UpdateCharts(){
  if(!DATA)return;
  var s=DATA.summary||{},p=DATA.stats&&DATA.stats.byProtocol||[],c=DATA.stats&&DATA.stats.byCountry||[];
  var pc=sv137ById('protocols'),cc=sv137ById('countries'),pl=sv137ChartExpanded.protocols?p.length:5,cl=sv137ChartExpanded.countries?c.length:5;
  if(pc)pc.innerHTML=sv137SetChartTitle(pc,'协议分布','总数 '+(s.total||0))+sv137Bars(p,s.total||0,pl)+sv137ChartLink('protocols',p);
  if(cc)cc.innerHTML=sv137SetChartTitle(cc,'国家 / 地区分布','总数 '+(s.countries||0))+sv137Bars(c,s.total||0,cl)+sv137ChartLink('countries',c);
}
function sv137Health(nodes){var a=0,d=0,u=0;(nodes||[]).forEach(function(n){if(n.aliveOK===true)a++;else if(n.aliveOK===false)d++;else u++});return{alive:a,dead:d,unknown:u,total:(nodes||[]).length}}
function sv137RenderHealth(nodes){
  var h=sv137Health(nodes||[]),el=sv137ById('sv135Health');if(!el)return;
  var p=h.total?Math.round(h.alive/h.total*1000)/10:0;
  el.innerHTML='<div class="sv137-card-head"><h2>节点健康状况</h2><div class="sv137-total">总数 '+h.total+'</div></div>'+
    '<div class="sv137-health-main"><div class="sv137-health-label">可用率</div><b class="sv137-health-rate">'+(h.total?p.toFixed(1).replace(/\.0$/,''):'--')+'%</b><div class="sv137-health-bar"><i style="width:'+(h.total?p:0)+'%"></i></div></div>'+
    '<div class="health-grid"><div class="health-cell health-ok"><span>可用</span><b id="hAlive">'+h.alive+'</b><small>'+sv137FmtPct(h.alive,h.total)+'</small></div><div class="health-cell health-bad"><span>不可用</span><b id="hDead">'+h.dead+'</b><small>'+sv137FmtPct(h.dead,h.total)+'</small></div><div class="health-cell"><span>未知</span><b id="hUntested">'+h.unknown+'</b><small>'+sv137FmtPct(h.unknown,h.total)+'</small></div><div class="health-cell health-scope"><span>当前筛选</span><b id="hScope">'+h.total+'</b><small>100%</small></div></div>';
}
function sv137EnsureHealthCard(){
  var p=sv137Closest(sv137ById('protocols'),'.card'),c=sv137Closest(sv137ById('countries'),'.card');if(!p||!c)return;
  var grid=sv137ById('sv135Charts');
  if(!grid){grid=document.createElement('div');grid.id='sv135Charts';grid.className='sv135-chart-grid';p.parentNode.insertBefore(grid,p);grid.appendChild(p);grid.appendChild(c)}
  if(!sv137ById('sv135Health')){var h=document.createElement('div');h.id='sv135Health';h.className='card';grid.appendChild(h)}
}
function sv137Region(n){var cc=String(n.countryCode||'').toUpperCase();return (flag(cc)+' '+(n.country||'未知')+(n.geoCity?' '+n.geoCity:''))}
function sv137LatencyNumber(v){var n=parseInt(v,10);return isFinite(n)?n:null}
function sv137FmtLatencyValue(v,cls){var n=sv137LatencyNumber(v);if(n==null)return '<span class="sv137-latency muted">--</span>';return '<span class="sv137-latency '+(cls||((n>90)?'warn':'ok'))+'">'+esc(n)+' ms</span>'}
function sv137AliveLatency(n){var v=sv137LatencyNumber(n&&n.aliveLatency);if(!n||n.aliveOK!==true||v==null)return '<span class="sv137-latency bad">不可用</span>';return sv137FmtLatencyValue(v)}
function sv137LandingLatency(n){var v=sv137LatencyNumber(n&&n.landingLatency);if(!n)return '<span class="sv137-latency muted">未检测</span>';if(n.landingOK===false||n.landingError)return '<span class="sv137-latency warn">检测失败</span>';if(n.landingOK!==true||v==null)return '<span class="sv137-latency muted">未检测</span>';return sv137FmtLatencyValue(v)}
function sv137NodeStatus(n){if(n.aliveOK===true)return '<span class="sv137-status-pill ok">可用</span>';if(n.aliveOK===false)return '<span class="sv137-status-pill bad">不可用</span>';return '<span class="sv137-status-pill">未知</span>'}
function sv137CountrySource(n){var s=String((n&&n.countrySource)||'').toLowerCase();if(s==='landing')return '<span class="sv137-source-badge landing">落地验证</span>';if(s==='flag'||s==='name')return '<span class="sv137-source-badge name">名称识别</span>';if(s==='geoip')return '<span class="sv137-source-badge">GeoIP</span>';return '<span class="sv137-source-badge">未确认</span>'}
function sv137EntryText(n){var host=(n&&n.entryServer)||((n&&n.extra&&(n.extra.server||n.extra.add))||'')||(n&&n.server)||'';var port=(n&&n.port)||((n&&n.extra&&n.extra.port)||'');if(host&&port)return String(host)+':'+String(port);return host||'--'}
function sv137CleanParts(parts){return (parts||[]).map(function(x){return String(x==null?'':x).trim()}).filter(function(x){return x&&x!=='undefined'&&x!=='null'})}
function sv137ExitParts(n){if(!n||!n.landingIP)return [];var asn=String(n.landingASN||n.geoASN||'').trim();if(asn&&asn.toUpperCase().indexOf('AS')!==0)asn='AS'+asn;return sv137CleanParts([n.landingIP,n.landingCountry||n.country||n.landingCountryCode,n.landingCity||n.geoCity,n.landingISP||n.geoISP,asn])}
function sv137ExitText(n){var p=sv137ExitParts(n);if(p.length)return p.join(' / ');if(n&&n.landingOK===false)return '检测失败';return '未检测'}
function sv137NodeDetail(n){var entry=sv137EntryText(n),exit=sv137ExitText(n),same=false;try{same=!!(n&&n.landingIP&&String(entry).split(':')[0]===String(n.landingIP))}catch(_){}return '<div class="sv137-detail"><div class="sv137-detail-grid"><div class="sv137-detail-item"><div class="sv137-detail-label">入口 IP:端口（连接目标）</div><div class="sv137-detail-value">'+esc(entry)+'</div></div><div class="sv137-detail-item"><div class="sv137-detail-label">出口 IP / 国家 / 城市 / ISP / ASN（落地检测结果）</div><div class="sv137-detail-value">'+esc(exit)+'</div></div></div><div class="sv137-detail-note">'+(same?'入口 IP 与出口 IP 相同。':'入口 IP 和出口 IP 可以不同，这是正常的中转 / 转发结构。')+'</div></div>'}
function sv137SearchText(n){return [n.name,n.server,n.entryServer,n.port,n.country,n.protocol,n.geoCity,n.landingIP,n.landingCountry,n.landingCity,n.landingISP,n.landingASN].map(function(x){return String(x||'')}).join(' ').toLowerCase()}
function sv137AliveSortValue(n,idx){var v=sv137LatencyNumber(n&&n.aliveLatency);if(n&&n.aliveOK===true&&v!=null)return v*100000+idx;if(n&&n.aliveOK===false)return 900000000+idx;return 800000000+idx}
function sv137SortByAlive(arr){return (arr||[]).map(function(n,i){return{n:n,i:i,v:sv137AliveSortValue(n,i)}}).sort(function(a,b){return a.v-b.v}).map(function(x){return x.n})}
function sv137FilteredBase(){if(!DATA)return[];var ns=(sv137ById('unique')&&sv137ById('unique').checked)?uniq(DATA.nodes):DATA.nodes;var q=(sv137ById('q')&&sv137ById('q').value||'').toLowerCase(),pf=(sv137ById('pf')&&sv137ById('pf').value)||'',cf=(sv137ById('cf')&&sv137ById('cf').value)||'',alive=!!(sv137ById('onlyAlive')&&sv137ById('onlyAlive').checked);var out=(ns||[]).filter(function(n){return(!pf||n.protocol==pf)&&(!cf||n.country==cf)&&(!alive||n.aliveOK===true)&&(!q||sv137SearchText(n).indexOf(q)>=0)});return sv137SortByAlive(out)}
filtered=sv137FilteredBase;
function sv137Key(a){var q=(sv137ById('q')&&sv137ById('q').value)||'',pf=(sv137ById('pf')&&sv137ById('pf').value)||'',cf=(sv137ById('cf')&&sv137ById('cf').value)||'',alive=(sv137ById('onlyAlive')&&sv137ById('onlyAlive').checked)?'1':'0',u=(sv137ById('unique')&&sv137ById('unique').checked)?'1':'0';return [a.length,q,pf,cf,alive,u].join('|')}
function sv137Row(n,i){var sid=esc(n._sid||''),chk=SELECTED[n._sid]?' checked':'',open=!!sv137DetailOpen[n._sid],mobileMeta=[esc(n.protocol||'--')+' · '+esc(sv137Region(n)),'连通延迟 '+sv137AliveLatency(n).replace(/<[^>]+>/g,'')+' · 落地耗时 '+sv137LandingLatency(n).replace(/<[^>]+>/g,''),'入口 '+esc(sv137EntryText(n))].join('<br>');var main='<tr class="sv137-main-row" data-sid="'+sid+'"><td><input type="checkbox" class="rowchk" data-sid="'+sid+'" onchange="window.toggleSelect&&window.toggleSelect(this.dataset.sid,this.checked);window.sv137RefreshCounts&&window.sv137RefreshCounts()"'+chk+'></td><td><div class="sv137-node-name" title="'+esc(n.name)+'">'+esc(n.name)+'</div><div class="sv137-mobile-meta">'+mobileMeta+'</div></td><td><span class="sv137-tag">'+esc(n.protocol||'--')+'</span></td><td><div class="sv137-region" title="'+esc(sv137Region(n))+'">'+esc(sv137Region(n))+'</div></td><td>'+sv137AliveLatency(n)+'</td><td>'+sv137LandingLatency(n)+'</td><td>'+sv137CountrySource(n)+'</td><td>'+sv137NodeStatus(n)+'</td><td><button type="button" class="sv137-actions" data-sid="'+sid+'" aria-expanded="'+(open?'true':'false')+'" aria-label="更多信息" title="查看入口 / 出口信息" onclick="window.sv137ToggleDetail&&window.sv137ToggleDetail(this.dataset.sid)">•••</button></td></tr>';var detail=open?'<tr class="sv137-detail-row"><td colspan="9">'+sv137NodeDetail(n)+'</td></tr>':'';return main+detail}
window.sv137ToggleDetail=function(sid){if(!sid)return;sv137DetailOpen[sid]=!sv137DetailOpen[sid];apply()};
function sv137Pagination(total){
  var pages=Math.max(1,Math.ceil(total/SV137_PAGE_SIZE));if(sv137Page>pages)sv137Page=pages;if(sv137Page<1)sv137Page=1;
  var start=Math.max(1,sv137Page-2),end=Math.min(pages,start+4);start=Math.max(1,end-4);var out='<select id="sv137PageSize" class="sv137-page-size" onchange="window.sv137SetPageSize&&window.sv137SetPageSize(this.value)"><option value="20"'+(SV137_PAGE_SIZE===20?' selected':'')+'>20 条/页</option><option value="50"'+(SV137_PAGE_SIZE===50?' selected':'')+'>50 条/页</option><option value="100"'+(SV137_PAGE_SIZE===100?' selected':'')+'>100 条/页</option></select>';
  out+='<button type="button" class="sv137-page-btn" onclick="window.sv137SetPage&&window.sv137SetPage('+(sv137Page-1)+')" '+(sv137Page<=1?'disabled':'')+'>‹</button>';
  for(var i=start;i<=end;i++)out+='<button type="button" class="sv137-page-btn '+(i===sv137Page?'active':'')+'" onclick="window.sv137SetPage&&window.sv137SetPage('+i+')">'+i+'</button>';
  out+='<button type="button" class="sv137-page-btn" onclick="window.sv137SetPage&&window.sv137SetPage('+(sv137Page+1)+')" '+(sv137Page>=pages?'disabled':'')+'>›</button>';
  return out;
}
window.sv137SetPage=function(p){sv137Page=p;apply()};
window.sv137SetPageSize=function(v){SV137_PAGE_SIZE=parseInt(v,10)||20;sv137Page=1;apply()};
window.sv137RefreshCounts=function(){var a=filtered(),sc=selectedCount();var c=sv137ById('count');if(c)c.textContent='已选 '+sc+' / '+((DATA&&DATA.summary&&DATA.summary.total)||0)+' 个节点';var f=sv137ById('sv137TableCount');if(f)f.textContent='已选 '+sc+' / '+a.length+' 个节点';sv137UpdateRestoreState();};
function sv137UpdateRestoreState(){var r=sv137ById('restoreNames');if(!r)return;var can=false;if(DATA&&DATA.nodes){can=DATA.nodes.some(function(n){var old=n.rawName||n.originalName;return old&&old!==n.name})}r.disabled=!can;r.setAttribute('aria-disabled',can?'false':'true');}
var sv137BaseApply=apply;
apply=function(){
  try{
    sv137EnsureUI();
    if(!DATA){var tb=sv137ById('tbody');if(tb)tb.innerHTML='<tr><td colspan="9"><div class="sv137-empty">先输入订阅 URL，或展开“粘贴原文”粘贴订阅内容。<br>分析后可筛选、勾选节点，再执行测活、落地检测、清理和导出。</div></td></tr>';sv137RenderHealth([]);sv137RefreshCounts();emit('afterApply',[]);sv137FinalizeLayout();return}
    var a=filtered(),key=sv137Key(a);if(key!==sv137LastKey){sv137Page=1;sv137LastKey=key}
    var start=(sv137Page-1)*SV137_PAGE_SIZE,show=a.slice(start,start+SV137_PAGE_SIZE),tb=sv137ById('tbody');
    if(tb)tb.innerHTML=show.length?show.map(function(n,i){return sv137Row(n,start+i)}).join(''):'<tr><td colspan="9"><div class="sv137-empty">当前筛选无结果。尝试调整筛选条件，或清空“仅可用”筛选。</div></td></tr>';
    var foot=sv137ById('sv137TableFooter');if(foot)foot.innerHTML='<div id="sv137TableCount">已选 '+selectedCount()+' / '+a.length+' 个节点</div><div class="sv137-pagination">'+sv137Pagination(a.length)+'</div>';
    var c=sv137ById('count');if(c)c.textContent='已选 '+selectedCount()+' / '+((DATA&&DATA.summary&&DATA.summary.total)||0)+' 个节点';
    updateSelectUI();sv137UpdateRestoreState();sv137RenderHealth(a);sv137UpdateCharts();emit('afterApply',a);sv137FinalizeLayout();
  }catch(e){try{sv137BaseApply()}catch(_){}console.log(e)}
};
var sv137BaseRender=render;
render=function(d){sv137BaseRender(d);sv137EnsureUI();sv137UpdateCharts();sv137RenderHealth(filtered());sv137FinalizeLayout()};
function sv137AnalyzeSuccess(d,label){if(!d||d.ok===false)throw new Error((d&&d.error)||'分析失败');render(d);st((label||'分析完成')+'：'+((d.summary&&d.summary.total)||((d.nodes||[]).length)||0)+' 个节点','success')}
function analyzeURL(){var u=(sv137ById('url')&&sv137ById('url').value||'').trim();if(!u||!sv137IsURL(u)){sv137SetBusy(false);st('无法解析订阅链接。请检查 URL，或改用粘贴内容分析。','error');return}sv137SetBusy(true);st('正在拉取并分析订阅…','loading');loadJSON('/api/analyze?url='+encodeURIComponent(u)+'&t='+Date.now()).then(function(d){sv137AnalyzeSuccess(d,'分析完成')}).catch(function(e){var m='无法解析订阅链接。';if(sv137HasData())m+=' 当前显示上一次分析结果。';m+=' 请检查 URL，或改用粘贴内容分析。';st(m,'error')}).then(function(){sv137SetBusy(false)})}
function sample(){sv137SetBusy(false);st('正在载入演示数据…','loading');loadJSON('/api/sample?t='+Date.now()).then(function(d){sv137AnalyzeSuccess(d,'演示数据已加载')}).catch(function(e){st('演示数据加载失败：'+(e.message||e),'error')})}
function analyzeText(){var t=(sv137ById('raw')&&sv137ById('raw').value)||'';if(!t.trim()){document.body.classList.add('raw-open');st('请先在“粘贴原文”中粘贴订阅内容。','error');return}st('正在分析粘贴内容…','loading');loadJSON('/api/analyze-text?t='+Date.now(),{method:'POST',body:t,headers:{'Content-Type':'text/plain;charset=utf-8'}}).then(function(d){sv137AnalyzeSuccess(d,'粘贴内容分析完成')}).catch(function(e){var m='无法解析粘贴内容。';if(sv137HasData())m+=' 当前显示上一次分析结果。';m+=' 请检查格式后重试。';st(m,'error')})}
function sv137EnsureUI(){
  sv137InstallStyle();document.body.classList.add('sv137');document.body.classList.toggle('raw-open',sv137RawOpen);
  var hero=sv137Q('.hero');if(hero){var h1=sv137Q('h1',hero);if(h1)h1.textContent='订阅节点分析';var p=sv137Q('p',hero);if(p)p.textContent='拉取或粘贴订阅内容，解析节点分布、协议、国家/地区、数量、健康状态，并支持筛选与导出。';var url=sv137ById('url'),pull=sv137ById('pull'),demo=sv137ById('demo'),textBtn=sv137ById('textBtn'),raw=sv137ById('raw');if(pull&&!pull._sv137Icon){pull._sv137Icon=1;pull.innerHTML=sv137BtnIcon('拉取分析','⧉')}if(demo&&!demo._sv137Icon){demo._sv137Icon=1;demo.innerHTML=sv137BtnIcon('演示数据','♙')}if(textBtn&&!textBtn._sv137Icon){textBtn._sv137Icon=1;textBtn.innerHTML=sv137BtnIcon('分析粘贴内容','▣')}var actions=sv137ById('sv137InputActions');if(!actions&&url){actions=document.createElement('div');actions.id='sv137InputActions';actions.className='sv137-input-actions';url.parentNode.insertBefore(actions,url.nextSibling)}if(actions){[pull,demo,textBtn].forEach(function(b){if(b)actions.appendChild(b)})}var toggle=sv137ById('sv137PasteToggle');if(!toggle&&raw){toggle=document.createElement('button');toggle.id='sv137PasteToggle';toggle.type='button';toggle.className='sv137-paste-toggle';toggle.innerHTML='<span>☷ 粘贴原文</span>';actions.parentNode.insertBefore(toggle,actions.nextSibling);toggle.onclick=function(){sv137RawOpen=!sv137RawOpen;document.body.classList.toggle('raw-open',sv137RawOpen)}}var panel=sv137ById('sv137RawPanel');if(!panel&&raw){panel=document.createElement('div');panel.id='sv137RawPanel';panel.className='sv137-raw-panel';raw.parentNode.insertBefore(panel,raw);panel.appendChild(raw)}var stat=sv137ById('status');if(stat&&hero&&stat.parentNode!==hero)hero.appendChild(stat)}
  sv137EnsureHealthCard();
  var table=sv137Q('table'),nodeCard=sv137Closest(table,'.card');if(nodeCard){nodeCard.classList.add('sv137-node-card');var nh=sv137Q('h2',nodeCard);if(nh)nh.textContent='节点列表';var thead=sv137Q('thead',table);if(thead)thead.innerHTML='<tr><th><input type="checkbox" class="rowchk" aria-label="全选" onclick="if(this.checked){window.selectCurrent&&window.selectCurrent()}else{window.clearSelected&&window.clearSelected()}"></th><th>节点名</th><th>协议</th><th>地区</th><th>连通延迟 ↓</th><th>落地耗时</th><th>国家识别</th><th>状态</th><th></th></tr>';var controls=sv137ById('sv137TableControls');if(!controls){controls=document.createElement('div');controls.id='sv137TableControls';controls.className='sv137-table-controls';nodeCard.insertBefore(controls,table)}var q=sv137ById('q'),pf=sv137ById('pf'),cf=sv137ById('cf');[q,pf,cf].forEach(function(el){if(el)controls.appendChild(el)});if(!sv137ById('onlyAlive')){var lab=document.createElement('label');lab.className='sv137-toggle';lab.innerHTML='<input type="checkbox" id="onlyAlive"><span class="sv137-switch"></span><span>仅可用</span>';controls.appendChild(lab);var oa=sv137ById('onlyAlive');if(oa){oa.addEventListener('change',apply)}}else{controls.appendChild(sv137Closest(sv137ById('onlyAlive'),'.sv137-toggle'))}if(table&&table.parentNode===nodeCard&&!sv137ById('sv137TableFooter')){var f=document.createElement('div');f.id='sv137TableFooter';f.className='sv137-table-footer';nodeCard.insertBefore(f,table.nextSibling)}var bulk=sv137ById('sv137BulkToolbar');if(!bulk){bulk=document.createElement('div');bulk.id='sv137BulkToolbar';bulk.className='sv137-bulk-toolbar';var ref=sv137ById('sv137TableFooter')||table;nodeCard.insertBefore(bulk,ref.nextSibling)}var ids=['selectCurrent','invertCurrent','clearSelected','__sep1','alive','landing','geo','__sep2','cleanNames','restoreNames'];ids.forEach(function(id){if(id.indexOf('__sep')===0){if(!sv137ById('sv137'+id)){var sep=document.createElement('span');sep.id='sv137'+id;sep.className='sv137-sep';bulk.appendChild(sep)}return}var b=sv137ById(id);if(!b)return;if(id==='restoreNames'){var w=sv137ById('restoreNamesWrap');if(!w){w=document.createElement('span');w.id='restoreNamesWrap';w.className='sv137-tipwrap';w.tabIndex=0;w.setAttribute('data-tip','清理节点名后可用')}bulk.appendChild(w);w.appendChild(b)}else bulk.appendChild(b)});}
  var exportType=sv137ById('exportType'),copyAlive=sv137ById('copyAliveBtn'),copyBtn=sv137ById('copyBtn'),exportBtn=sv137ById('exportBtn');if(exportBtn)exportBtn.innerHTML=sv137BtnIcon('导出文件','⇩');if(copyBtn)copyBtn.innerHTML=sv137BtnIcon('复制全部','▣');if(copyAlive)copyAlive.innerHTML=sv137BtnIcon('复制可用','▣');var exp=sv137ById('sv137ExportCard');if(!exp&&exportType){exp=document.createElement('section');exp.id='sv137ExportCard';exp.className='sv137-export-card';exp.innerHTML='<div class="sv137-export-title">导出</div><div id="sv137ExportRow" class="sv137-export-row"></div><div class="sv137-export-help">导出包含当前筛选结果的节点，支持 Clash YAML 等格式，便于快速导入使用。</div>';var table2=sv137Q('table');var nc=sv137Closest(table2,'.card');if(nc&&nc.parentNode)nc.parentNode.insertBefore(exp,nc.nextSibling)}var er=sv137ById('sv137ExportRow');if(er){[exportType,copyAlive,copyBtn,exportBtn].forEach(function(el){if(el)er.appendChild(el)})}
  var adv=sv137ById('sv137AdvancedCard');if(!adv){adv=document.createElement('section');adv.id='sv137AdvancedCard';adv.className='sv137-advanced-card';var ec=sv137ById('sv137ExportCard');if(ec&&ec.parentNode)ec.parentNode.insertBefore(adv,ec.nextSibling)}if(adv){sv137QA('.rulebox').forEach(function(rb){adv.appendChild(rb)});sv137QA('details',adv).forEach(function(d,i){var sum=sv137Q('summary',d);if(!sum||sum._sv137)return;var title=sum.textContent.replace(/设置$/,'设置').replace('节点名清理规则设置','节点名清理规则');var desc=['配置落地检测的方式、目标、超时与重试等参数。','配置测活方式、并发、超时、重试与阈值等参数。','配置清理与替换规则，支持正则/关键词过滤。','配置 Gist Token、文件名与远程订阅发布参数。'][i]||'更多高级选项。';var state=['已配置','已配置','3 条规则','可选'][i]||'可选';sum.innerHTML='<span>'+esc(title)+'</span><span class="sv137-acc-desc">'+esc(desc)+'</span><span class="sv137-acc-state">'+esc(state)+'</span><span class="sv137-chevron">⌄</span>';sum._sv137=1;d.open=false})}
  sv137UpdateRestoreState();
}
function sv137FinalizeLayout(){sv137EnsureUI();var restore=sv137ById('restoreNames');if(restore&&!restore._sv137Tip){restore._sv137Tip=1;restore.setAttribute('title','清理节点名后可用')}var stEl=sv137ById('status');if(stEl&&!stEl.classList.contains('sv137-status'))st(sv137LastStatusText||'',sv137State||'idle')}
var sv137BaseDOMContentLoaded=function(){sv137EnsureUI();sv137SetBusy(false);['q','pf','cf','unique'].forEach(function(id){var el=sv137ById(id);if(el&&!el._sv137Bound){el._sv137Bound=1;el.addEventListener('input',apply);el.addEventListener('change',apply)}});function bind(id,fn){var el=sv137ById(id);if(el)el.onclick=fn}bind('pull',analyzeURL);bind('demo',sample);bind('textBtn',analyzeText);bind('geo',geoFill);bind('landing',landingTest);bind('alive',function(){window.aliveTest()});bind('cleanNames',window.cleanNames);bind('applyRules',window.cleanNames);bind('restoreNames',window.restoreNames);bind('exportBtn',window.doExport);bind('copyBtn',window.copyExport);bind('copyAliveBtn',window.copyAliveExport);bind('selectCurrent',window.selectCurrent);bind('invertCurrent',window.invertCurrent);bind('clearSelected',window.clearSelected);apply();st('', 'idle')};
window.addEventListener('DOMContentLoaded',sv137BaseDOMContentLoaded);
hook('afterApply',function(a){sv137RenderHealth(a||filtered());sv137UpdateRestoreState()});
