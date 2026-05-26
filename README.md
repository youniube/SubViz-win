# SubViz 独立版

SubViz 是一个本地运行的订阅节点可视化分析工具。这个版本已经从原 Surge 单文件脚本迁移为 Node.js 本地 Web 服务，并预留 mihomo（Clash Meta）内核用于落地检测和测活。

## 运行方式

Windows：

```bat
SubViz.bat
```

macOS / Linux：

```bash
./SubViz.sh
```

浏览器访问：

```text
http://localhost:3456
```

服务只监听 `127.0.0.1`，不会修改系统代理，也不会占用 Sparkle 常用端口。SubViz 使用的端口：

| 用途 | 端口 |
|---|---:|
| Web 服务 | 3456 |
| mihomo mixed-port | 17890 |
| mihomo SOCKS5 | 17891 |
| mihomo HTTP | 17892 |
| mihomo REST API | 19090 |

## 当前实现

- 复用原项目解析器：Clash YAML、URI、Surge `[Proxy]`、Base64 订阅、重复节点统计。
- 复用原前端 UI：节点列表、筛选、批量选择、GeoIP、落地检测、测活、节点名清理、导出、Gist 上传。
- 新增 Node 本地 API：`/api/health`、`/api/sample`、`/api/analyze`、`/api/analyze-text`、`/api/geoip`、`/api/landing`、`/api/availability`、`/api/gist-*`。
- 新增本地持久化：GitHub Token 保存到 `data/store.json`。
- 新增 mihomo 管理器：运行时生成 `mihomo/config.yaml`，动态注入节点并调用 mihomo API。
- 不启用 TUN，不设置系统代理，只通过本地 mihomo 端口发起检测请求。

## mihomo 二进制

源码包不内置 mihomo 二进制。开发时可手动放到：

```text
mihomo/mihomo.exe      # Windows
mihomo/mihomo          # macOS/Linux
```

如果没有 mihomo，页面的“拉取/粘贴分析、筛选、清理、导出、Gist Token 本地保存”等功能仍可用；“落地检测/测活”会返回 mihomo 不可用的错误。GitHub Actions 发布包会自动下载并打包 Windows x64 的 mihomo。

## 测试

```bash
npm run check
npm test
```

`npm test` 会运行原有 Surge 版本的回归测试，并额外运行独立 Node 版本的模块和本地 API 测试。

## 目录说明

```text
server.js               Node 本地 HTTP 服务入口
lib/                    Node 端模块
public/                 独立版前端页面和静态资源
data/sample.yaml        演示订阅数据
data/store.json         本地 Token 存储，运行时生成
mihomo/config.yaml      mihomo 配置，运行时生成
src/                    原 Surge 源码，保留用于回归测试和解析器复用
tools/                  构建与测试脚本
.github/workflows/      Windows 发布包构建配置
```
