# 维护与部署手册

## 环境

使用 `.nvmrc` 指定的 Node.js 22.23.1。切换 Node 后执行：

```bash
node --version
npm ci
```

不要用 `npm install` 代替日常的可复现安装；只有主动更新依赖时才修改
`package.json` 和 `package-lock.json`。

## 日常写作与预览

首次克隆或更换电脑时，先创建本机加密密码文件：

```powershell
New-Item -ItemType Directory -Force .blog-admin
Copy-Item docs/templates/blog-secrets.example.json .blog-admin/secrets.json
```

编辑 `.blog-admin/secrets.json`，填写 `BLOG_ENCRYPTION_PASSWORD_C57A`。该目录被 Git
忽略，不能上传、粘贴到日志或加入备份报告。也可以使用同名环境变量临时提供密码。

推荐双击根目录的 `ManageBlog.bat` 打开 Blog Control Room。也可以在命令行运行：

```bash
npm run gui
```

管理页面默认位于 `http://127.0.0.1:4173/`，启动时会自动附带一次性访问
令牌并在浏览器中打开。文章页可以新建/编辑 Markdown、摘要和封面；素材库可以
上传本地图片并生成多比例 WebP；治理页提供内容问题队列；外观页可以在白名单保护下
调整背景、默认封面和头像。页面里的
“启动预览”会启动下方的 Hexo 服务。

新文章默认是 `_drafts` 中的草稿；“待发布”仍留在 `_drafts` 并带
`workflow: pending`，只有“已发布”会移动到 `_posts`。状态移动与恢复都要求
`originalHash` 一致。每次有变化的保存前版本位于被忽略的
`.blog-admin/history/`，不要把其中可能含原始 `password` 的文件提交、上传或粘贴到日志。

仍可直接使用：

```bash
npm run server
```

访问 `http://localhost:5000/`。新增文章后重点检查 Front Matter 中的
`title`、`date`、`categories`、`tags` 和 `abbrlink`。

外观页保存时输入 `SAVE VISUALS`。服务会先把原主题配置备份到
`.blog-admin/backups/`；保存后必须运行完整检查并查看真实主题预览。

## 发布前检查

```bash
npm run check
git status --short
```

完整检查依次执行：

1. 扫描公开源码中的明文文章密码、常见令牌和私钥。
2. 文章必填 Front Matter、abbrlink 唯一性、本地封面和受管链接校验。
3. 清理并生成站点；缺少真实加密 secret 时立即失败。
4. 校验 CNAME、部署配置、canonical 和加密文章。
5. 校验 `sitemap.xml`、`atom.xml`、`search.xml`、`robots.txt` 和
   `build-info.json`。
6. 校验代表页面体积、首页脚本数和运行时第三方来源预算。

然后人工检查：

1. 首页菜单、头像、背景和文章列表。
2. 任意文章页、分类页、标签页和友链页。
3. `/books/` 与 `/movies/`。
4. `/posts/c57a/` 显示密码输入框，正确密码能够解密。
5. `public/CNAME` 内容仍为 `threeyang.top`。
6. 顶部搜索按钮能够打开本地搜索，且加密正文不会出现在结果摘要中。

## 部署

GUI 中点击“准备部署”，人工输入 `DEPLOY threeyang.top` 后才会执行部署。
点击前先查看“发布清单”；若“受保护配置”不为空，逐项核对 `_config.yml`、
`_config.butterfly.yml`、`source/CNAME`、依赖和工作流改动。发布清单是只读的，
不会自动提交或推送。
命令行方式仍为：

```bash
npm run deploy
```

该命令会先自动执行完整检查，再使用 `_config.yml` 中固定的仓库和
`master` 分支部署，最后自动等待 Pages 更新并运行线上健康检查。不要直接使用
`hexo deploy`、`hexo d` 或 `hexo deploy -g`。

部署后在 GUI 中运行“线上健康检查”，或执行：

```bash
npm run smoke:live
```

该检查只读取线上首页、Sitemap、Atom、robots、加密文章、旧文章跳转和
`build-info.json`，不会修改 Pages 设置。默认最多尝试 12 次、间隔 10 秒；只有
`build-info.json` 的 `commit` 与当前源码 `HEAD` 相同才通过。排障时可临时设置
`BLOG_SMOKE_ATTEMPTS`、`BLOG_SMOKE_DELAY_MS`、`BLOG_LIVE_URL` 或
`BLOG_EXPECTED_COMMIT`，不要把真实文章密码放入这些变量。

## 配置变更规则

1. 修改前确保 `git status` 清晰，必要时先提交。
2. `_config.yml` 和 `_config.butterfly.yml` 分开修改，不互相复制。
3. 不修改 GitHub Pages 的 Custom domain，除非确实要迁移域名。
4. 域名只通过 `source/CNAME` 管理。
5. 每次依赖或主题升级只处理一个逻辑主题，并运行 `npm run check`。
6. 不在 `node_modules/` 中编辑文件。
7. GUI 外观页只处理四个视觉字段；其他主题设置仍通过 Git 审查后手工修改。

## 回滚

全面维护前的本地恢复点：

```text
maintenance-baseline-2026-07-27
```

查看旧文件：

```bash
git show maintenance-baseline-2026-07-27:_config.yml
git show maintenance-baseline-2026-07-27:_config.butterfly.yml
```

不要用 `git reset --hard` 回滚整个目录；优先从标签恢复明确文件，并再次运行
`npm ci` 和 `npm run check`。

## CNAME/Pages 故障排查

按以下顺序检查：

1. `source/CNAME` 与 `public/CNAME` 是否都是 `threeyang.top`。
2. `_config.yml` 的部署仓库是否为
   `https://github.com/threeyang3/threeyang3.github.io.git`。
3. 部署分支是否为 `master`。
4. GitHub 远端 `master` 根目录是否存在正确的 `CNAME`。
5. `https://threeyang3.github.io/` 是否重定向到自定义域名。
6. `https://threeyang.top/` 是否返回 200。
7. `https://threeyang.top/build-info.json` 是否存在，并与预期源码提交一致。

若 GitHub 报 `already taken`，先使用账户级
`https://github.com/settings/pages` 验证域名所有权，不要在仓库设置里反复
删除、添加 Custom domain。

## 安全审计

```bash
npm audit --omit=dev --registry=https://registry.npmjs.org
```

2026-07-28 的生产依赖审计为 0。Butterfly 构建链仍通过旧版
`glob → minimatch` 引入 `brace-expansion`，因此 `package.json` 使用 npm
`overrides` 将其固定到提供 CommonJS 入口且支持 Node 22 的修复版 5.0.8。
依赖更新后必须同时运行 `npm audit --omit=dev` 与 `npm run check`，确认覆盖仍兼容；
不要使用 `npm audit fix --force`。

## 源码托管与 Actions 部署

源码仓库可以公开，但只能提交 `password_secret` 引用。公开仓库设置中必须创建
Repository Secret `BLOG_ENCRYPTION_PASSWORD_C57A`；真实值不能写入 Actions YAML、
Markdown、提交信息或日志。`threeyang3/threeyang3.github.io` 仍只存放加密后的静态
生成结果，不能作为源码 remote。当前源码 remote 是
`https://github.com/threeyang3/hexo-blog-source.git`。

首次公开推送必须从当前已净化文件树生成无父提交的根提交，不能直接推送含旧明文密码的
本地历史。旧历史只保留为本地恢复标签，且该标签绝不能 push。

CI 已运行 `npm run check`；公开源码仓库的 Pull Request 另运行 dependency review。
个人私有仓库没有 GitHub Advanced Security 时会跳过 dependency review，但仍执行 GUI
测试和完整构建。源码 remote 已配置，但尚未启用 `actions/deploy-pages`。在确认并切换
GitHub Pages 发布源之前，不要新增第二套自动部署；当前唯一发布路径仍是受保护的
`npm run deploy`。

仓库提供 `docs/templates/pages-artifact.yml` 作为未启用模板。只有同时满足以下条件，
才可审查后复制到 `.github/workflows/pages.yml`：

1. 源码仓库已有正确的 `origin`。
2. GitHub Pages Source 已明确切到 GitHub Actions。
3. Custom domain 仍为 `threeyang.top`。
4. `github-pages` environment 的分支限制和人工审批已确认。
5. Repository Secret `BLOG_ENCRYPTION_PASSWORD_C57A` 已配置。

启用后先完成至少两到三次人工触发、构建、审批、部署和 smoke test，再评估是否退役
本地 `hexo-deployer-git`。两条路径不得同时自动运行。
