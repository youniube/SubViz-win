## 本次修复 / 更新

- GitHub Actions 发布流程现在优先读取 `.github/release-notes.md` 作为 GitHub Release 发布说明。
- 保留自动递增 Tag 逻辑：例如 `v1.0.4 → v1.0.5 → v1.0.6`。
- 保留自动构建 Windows x64 发布包、自动创建 Git Tag、自动创建 GitHub Release、自动标记 Latest。
- 当 `.github/release-notes.md` 不存在或为空时，发布流程会自动回退到手动输入的说明或 Git 提交记录。
- 后续 AI 修复项目时，只要同步更新 `.github/release-notes.md`，发布说明就会自动带入 Releases 页面。

## 影响文件

- `.github/workflows/build.yml`
- `.github/release-notes.md`

## 测试结果

- 已检查 workflow 会优先读取 `.github/release-notes.md`。
- 已检查 release 创建命令继续使用 `--notes-file release-notes.md`。
- 本次只修改 GitHub Actions 发布流程和发布说明模板，不涉及 SubViz 运行时代码。
