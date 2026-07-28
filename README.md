# Threeyang's Blog

基于 Hexo 和 Butterfly 的个人博客源码，发布到
[threeyang.top](https://threeyang.top)。

公开源码仓库：[threeyang3/hexo-blog-source](https://github.com/threeyang3/hexo-blog-source)。
生成后的静态站点继续发布到 `threeyang3/threeyang3.github.io`。

## 技术栈

- Node.js 22.23.1（见 `.nvmrc`）
- Hexo 8.1.2
- Butterfly 5.6.1（通过 npm 安装）
- GitHub Pages，部署仓库 `threeyang3/threeyang3.github.io`
- 部署分支 `master`

## 首次使用

```bash
npm ci
npm run verify:source
npm run check
npm run server
```

首次构建前，把 `docs/templates/blog-secrets.example.json` 复制到被 Git 忽略的
`.blog-admin/secrets.json`，并填写本机文章密码。公开源码只保存
`password_secret` 名称；GitHub Actions 使用同名 Repository Secret
`BLOG_ENCRYPTION_PASSWORD_C57A`。不要把本机 secrets 文件加入 Git。

本地预览地址为 `http://localhost:5000/`。

日常维护也可以双击 `ManageBlog.bat`，或运行：

```bash
npm run gui
```

控制台会在浏览器打开本机内容工作台，可以：

- 搜索、新建和重新编辑 Markdown 文章，并管理草稿、待发布、已发布状态。
- 表单化编辑标题、日期、分类、标签、摘要和封面。
- 查看逐次保存历史、行级差异，并在并发保护下恢复旧版。
- 上传本地图片；封面工作室可按 16:9、4:3、1:1 裁剪并生成 WebP、记录 alt。
- 在白名单和自动备份保护下修改首页背景、内页顶部图、默认封面和头像。
- 查看内容治理队列、桌面/手机/社交预览和发布前内容/配置差异。
- 启动预览、运行完整检查与性能预算、查看 Git/依赖状态和受保护部署。

它只监听 `127.0.0.1`，不提供任意命令输入框。部署需要输入
`DEPLOY threeyang.top`，外观配置需要输入 `SAVE VISUALS`。

`npm run check` 会先检查文章，再清理缓存、完整生成站点并验证部署保护项：

- 51 篇已有文章的必填 Front Matter 完整，`abbrlink` 全局唯一
- 公开源码中没有明文文章密码、常见 GitHub/AWS 令牌或私钥
- 草稿与已发布文章使用同一套 Front Matter、abbrlink 和本地封面检查
- 站点 URL 为 `https://threeyang.top`
- 部署仓库和 `master` 分支没有被误改
- `source/CNAME` 和 `public/CNAME` 都是 `threeyang.top`
- 首页 canonical URL 正确
- Sitemap、Atom、搜索索引、robots.txt 与 build-info 均已生成
- Butterfly 主题、WebP 背景和个人图片来源正确
- 加密文章使用 hexo-blog-encrypt v4 和预期 KDF 配置
- 关键页面体积、脚本数量和运行时第三方来源没有突破性能预算

## 安全部署

```bash
npm run deploy
```

`predeploy` 会自动执行 `npm run check`。不要直接运行
`hexo deploy` 或 `hexo deploy -g`，否则会绕过保护校验。

部署前还应在浏览器检查首页、文章页、分类、标签、豆瓣页面和加密文章。
部署完成后可在管理台运行“线上健康检查”，或执行：

```bash
npm run smoke:live
```

## 配置职责

- `_config.yml`：Hexo 站点、URL、永久链接、插件和部署配置。
- `_config.butterfly.yml`：只保存本站的 Butterfly 覆盖项。
- `source/CNAME`：自定义域名的唯一事实来源。
- `source/img/`：头像、背景、404 图片等个人资源。
- `admin/content-store.js`：文章、素材和白名单视觉配置的数据层。
- `source/_drafts/`：草稿和待发布文章；正式构建不包含它们。
- `source/_data/media.json`：封面变体、尺寸和替代文本元数据。
- `.blog-admin/history/`：被 Git 忽略的本地文章恢复点，默认每篇保留最近 20 版。
- `scripts/build-info.js`：为生成站点写入 commit 与构建时间。
- `public/`、`.deploy_git/`、`db.json`：生成物或部署缓存，不纳入源码 Git。

不要在 `node_modules/hexo-theme-butterfly` 或 `themes/butterfly` 中保存个人修改。
源码仓库可以公开，但只允许提交密码引用；真实密码分别保存在本机忽略文件和 GitHub
Repository Secret 中。公开的 `threeyang3.github.io` 仓库仍只接收经过验证的静态生成结果。

## 文档

- [架构与配置边界](docs/architecture.md)
- [维护与部署手册](docs/runbook.md)
- [本地 GUI 使用与安全设计](docs/gui.md)
- [2026-07-27 全面维护记录](docs/maintenance-2026-07-27.md)
- [2026-07-27 后续优化路线图](docs/reports/blog-optimization-roadmap-2026-07-27.md)
