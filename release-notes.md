# SubViz-win 本次调整说明

## 本次修复点

- 回退上一版界面优化中“列表底部批量操作按钮拆成三组”的改动，恢复为上一版同一批量操作工具栏布局。
- 回退单独新增的“开始测活 / 落地检测”旁边“设置”入口，恢复为通过底部设置区自行展开配置。
- 回退独立“停止测活”按钮设计，恢复上一版测活按钮运行中切换为“停止测活”的交互。
- 保留顶部订阅入口优化：主按钮为“拉取并分析”，粘贴入口为“填入订阅内容”，不再显示“演示数据”。
- 保留节点列表上方说明精简，不影响隐藏重复节点、已选数量、自动选择可用节点、搜索、协议筛选、地区筛选、仅可用筛选等逻辑。

## 影响文件

- `public/app.js`
- `src/client/app.js`
- `public/index.html`
- `src/server/index.html`
- `lib/availability.js`
- `lib/mihomo-manager.js`
- `subviz.js`
- `release-notes.md`

## 测试结果

- `npm test`：通过
- `npm run check`：通过
