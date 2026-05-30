# SubViz-win 发布说明

## 本次修复点

- 修复“测活中 0 / N”一直不增长的问题：前端测活请求现在会真正派发到 `/api/availability/check`，并在成功、失败、超时、JSON 解析异常等结果下都推进进度。
- 修复后端 `/api/availability/check` 请求在正常请求关闭事件中被误判为 abort，导致接口不返回、前端进度卡住的问题。
- 为前端单节点测活请求增加请求级兜底超时，避免某个 `fetch` 永远 pending 后占满并发队列。
- 为后端 Mihomo `/proxies/{name}/delay` 链路补充诊断日志，并保留请求超时、404、节点名不匹配、Mihomo 异常时的明确返回。
- 增强 Mihomo 节点名匹配：在精确匹配之外增加 normalized name fallback，匹配不到时返回 `node_not_found_in_mihomo`，不再卡住。
- 前端测活停止后恢复按钮，不清空已选节点，不把用户主动停止产生的 AbortError 显示成普通红色失败。
- 前端和后端均增加关键链路日志，便于判断是 UI 未派发、API 未命中、Mihomo delay 失败还是前端未处理返回。
- 同步修改 `public/app.js` 与 `src/client/app.js`，确认本地 Windows 服务实际静态页面使用 `public/app.js`，Surge/模块构建使用 `src/client/app.js` 重新生成 `subviz.js`。
- 发布说明继续放在项目根目录 `release-notes.md`，不生成 `.github/release-notes.md`。

## 影响文件

- `public/app.js`
- `src/client/app.js`
- `server.js`
- `lib/availability.js`
- `lib/mihomo-manager.js`
- `subviz.js`
- `tools/node-app-test.js`
- `tools/settings-flow-test.js`
- `release-notes.md`

## 测试结果

- 已执行 `npm test`，全部通过。
- 已执行 `npm run check`，全部通过。
- 新增/强化覆盖：前端开始测活立即进入 running；调用 `/api/availability/check`；成功、失败、前端超时都推进 completed；请求 body 携带 `node / timeout / index / total`；后端接口返回单节点结果；Mihomo delay 404/节点缺失/超时不会导致进度卡住。
