# SubViz-win 测活结果全为不可用修复

## 本次修复点

1. 修复 Mihomo 临时配置 YAML 生成问题：
   - 旧版生成器会把部分字符串以 YAML plain scalar 输出。
   - 当节点名、密码、参数值等以 `@` 等 YAML 保留字符开头时，Mihomo 会拒绝加载配置，并报错：`yaml: found character that cannot start any token`。
   - 配置加载失败后，`/proxies` 中没有订阅节点，测活接口只能返回 `node_not_found_in_mihomo`，表现为节点全是死的。
   - 现在生成 Mihomo YAML 时对所有字符串统一安全加引号，避免整份配置因为单个特殊字符失效。

2. 补充 hysteria 协议转换：
   - 之前只支持 `hysteria2 / hy2`，`hysteria` 会被计入 `unsupported_protocol`。
   - 现在支持将 hysteria 节点转换为 Mihomo 可识别配置。

3. 保留上一版测活链路修复：
   - 前端仍使用 `/api/availability/check` 单节点测活。
   - 单节点成功、失败、超时、404、异常都会完成当前节点并推进进度。
   - Mihomo delay 调用仍带超时保护，避免再次卡在 `0 / N`。

## 影响文件

- `lib/mihomo-manager.js`
- `tools/node-app-test.js`
- `release-notes.md`

## 测试结果

已执行并通过：

```bash
npm test
npm run check
```

新增覆盖：

1. Mihomo YAML 中以 `@` 开头的节点名和密码必须被安全加引号。
2. hysteria 节点可以转换为 Mihomo 配置。
