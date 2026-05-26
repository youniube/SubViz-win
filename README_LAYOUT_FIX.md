SubViz 页面布局与滚动条修复说明

修改文件：
- public/app.js
- src/client/app.js
- subviz.js（由 npm run check / tools/build-subviz.js 根据 src/client/app.js 生成）

使用方式：
把压缩包内文件按原目录覆盖到 SubViz 项目根目录，然后重新打开 SubViz.bat 即可。

主要修复：
1. 修复 #onlyAlive 隐藏 checkbox 因继承 input width:100% 导致的页面横向溢出。
2. 为 html/body、页面主滚动条、节点卡片横向滚动条、批量工具栏滚动条、图表内部滚动条统一深色主题样式。
3. 国家/地区分布改为“图表内容可滚动 + 查看/收起入口固定在外层可见”，避免白色内部滚动条破坏视觉。
4. 主容器保持 width:min(100%,1280px) 并居中，grid/card/table 控制 min-width:0，适配 1366/1440/1920 等宽度。

验证：
- npm run check 已通过。
- 使用 Chromium 模拟 1366、1440、1920、1024、800 宽度检查 document 横向滚动宽度，均未出现页面级横向溢出。
