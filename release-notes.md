# SubViz-win 修复说明

## 本次修复点

- 修复“测活中 0 / N 长时间不更新”的问题：Node 版测活后端不再通过切换同一个 Mihomo selector 后走 HTTP 代理串行检测，改为使用 Mihomo 原生 `/proxies/{name}/delay` 单节点接口。
- 前端仍按用户设置的并发数逐个派发 `/api/availability/check`，后端单节点测活可以真正并发返回，因此页面会实时从 `测活中 0 / 99` 推进到 `1 / 99`、`2 / 99`。
- 保留“测活开始 / 停止测活”按钮状态逻辑，停止后不清空已完成测活结果，不清空用户当前选择，未完成节点保持未知。
- 增强取消逻辑：Mihomo API 请求支持前端 AbortController / 连接关闭信号，用户停止测活后不再继续派发后续节点。
- 保持发布说明文件位于项目根目录 `release-notes.md`，不再使用 `.github/release-notes.md`。

## 影响文件

- `lib/availability.js`
- `lib/mihomo-manager.js`
- `lib/utils.js`
- `tools/node-app-test.js`
- `release-notes.md`

## 测试结果

- `npm test`：通过
- `npm run check`：通过
