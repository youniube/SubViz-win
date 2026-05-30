# SubViz-win 界面流程整理优化

## 本次修复点

1. 顶部订阅输入区只保留清晰主流程入口：“拉取并分析”和“填入订阅内容”。
2. 移除前端示例数据按钮、事件入口和相关用户可见文案，不影响正常订阅拉取和粘贴内容解析。
3. 节点列表上方去掉大段说明，保留隐藏重复节点、已选数量、自动选择可用节点、搜索、协议筛选、地区筛选和仅可用开关。
4. 列表底部批量按钮重排为“选择操作 / 检测操作 / 节点整理”三组，并突出“开始测活”。
5. 新增“停止测活”按钮并接入现有取消逻辑，仅测活进行中显示。
6. 在“开始测活”和“落地检测”旁新增“设置”入口，可定位到对应设置区。
7. 前端用户可见文案统一使用“测活”，对应设置区统一命名为“节点测活设置”。
8. 增加测活、落地检测启动前的基础配置校验，配置异常时给出明确提示。

## 影响文件

- public/app.js
- src/client/app.js
- public/index.html
- src/server/index.html
- lib/availability.js
- lib/mihomo-manager.js
- tools/client-render-test.js
- tools/settings-flow-test.js
- subviz.js
- release-notes.md

## 测试结果

- npm test：通过
- npm run check：通过
