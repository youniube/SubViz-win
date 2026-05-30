## 本次修复 / 更新

- 修复点击“测活开始”后按钮状态不立即变化的问题：现在会立刻进入运行态，按钮立即切换为“停止测活”，状态栏立即显示“测活中 0 / 总数”。
- 修复测活进度长期停留在 `0 / 2` 的问题：前端改为按节点并发调用单节点测活接口，每完成一个节点就实时更新进度、节点可用状态和健康统计。
- 新增 `POST /api/availability/check` 单节点测活接口别名，前端测活队列优先调用该接口，旧 `/api/availability` 仍保留兼容。
- 修复“停止测活”无法立即生效的问题：运行中再次点击同一按钮会调用 `AbortController.abort()`，停止继续派发新节点，保留已完成结果，未测节点保持未知，且不清空当前勾选。
- 修复旧增强布局逻辑覆盖测活按钮文案的问题：`sv133` / `sv135` / `sv137` 渲染后都会按运行状态统一恢复“测活开始 / 停止测活”。
- `AbortError` / 主动停止不再作为普通红色失败提示显示。
- 重新拉取订阅、载入演示数据或分析粘贴内容时，会静默取消旧测活任务，避免旧请求回写新页面状态。
- 保持前端“拉取 / Mihomo 诊断”面板不恢复，导出功能仍保留 Mihomo YAML、sing-box JSON、通用 URI、Base64 URI，不恢复旧版 Clash YAML / JSON 备份入口。

## 影响文件

- `public/app.js`
- `src/client/app.js`
- `server.js`
- `lib/availability.js`
- `src/server/90-html-router.js`
- `subviz.js`
- `tools/client-render-test.js`
- `tools/settings-flow-test.js`
- `.github/release-notes.md`

## 测试结果

- `npm test` 通过。
- `npm run check` 通过。
- 新增 / 更新回归测试覆盖：
  - 点击“测活开始”后按钮立即变为“停止测活”。
  - 点击“停止测活”会调用 abort，并恢复“测活开始”。
  - `AbortError` / 主动停止不显示为普通失败。
  - 测活进度从 `0 / 总数` 更新到 `1 / 总数`，完成后显示 `测活完成 总数 / 总数`。
  - 停止后已完成结果保留，未测节点保持未知。
  - 停止测活不清空已勾选节点。
