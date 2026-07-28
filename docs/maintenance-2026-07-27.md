# 2026-07-27 全面维护记录

## 后续改进：内容工作台与出版链路

同日把 Blog Control Room 扩展为公众号式本机内容工作台：

- 新增文章列表、搜索、新建、Front Matter 表单、Markdown 编辑与即时预览。
- 新增素材库，支持受限格式上传、复制站内路径和选择文章封面。
- 新增外观页，只允许修改首页背景、内页顶部、默认封面和头像；保存使用配置哈希、
  自动备份、原子写入与 `SAVE VISUALS` 确认。
- 文章保存使用 SHA-256 并发保护，保留未知 Front Matter，且不向浏览器返回密码。
- 后端继续使用 Node 内置 HTTP，无 Web 框架；文件路径和命令均使用白名单。
- 新增 `ManageBlog.bat`、`npm run gui` 与 `npm run test:gui`。
- 服务仅监听 `127.0.0.1`，使用每次启动随机令牌和 Origin 检查。
- 部署仍调用 `npm run deploy`，保留 `predeploy` 全量保护，并增加
  `DEPLOY threeyang.top` 人工确认。
- 新增草稿/待发布/已发布状态、最近 20 版本地历史、安全差异与恢复。
- 新增封面工作室，可按 16:9、4:3、1:1 裁剪 WebP 并保存 alt/尺寸/用途。
- 新增内容治理队列、真实桌面/手机预览、社交卡片和只读发布差异。
- 新增代表页面体积、首页脚本和第三方运行时来源预算。
- 提供未启用的 Pages artifact 模板；即使源码 remote 已配置，Pages 发布源与
  environment 审批确认前也不会生效。
- 2026-07-28 将加密文章明文密码迁移为 `password_secret` 引用：本机从被忽略的
  `.blog-admin/secrets.json` 注入，GitHub Actions 从 Repository Secret 注入。
- 新增公开源码隐私扫描；首次公开推送使用无父提交的干净历史，旧明文历史不上传。

同时完成路线图第一阶段中的高收益改进：

- 安装 `hexo-generator-sitemap`、`hexo-generator-feed` 和
  `hexo-generator-searchdb`；生成 Sitemap、Atom 与本地搜索索引。
- 新增 `robots.txt` 和 `build-info.json`，构建结果包含 commit 与构建时间。
- 新增文章质量检查、线上只读健康检查和公开源码仓库的 Pull Request dependency review；
  个人私有仓库没有 GitHub Advanced Security 时自动跳过该 job。
- 将 `bk1.jpg`（900 KB）与 `bk2.png`（1.32 MB）转换为 166 KB 与 51 KB 的
  WebP，并切换首页背景和默认封面；原图保留用于回滚。
- 关闭 canvas-nest、click-heart、preloader、不蒜子和外部诗词副标题。
- 文章正文启用原生懒加载，首页首屏保持非懒加载。
- 修正旧 `threeyang3.github.io` 链接，移除不可用的 Z-Library 条目，并把
  Vol.moe 更新为 HTTPS。
- 使用方式、安全边界和 API 记录在 `docs/gui.md` 与 `docs/architecture.md`。

## 背景

博客长期缺少系统维护，并曾因配置误改无法部署。本次维护目标是恢复可回滚性、
升级框架和主题、降低依赖风险，并给部署链增加自动保护。

## 升级前状态

- 博客源目录没有 `.git`，只有 `.deploy_git` 保存生成结果。
- Butterfly 代码实际位于 5.5.4，但嵌套仓库中混有旧版配置和被手工改成
  4.3.1 的 `package.json`，版本状态互相矛盾。
- `_config.butterfly.yml` 是 Hexo 主配置的旧副本，不是主题配置。
- 个人图片保存在主题目录，主题升级可能覆盖。
- Hexo 8.1.1、hexo-blog-encrypt 3.1.9、Node.js 22.15.0。
- npm 审计共 28 项：2 critical、12 high、9 moderate、5 low。
- Valine 评论已关闭，但 npm 依赖和 LeanCloud 间接依赖仍存在。

## 已完成

### 可恢复性

- 初始化源码 Git 仓库并使用 `main` 作为本地源码分支。
- 建立升级前提交和本地标签 `maintenance-baseline-2026-07-27`。
- 完整保存原 Butterfly 工作树，不再使用不可克隆的嵌套 gitlink。
- 添加 `.gitattributes` 统一跨平台换行行为。

### 框架、主题和插件

- Hexo 8.1.1 → 8.1.2。
- Butterfly → 5.6.1，并改为 npm/lockfile 管理。
- hexo-blog-encrypt 3.1.9 → 4.0.2。
- 加密输出迁移到 AES-256-GCM v4，PBKDF2 设置为 600,000 次。
- 移除未使用的 `valine`、`hexo-theme-landscape` 和
  `hexo-renderer-ejs`。
- Node 目标版本固定为 22.23.1；当前机器仍需自行安装该安全补丁版本。

### 配置与资源

- 站点 URL 改为 `https://threeyang.top`。
- 时区固定为 `Asia/Shanghai`。
- `updated_option` 改为稳定的 `date`，避免换机器后文件 mtime 改写文章更新时间。
- canonical URL 去除多余的 `index.html`。
- `_config.butterfly.yml` 重建为精简的 Butterfly 5.6.1 覆盖配置。
- 评论保持关闭，并移除不再使用的 Valine 凭据。
- 主题图片迁移到 `source/img/`，自定义 CSS 保留在 `source/css/`。

### 部署保护与自动化

- 新增 `npm run check`：内容检查、clean、build、verify。
- 新增部署前置检查，`npm run deploy` 会自动运行完整验证。
- 快捷批处理改为调用 npm scripts，避免绕过保护。
- 自动验证 CNAME、部署仓库、分支、canonical URL、主题资源和加密输出。
- 新增 GitHub Actions 构建验证。
- Dependabot 改为每周分组更新，减少无效噪声。

## 验证结果

- `npm run check`：通过。
- 生成 175 个文件。
- 首页 canonical：`https://threeyang.top/`。
- `source/CNAME` 与 `public/CNAME`：均为 `threeyang.top`。
- 豆瓣图书和电影数据：生成成功。
- 加密文章 `/posts/c57a/`：生成 v4 加密容器，KDF 为 600,000 次。
- `sitemap.xml`、`atom.xml`、`search.xml`、`robots.txt` 和
  `build-info.json`：生成并通过自动校验。
- 51 篇文章：必填 Front Matter 和 abbrlink 唯一性通过；51 篇历史文章仍缺少
  显式封面和摘要，作为内容治理警告保留。
- 两篇《月亮与六便士》重复文章已保留日期较新、排版更完整的 `/posts/586a/`；
  旧地址 `/posts/d2f0/` 使用静态 canonical 跳转，避免历史链接失效。
- 本地移动端首页：资源传输由约 1.38 MB 降至约 659 KB，脚本由 14 个降至
  10 个；该数据用于前后比较，不代表线上 Core Web Vitals。
- `npm run test:gui` 与桌面/移动端无头浏览器验收：通过，控制台错误为 0。
- 编辑工作流隔离测试：草稿 → 待发布 → 已发布、历史、差异和恢复通过。
- 性能预算：首页 55,071 B、图书页 382,057 B、电影页 541,515 B；
  首页 10 个脚本，唯一运行时第三方来源为 `cdn.jsdelivr.net`。
- npm 审计：先由 28 项降至构建链上的 6 high；2026-07-28 使用 npm
  `overrides` 将 `brace-expansion` 固定到兼容的修复版 5.0.8 后降为 0。

## 明确未执行

- 没有运行 `npm run deploy`，线上站点仍是 2026-06-03 的部署版本。
- 没有修改 GitHub Pages Custom domain 或仓库 Pages 设置。
- 当前电脑仍运行 Node.js 22.15.0，应升级到 `.nvmrc` 指定的 22.23.1。

## 2026-07-28 源码托管补充

- 创建公开源码仓库 `https://github.com/threeyang3/hexo-blog-source`，并配置为
  本地 `origin`。
- GitHub Repository Secret `BLOG_ENCRYPTION_PASSWORD_C57A` 已从本机忽略文件安全写入；
  明文没有进入文档、Actions YAML 或 Git 历史。
- 首次推送使用当前净化文件树生成的无父根提交。含旧明文密码的历史仅留在本地恢复引用，
  不向任何远端推送。
- 源码 CI 已启用；Pages artifact 工作流仍只是模板，本次没有部署网站，也没有修改
  Pages Source、Custom domain 或 environment。

## 后续动作

1. 确认 Pages 发布源、自定义域名和 environment 保护后，审查并启用 artifact 模板。
2. 浏览器人工检查关键页面和加密文章，再由作者决定是否部署。
3. 从治理队列逐步补充摘要和封面。
4. 有 Search Console 数据后，再按真实曝光与索引问题排序旧文更新。
