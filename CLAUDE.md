# Threeyang's Blog — Agent Guide

这是 Hexo 博客源码仓库。面向用户的说明在 `README.md`，详细运维流程在
`docs/runbook.md`。

## 当前基线

- Node.js：22.23.1（`.nvmrc`）
- Hexo：8.1.2
- Butterfly：5.6.1，通过 npm 安装
- 自定义域名：`threeyang.top`
- 公开源码仓库：`https://github.com/threeyang3/hexo-blog-source.git`
- Pages 仓库：`https://github.com/threeyang3/threeyang3.github.io.git`
- Pages 分支：`master`
- 本地源码分支：`main`

## 关键路径

- `_config.yml`：Hexo、插件、URL 和部署配置。
- `_config.butterfly.yml`：本站的主题覆盖项。
- `source/_posts/`：已发布文章。
- `source/_drafts/`：草稿和待发布文章。
- `source/_data/media.json`：素材尺寸、用途与替代文本。
- `source/img/`：个人主题图片，禁止移回主题包。
- `source/CNAME`：域名唯一事实来源。
- `tools/verify-build.js`：部署保护验证。
- `tools/verify-content.js`：文章 Front Matter、abbrlink、封面与受管链接校验。
- `tools/smoke-live.js`：线上首页、Sitemap、Feed、robots 与加密文章检查。
- `admin/server.js`：仅监听本机的 GUI 服务、API 与命令白名单。
- `admin/content-store.js`：文章/素材读写、并发哈希、路径边界与主题视觉白名单。
- `admin/release-report.js`：只读发布清单和受保护配置变更分组。
- `admin/public/`：无构建步骤的 Blog Control Room 前端。
- `scripts/build-info.js`：生成 `public/build-info.json`。
- `scripts/encryption-secrets.js`：在文章渲染前从环境变量或本机忽略文件注入加密密码。
- `tools/test-admin.js`：GUI 的 API 与安全边界测试。
- `tools/test-editorial-workflow.js`：隔离目录中的状态、历史、差异与恢复测试。
- `tools/verify-performance.js`：生成结果的体积、脚本和第三方来源预算。
- `tools/verify-source-privacy.js`：公开源码的明文密码、令牌和私钥扫描。
- `docs/gui.md`：GUI 使用、架构边界与故障排查。
- `docs/maintenance-2026-07-27.md`：当前维护基线记录。

## 红线

1. 不编辑 `node_modules/hexo-theme-butterfly`。
2. 不重新创建 `themes/butterfly`。
3. 不把 `_config.yml` 复制到 `_config.butterfly.yml`。
4. 不改变 `source/CNAME`、部署仓库或 `master` 分支，除非用户明确要求迁移。
5. 不直接运行 `hexo deploy`；部署只使用 `npm run deploy`。
6. 不修改 GitHub Pages Custom domain 来“修复”普通构建错误。
7. 不提交 `public/`、`.deploy_git/`、`db.json` 或 `node_modules/`。
8. 不在日志、文档或提交信息中暴露文章密码。
9. GUI 不得监听 `0.0.0.0`，不得增加任意命令输入；新增动作必须是固定命令、
   固定参数并保持 `shell: false`。
10. GUI 部署必须继续调用 `npm run deploy`，不得绕过 `predeploy`，并保留
    `DEPLOY threeyang.top` 二次确认。
11. GUI 保存文章必须保留未知 Front Matter，尤其不得读取、返回或覆盖
    `password`；写入必须检查 `originalHash`。
12. GUI 只允许向 `source/img/`、`source/picture/`、`source/_posts/`、
    `source/_drafts/`、`source/_data/media.json` 和被忽略的 `.blog-admin/`
    受管目录写入，不得接受浏览器传入的文件系统路径。
13. 外观编辑只允许 `index_img`、`default_top_img`、`cover.default_cover` 和
    `avatar.img`，保存前备份到被忽略的 `.blog-admin/backups/`，并要求
    `SAVE VISUALS`。
14. 文章历史原始版本只保存在被忽略的本机目录；历史列表和差异 API 必须过滤
    `password`，恢复仍须校验 `originalHash`，并先保存当前版本。
15. `docs/templates/pages-artifact.yml` 只是未启用模板。虽然源码 remote 已配置，
    但 Pages 发布源确认和 environment 审批完成前，不得复制为活动工作流。
16. 公开源码只能使用 `password_secret` 引用；真实密码只允许位于被忽略的
    `.blog-admin/secrets.json` 或 GitHub Repository Secrets。不得提交明文 `password`，
    不得把占位密码用于 `main` 构建或生产部署。
17. 首次公开推送必须使用不含旧父提交的干净根提交；含历史明文密码的本地旧历史只能
    保存在不推送的本地恢复标签中。

## 常用命令

```bash
npm ci
npm run check
npm run gui
npm run test:gui
npm run verify:content
npm run verify:performance
npm run verify:source
npm run server
npm run smoke:live
npm run deploy
```

任何配置、主题、插件或依赖变更都必须在提交前通过 `npm run check`。
修改 `admin/` 或 GUI API 后还必须通过 `npm run test:gui`。

升级前恢复点为本地标签 `maintenance-baseline-2026-07-27`。恢复单个文件，
不要无确认执行破坏性的全仓库 reset。
