## 本次修复 / 更新

- 修复订阅拉取时把 `Content-Type: text/html` 直接判定为 HTML 错误页的问题。
- 现在会优先根据响应正文判断是否真的是 HTML / 登录页 / 错误页；如果正文能解析出节点，即使服务端错误返回 `text/html`，也会按有效订阅处理。
- 修复因此导致的 Clash.Meta / Shadowrocket 等客户端 UA 明明返回有效订阅内容，却在自动重试里被误判为“内容疑似 HTML 页面”的问题。
- 保留自动 UA 短路逻辑：命中第一个可解析出节点的 UA 后立即停止，不继续请求后续 UA。
- 保留固定 UA 逻辑：手动选择 Clash.Meta、Shadowrocket 等客户端时只请求一次，不自动 fallback。

## 影响文件

- `server.js`
- `subviz.js`
- `tools/node-app-test.js`
- `.github/release-notes.md`

## 测试结果

- `npm test` 通过。
- `npm run check` 通过。
- 新增回归测试：有效订阅正文即使响应头是 `Content-Type: text/html`，也必须正常解析节点。
- 已验证自动 UA 模式仍会在 Clash.Meta 命中后停止，不继续请求 Shadowrocket。
- 已验证固定 UA 模式仍只请求所选客户端一次。
