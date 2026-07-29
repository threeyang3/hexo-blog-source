# Threeyang's Blog 后续优化路线图

> 研究时间：2026-07-27 | 对象：Hexo 个人博客 | 方法：仓库审计、线上核对、浏览器测量与横纵分析
>
> 数量说明：本报告的原始审计时点有 52 篇文章；2026-07-28 合并重复的
> “月亮与六便士”文章后，当前为 51 篇，并保留旧 URL 跳转。

## 一、一句话判断

这个博客现在不缺一次更大的技术升级，缺的是一条更短、更可靠的链路：**写完内容，
自动发现问题，明确确认后发布，发布后能知道线上是否真的更新，并让读者更容易找到、
订阅和阅读文章。**

Hexo 8.1.2 与 Butterfly 5.6.1 已经处于当前稳定版本。框架老并不等于仓库应该迁移。
对只有 51 篇文章、内容以 Markdown 为主、页面完全静态的个人博客，Hexo 的复杂度仍然
合适。此时迁移到 Astro 或 Hugo，得到的是更强的内容类型和图片管线，同时也会失去
Butterfly 已经提供的目录、豆瓣页面、标签、加密文章和大量主题能力。真正影响当前体验
的，是发布状态漂移、旧链接、未经优化的首屏资源、缺失的站内搜索与订阅入口，以及
Front Matter 没有形成内容质量约束。

我的判断是：未来半年应继续使用 Hexo，把工程从“能生成”推进到“持续可发布、可发现、
可测量”；只有当内容形态明显扩张，才重新讨论迁移。

### 实施状态（2026-07-27）

本路线图形成后已完成以下项目：

- 公众号式本机内容工作台：文章编辑、Front Matter、素材上传、封面选择、四字段外观
  编辑、预览、检查、线上健康检查和受保护发布。
- 旧域名/HTTP 链接修正，首页背景与默认封面切换到本地 WebP。
- 关闭 canvas-nest、click-heart、preloader、不蒜子和外部诗词副标题。
- Sitemap、Atom、robots、本地搜索、build-info 与对应构建验证。
- Front Matter/abbrlink/封面/受管链接检查，以及 Pull Request dependency review。

优化后的同口径本地测量中，首页资源传输由约 1.38 MB 降至约 659 KB，脚本由
14 个降至 10 个。文章正文使用原生懒加载，首页首屏保持非懒加载。

仍待外部条件或人工内容决策：

- 公开源码 remote 已配置为 `threeyang3/hexo-blog-source`，但 GitHub Pages artifact
  自动部署仍未启用；当前继续使用受保护的 `npm run deploy`。
- 51 篇历史文章仍缺少显式封面和摘要，工作台会展示数量但不机械生成内容。
- 两篇“月亮与六便士”文章已保留日期较新的 `/posts/586a/`，旧地址
  `/posts/d2f0/` 使用静态 canonical 跳转。
- 2026-07-27 没有执行线上部署。

### 第二轮实施状态（2026-07-27）

第十章提出的“不依赖远端即可完成”项目现已依次落地：

- 文章级本地版本历史、安全差异和可恢复编辑。
- 草稿、待发布、已发布三态工作流。
- 多比例 WebP 封面工作室与 alt/尺寸/用途元数据。
- 文章 URL、素材、受保护配置和基础设施的只读发布清单。
- 可直接进入文章的内容治理队列。
- 真实 Butterfly 桌面/手机预览与社交卡片。
- 代表页面体积、首页脚本数和第三方来源性能预算。

Pages 远端发布部分仍严格停在模板阶段：`docs/templates/pages-artifact.yml` 未放入活动
工作流，也未修改 Pages 发布源或执行部署。公开源码 remote 与 Actions Secret 已配置；
Search Console、计划发布和 Pages artifact 部署仍需进一步的远端设置与作者授权；线上
SHA 对账已由现有 legacy 部署路径完成。

### 第三轮实施与部署状态（2026-07-28）

- 保留已验证的 GitHub Pages legacy `master` 发布方式，没有切换 Pages Source、Custom
  domain 或 environment。
- `npm run deploy` 新增 `postdeploy` 线上收敛检查：允许 Pages 有限重试，并要求首页、
  Sitemap、Atom、robots、加密文章、旧 URL canonical 和 `build-info.json` 全部正确。
- 修复 `/posts/d2f0/` 被主题布局生成两个 canonical 的问题；跳转页现在不加载主题布局，
  构建检查要求只出现一个指向 `/posts/586a/` 的 canonical。
- 源码提交 `abf44a1` 经本地检查和 GitHub CI 验证后完成部署；Pages 产物提交为
  `bf29c55`，线上 SHA 对账和全部健康检查通过。

### 第四轮实施状态（2026-07-28）

- 工作台已实现路线图中“若以后增加提交按钮”的安全约束：只提交作者明确勾选的文章、
  草稿、素材、媒体元数据与受管视觉配置，明确禁止 `git add .`。
- GUI 会核对固定源码 origin、`main`、ahead/behind、远端 SHA，并显示当前 HEAD 对应的
  GitHub Actions 结果；CI 通过后才解锁 legacy Pages 部署。
- `npm run deploy` 的 `predeploy` 同样执行源码远端与 CI 门禁，不能从命令行绕过。
- GitHub Pages Source 仍未切换为 artifact；本次只是把现有 legacy 部署路径补成
  “源码归档 → CI → 人工确认 → Pages → 线上 SHA 对账”的闭环。

### 第五轮实施状态（2026-07-28）

- EasyPub 已增加 Obsidian 功能区、命令面板和设置页三个 Blog Control Room 入口。
- 运行中的后台通过被忽略的 `.blog-admin/control-room.json` 发现；EasyPub 严格校验
  绝对仓库路径、固定启动脚本、`127.0.0.1`、唯一随机令牌，并在复用前请求
  `/api/status`。
- 对兼容博客，EasyPub 的部署命令和自动部署会进入受保护 GUI，不再绕过源码提交、
  GitHub Actions 与 `predeploy`。
- EasyPub 的 PicGo、图片嵌入转换、Control Room 接入、测试、文档和生产包已经同步到
  GitHub `main`；博客与插件两边的 CI 均通过。

## 二、纵向分析：博客演进至 2026-07-27 经历了什么

### 1. 内容先行期：博客首先是写作容器

从文章日期看，内容主要形成于 2021 至 2024 年，主题集中在读书笔记、随笔、影评与个人
思考。52 篇文章约 44.6 万字节 Markdown，标签达到 42 个，分类只有 4 个。这种结构很像
自然生长的个人知识园地：分类承担大方向，标签记录当时最想强调的词。

这一阶段的优势是内容真诚且长文比例高。多篇文章超过 10 KB，最长接近 29 KB，说明站点
不是链接收藏夹，而是有足够文本密度的个人作品库。它的问题也来自同一个地方：内容结构
随写作产生，没有系统治理。52 篇文章里没有一篇显式填写 `description` 或 `cover`；
“《月亮和六便士》与三观”和“《月亮与六便士》与三观”是高度重合的两个版本，却拥有
不同永久链接。读者看到的是两个独立页面，搜索引擎也可能把它们当成相似内容。

### 2. 装饰与功能叠加期：网站逐渐长成 Butterfly 博客

博客后来加入 Butterfly 主题、豆瓣书影音、加密文章、字数统计、访问统计、今日诗词、
动态副标题、canvas-nest、点击爱心、灯箱和分享组件。它由纯文本入口变成了有鲜明个人
气质的站点。

这类功能单独看都很轻巧，叠加后会形成“体验税”。当前首页生成 14 个脚本、4 个样式表，
浏览器会访问 jsDelivr、i.loli.net、今日诗词和不蒜子等多个外部来源。首页默认封面来自
i.loli.net，本地背景图 `bk1.jpg` 为 900,736 字节，`bk2.png` 为 1,324,450 字节。
canvas-nest 配置为 99 个节点，预加载动画、点击爱心和动态诗词也会占用主线程或增加网络
依赖。

这种演进很常见：每一次添加都让博客“更像自己的”，但很少有一次维护会问“现在还需要
它吗”。功能没有错，缺的是定期删减。

### 3. 配置漂移期：可用性依赖个人记忆

多年未维护后，主题目录、主题版本和配置职责曾互相矛盾，且发生过误改配置导致无法部署。
早期快捷脚本能够直接触达 Hexo 命令，生成目录与部署目录也缺少完整的源码恢复点。博客
能工作，但恢复与发布依赖维护者记得每一个细节。

这正是静态博客最危险的阶段。页面托管看似“永远不会坏”，实际构建工具、Node 版本、
主题配置、第三方接口和域名设置都在变化。只要两三年不碰，下一次发布就同时面对多层
不确定性。

### 4. 2026 年现代化：从个人记忆转向可验证流程

2026-07-27 的维护解决了基础层问题：

- 源码进入 Git，建立升级前恢复标签。
- Hexo 升至 8.1.2，Butterfly 升至 5.6.1，主题改由 npm 管理。
- 主配置、主题覆盖配置和个人资源重新划清边界。
- `npm run check` 会验证域名、部署仓库、分支、canonical、主题资源和加密输出。
- `npm run deploy` 通过 `predeploy` 强制执行完整检查。
- CI、Dependabot、运行手册和本地 Blog Control Room 已建立。

这一步让博客从“可以构建”变成了“构建结果可以证明自己没有破坏关键配置”。Hexo 官方
当前最新稳定版也是 8.1.2，Butterfly 最新发布为 5.6.1，因此框架版本不再是短板。

但线上状态暴露了下一层问题。本地已有维护后的代码和较新的文章，线上首页仍显示 52 篇，
最新文章停在 2024-07-15；线上侧栏的“了解作者”仍指向
`threeyang3.github.io`。本地 `source/_data/widget.yml` 也保留了这三个旧域名链接。
构建校验已经很强，**发布完成与线上生效尚未成为一条可观察的闭环**。

## 三、横向分析：当前博客与几种路线相比处在哪里

### 1. 继续使用 Hexo + Butterfly

这是短期最合理的路线。

Hexo 的优势不是技术新颖，而是迁移成本已经支付完毕：51 篇文章的永久链接由 abbrlink
固定，主题配置已整理，豆瓣与加密插件已经通过验证，Blog Control Room 也围绕 npm scripts
建立。Hexo 官方插件目录仍提供 feed、sitemap、search 等生成器，Butterfly 5.6.1 仍在
维护，并在 5.6 系列继续改进脚本缓存、滚动性能、HTML 转义和 PJAX 兼容。

短板也很具体：

- Front Matter 没有类型约束，`description`、封面、更新时间等质量只能靠约定。
- 图片没有内建的响应式转换管线。
- 主题功能多，容易在不知不觉中加载较多脚本与第三方资源。
- 豆瓣插件把大量数据直接写进 HTML：本地生成的 `books/index.html` 约 384 KB，
  `movies/index.html` 约 543 KB。

这些问题都能在 Hexo 内改善，并没有严重到必须迁移。

### 2. 迁移到 Astro

Astro 最吸引当前博客的能力有两个。

其一是 Content Collections。Astro 可以用 schema 约束每篇文章的 `title`、
`description`、日期、封面与其他字段，在构建时直接拒绝不完整内容。对当前 51 篇文章全部
缺少显式 description 的现状，这种类型安全很有价值。

其二是图片管线。Astro 的 `<Image>` 与 `<Picture>` 可以在构建时生成 WebP/AVIF、
响应式 `srcset`，自动写入宽高以降低 CLS。当前博客所有代表页面的图片都缺少显式
`width`/`height`，Astro 会自然解决这类问题。

代价也很高：Butterfly 的页面、目录、标签、主题插件、加密文章和豆瓣集成都要重新实现；
现有 URL、Front Matter、Hexo 标签插件和自定义数据需要迁移适配。Astro 适合的触发条件
不是“Hexo 用了很多年”，而是准备把博客扩展成作品集、项目展示、交互组件或多种内容模型，
并愿意维护自己的前端设计系统。

### 3. 迁移到 Hugo

Hugo 的强项是单文件工具链、快速构建、Page Bundle 和内建图片处理。官方图片管线支持
调整大小、裁剪、过滤并输出 WebP/AVIF，结果可缓存。对图片很多、文章达到数百或数千篇的
站点，它能带来明显的构建和资源管理优势。

当前博客只有 51 篇文章，Hexo 完整构建约十秒量级，构建速度并非主要痛点。迁移 Hugo
还要处理 Go Template、主题替换、豆瓣数据、加密文章和现有短链接。除非以后文章规模大幅
增长，或决定把每篇文章与图片组织成 Page Bundle，否则 Hugo 的收益不够覆盖迁移成本。

### 4. 使用 Ghost、WordPress 或托管型写作系统

如果目标变成“完全在浏览器写作、多人协作、会员订阅、邮件通讯和评论管理”，动态 CMS
会比继续扩展本地 GUI 更合适。它们的代价是服务器、数据库、备份、升级与安全维护。

当前用户已经习惯本地 Markdown，又明确希望保留命令能力并用 GUI 包装。此时引入动态
CMS 会把一个静态发布问题变成长期服务器运维问题，不划算。

### 5. 横向结论

| 路线 | 当前收益 | 迁移成本 | 适合触发条件 | 现在建议 |
|------|----------|----------|------------|----------|
| Hexo + Butterfly | 保留全部功能和 URL，改进最快 | 低 | 个人 Markdown 博客 | 继续 |
| Astro | 类型化内容、优秀图片与组件体系 | 高 | 作品集、多内容模型、强定制前端 | 观察 |
| Hugo | 极快构建、Page Bundle、图片处理 | 高 | 数百篇以上、图片密集 | 暂缓 |
| Ghost/WordPress | 浏览器编辑、会员与邮件能力 | 高且持续 | 多人编辑、订阅商业化 | 不建议 |

## 四、浏览器测量：真正慢在哪里

以下数据来自 2026-07-27 在本机以 390×844 视口访问本地 Hexo 服务。它不是线上
Lighthouse，也不包含 GitHub Pages CDN 的真实延迟，因此只能用于比较页面结构与资源
负担。LCP 数字受外部资源和本机环境影响，不能当成真实用户指标。

| 页面 | HTML 大小 | 资源数 | 资源传输 | 脚本 | 图片 | 本地 LCP |
|------|-----------|--------|----------|------|------|----------|
| 首页 | 47 KB | 17 | 1.38 MB | 14 | 17 | 3.56 s |
| 文章页 | 47 KB | 16 | 487 KB | 12 | 16 | 1.73 s |
| 读书页 | 391 KB | 24 | 1.38 MB | 16 | 17 | 1.95 s |
| 电影页 | 545 KB | 19 | 1.38 MB | 16 | 9 | 1.75 s |

几个信号比单一分数更重要：

1. 首页比普通文章页更慢，负担主要来自大背景、远程默认封面和装饰脚本。
2. 代表页面中的图片全部缺少显式宽高，虽然本地 CLS 测量不高，但网络变慢时仍有布局
   抖动风险。
3. 首页会访问五个外部来源。外部服务变慢、被拦截或证书异常，都会影响体验。
4. 不蒜子的运行时请求使用 HTTP 来源；线上 HTTPS 页面显示访问统计为空，混合内容或
   服务可用性很可能是原因之一。
5. 豆瓣书影音页面把数百 KB 数据写入首个 HTML，网络压缩能减小传输，但浏览器仍要解析
   大文档。

Google 当前建议 Core Web Vitals 在第 75 百分位达到 LCP ≤ 2.5 秒、INP ≤ 200 毫秒、
CLS ≤ 0.1。对图片型 LCP，首屏图片不应懒加载；更有效的顺序是让它在初始 HTML 可发现、
使用合适尺寸与格式，并在确认它确实是 LCP 时设置高优先级。站外图片与多个第三方脚本
都会增加连接和资源竞争。

## 五、横纵交汇：历史如何塑造了现在的优先级

截至 2026-07-27，博客的优势来自早期“先写再说”：内容数量已经足够支撑分类、专题和搜索，不需要为了
显得现代而重建平台。它的短板也来自同一条路径：每次增加一个主题功能或标签都很容易，
但删除、归并和验证没有成为习惯。

2026 年维护已经完成底层止血。过去最危险的问题是配置误改后无法部署，所以现在有
`verify-build.js`、Git 恢复点和部署前检查。下一阶段不应继续把注意力放在“再升级一次
版本”，而要让保护向两端延伸：

```text
写作前端                      已有构建保护                     线上结果
Front Matter / 链接 / 图片  → check + verify + GUI → 自动部署 / 健康检查 / 可观察
```

左端缺内容质量门禁，右端缺发布与线上反馈。中间已经是整条链路中最可靠的一段。

这个判断也解释了为什么现在不推荐 PWA 或 PJAX。PWA 会引入 service worker 与缓存失效
问题，PJAX 会改变脚本生命周期；Butterfly 官方文档也明确提醒第三方插件可能不兼容 PJAX。
在“线上版本都可能滞后”的阶段，再增加一层缓存和导航状态，只会让故障更难判断。

## 六、建议路线图

### P0：先补发布闭环与明显错误

#### A. 将源码仓库托管并改用 GitHub Actions Pages artifact 部署

目标不是“自动部署一切”，而是让同一个提交完成构建、验证、人工批准和发布，并留下可查
的部署历史。

建议流程：

1. 为源码 `main` 配置独立 GitHub remote。
2. Pull Request 运行 `npm ci`、`npm run test:gui`、`npm run check`。
3. 合并到 `main` 后构建 `public/`，用 `actions/upload-pages-artifact` 上传。
4. 部署 job 使用 `github-pages` environment，并配置人工批准或分支保护。
5. 使用 `actions/deploy-pages` 发布，不再由本机向生成分支推送。
6. 部署后请求首页、CNAME、文章页和加密文章外壳，记录线上 smoke test。

GitHub 官方的 Pages 自定义工作流就是“构建 → 上传 artifact → deploy-pages”，environment
可以增加部署保护，concurrency 可以避免两个发布同时进行。它比本机
`hexo-deployer-git` 更容易审计，也更能避免“本地通过但忘了部署”。

在切换前必须确认当前 GitHub Pages 仓库结构和 Custom domain，不应直接并行保留两套
自动部署。现有 `npm run deploy` 可暂时作为紧急回退，待 Actions 稳定后再决定是否移除。

#### B. 修正旧域名和失效链接

立即处理：

- `source/_data/widget.yml` 中三个 `threeyang3.github.io` 链接改为站内相对链接。
- `source/_data/link.yml` 的 `zh.z-lib.org` 缺少协议。
- Vol.moe 的链接与头像仍为 HTTP，需要确认 HTTPS 可用性；不可用时移除或换成本地头像。
- 为 CI 增加内部链接检查，外部链接检查可设置超时与允许列表，避免网络波动阻塞发布。

这里风险低、收益直接，也是线上已经能观察到的错误。

#### C. 建立线上版本标识

在生成结果中写入源码 commit SHA 和构建时间，例如 `/build-info.json`，GUI 或 CI 部署后
读取它。以后“线上是不是最新”不再靠肉眼看文章日期，而是比较 SHA。

### P1：资源瘦身与第三方依赖治理

#### A. 先优化首屏三张图

优先级按实际体积排序：

- `bk2.png`：1.32 MB
- `bk1.jpg`：900 KB
- `butterfly-icon.png`：275 KB

建议生成 WebP/AVIF 与合理尺寸的 JPEG/PNG 回退。首页实际使用的 `bk1.jpg` 应按最大显示
尺寸重采样，而不是只做无损压缩。远程默认封面
`https://i.loli.net/...jpg` 应下载到 `source/img/`、确认许可并优化，避免首屏 LCP 依赖
第三方域名。

优化后在 CI 设资源预算：单张普通图片建议不超过 300 KB，首屏背景目标 400 KB 以内，
`public/` 中超过阈值的新资源令构建失败或警告。阈值应根据视觉质量实测调整，不必追求
极端压缩。

#### B. 给图片补尺寸，谨慎启用原生懒加载

Butterfly 支持 native lazyload。建议只对首屏以下的文章图片和列表图片启用，首页主背景
或首个内容封面保持 eager。Google 的性能文档明确不建议懒加载 LCP 图片。

Hexo 没有 Astro/Hugo 那样完整的内建图片管线，可选两种策略：

- 低复杂度：提供 `tools/optimize-images.js`，统一生成 WebP、记录宽高并检查大小。
- 中复杂度：引入经过维护评估的 Hexo 图片插件，并把输出写入 `verify-build.js` 检查。

先做低复杂度方案更符合当前仓库“少插件、强验证”的方向。

#### C. 删除没有持续价值的装饰性网络请求

按“关闭后是否影响内容”审查以下功能：

- canvas-nest
- click-heart
- preloader
- 今日诗词动态副标题
- Share.js 中不常用的海外平台
- 不蒜子访问统计

建议至少关闭 canvas-nest 和 preloader，动态诗词改成本地固定文案或保留超时回退。访问统计
若确实需要，应选择 HTTPS、隐私边界清楚且能稳定工作的方案；若只是装饰数字，直接关闭
比修复更诚实。

每减少一个第三方来源，都减少一次 DNS/TLS、供应链和隐私依赖。GitHub Pages 无法像自有
服务器那样方便配置完整响应头，自托管固定版本资源会更可控。

#### D. 处理豆瓣大页面

短期可以保留现状，但需要设置预算和观察移动设备解析时间。后续选项：

- 按“在读 / 想读 / 已读”分页或折叠。
- 生成精简 JSON，页面首次只渲染摘要，交互后再加载列表。
- 只保留按时间倒序靠前或精选的条目，完整清单另做下载。

不要为了减小首个 HTML 就立刻改成复杂客户端应用。先测线上压缩后的传输大小和低端手机
交互，再决定。

### P1：让内容可被找到、订阅和正确描述

#### A. 增加 sitemap、robots.txt 与 RSS/Atom

原始审计时的本地生成结果没有 `sitemap.xml`、RSS/Atom 或 `robots.txt`。建议使用 Hexo 官方
插件目录中的 sitemap 与 feed 生成器，并在 `robots.txt` 声明 sitemap。Google 说明
sitemap 能帮助搜索引擎更高效地发现重要页面和更新时间；RSS 则让博客脱离社交平台算法，
恢复“读者主动订阅作者”的能力。

完成后把以下项目加入 `verify-build.js`：

- sitemap 包含站点 canonical 域名，不含 localhost 或旧 GitHub 域名。
- feed 能解析，条目链接正确，且不泄露加密文章正文。
- robots.txt 不误拦截文章、图片、CSS 和 JS。

#### B. 增加站内搜索

51 篇长文已经超过只靠归档翻找的舒适范围。Butterfly 原生支持 `local_search`，官方文档
推荐配合 `hexo-generator-searchdb` 或 `hexo-generator-search`。本地搜索不需要远程
账户，也符合个人博客的隐私取向。

搜索索引应排除加密文章正文，或只保留公开标题和摘要；实施前必须验证插件与
hexo-blog-encrypt 的处理顺序。

#### C. 建立 description 与摘要规范

当前 51 篇文章全部缺少显式 `description`。主题能从正文截取 Open Graph 描述，但作者
无法控制搜索结果和分享卡片呈现。不要一次机械生成 51 条空泛摘要，按流量或代表性分批：

1. 首页前十篇、作者精选和常被分享文章。
2. 全部读书笔记与影评。
3. 其余历史文章。

每条 description 用一到两句说明文章讨论什么，而不是重复标题。首页摘要建议从 500 字
缩短到约 120–200 字，或在重点文章中使用显式摘要/`<!-- more -->`，让读者更快扫描。

#### D. 校验结构化数据与作者身份

Butterfly 已输出 JSON-LD、Open Graph 和 canonical，这是良好基础。下一步应把文章页放进
Google Rich Results Test，核对 `BlogPosting` 的 author、headline、datePublished、
dateModified 和 image。Google 的 Article 指南建议提供清晰作者身份、修改时间和与文章
相关的高质量图片。

不必为每篇文章强行制作封面。可以设计一套按分类生成的本地默认 OG 图，再为重点文章提供
独立封面。

### P1：内容治理

#### A. Front Matter lint

新增只读校验脚本，建议规则：

- `title`、`date`、`categories`、`tags`、`abbrlink` 必须存在。
- abbrlink 全局唯一。
- 日期可解析且带预期时区语义。
- 新文章必须有 `description`。
- `cover` 存在时必须是 HTTPS 或仓库内路径。
- 加密文章不得进入 feed、搜索正文或构建日志。
- 内部链接不能指向 `threeyang3.github.io`。

规则对历史文章可以先警告、新文章强制失败，避免一次治理产生大量无意义修改。

#### B. 合并重复内容并保留重定向

该项已于 2026-07-28 完成：保留日期较新、排版更完整的 `/posts/586a/`，删除较早版本的
Markdown；旧地址 `/posts/d2f0/` 保留静态跳转和 canonical，避免外部链接直接失效。

#### C. 收敛标签体系

51 篇文章使用 42 个标签，很多标签只出现一次。标签过细会让每个标签页缺乏浏览价值。
建议确定 8–15 个长期主题，例如：

- 写作与个人成长
- 文学与小说
- 社会观察
- 哲学与价值
- 科学与科幻
- 故乡与记忆
- 电影

个别情绪词可以保留在正文或关键词，不一定都成为导航层。Butterfly 5.6 已有 series
能力，长篇读书主题也可以用系列组织，而不是继续增加标签。

#### D. 对旧文章展示时间语境

博客的可贵之处之一，是保留不同时期观点。可以开启 `noticeOutdate`，但文案应从机械的
“已经过去 N 天”改成符合本站气质的说明：

> 本文写于较早时期，保留当时的判断与表达。作者后续的看法可能已经变化。

这既尊重历史文本，也减少读者把旧观点误认为当前立场。

### P2：测试、可观察性与安全

#### A. 扩展 CI

在现有 `npm run check` 上增加：

- `npm run test:gui`
- Front Matter lint
- 内部链接与生成 URL 检查
- HTML 基础验证
- 资源体积预算
- 关键页面浏览器 smoke test
- Pull Request dependency review

GitHub 官方 dependency review action 能在 lockfile 变化时显示新增、移除和间接依赖的漏洞
变化。原始审计时 Stylus 链仍有无上游修复的 high 告警，因此策略应是“阻止新引入 critical/high”，
而不是让已有已知告警永久阻塞所有更新。

#### B. 定期线上健康检查

每周或部署后检查：

- `https://threeyang.top/` 返回 200。
- canonical、CNAME 和 build SHA 正确。
- 关键 CSS/JS/图片可访问。
- 文章页、分类、标签、书影音页可打开。
- 加密文章只暴露加密容器。
- sitemap、feed 可解析。

失败时只通知，不自动修改 Pages 设置或 Custom domain。

#### C. 明确客户端加密边界

hexo-blog-encrypt 保护的是静态站点上的正文，适合防止随手浏览，不应当作企业级访问控制。
密码输入、解密和明文展示都发生在浏览器。真正敏感的个人信息不应发布到公共仓库或公共
Pages，即使页面经过客户端加密。

### P2：继续扩展 Blog Control Room

GUI 下一阶段最有价值的不是更多命令，而是内容质量入口：

- 文章列表：标题、日期、分类、标签、description 状态。
- 新建草稿：使用 scaffold，安全验证标题与文件路径。
- 发布前清单：显示旧域名、重复 abbrlink、大图片、缺少摘要。
- 构建差异：展示本次新增、删除、变更的生成 URL。
- 部署历史：本地 commit、GitHub Actions run、线上 build SHA。
- 一键打开文章源文件与对应本地预览。

仍然不建议增加任意命令输入框。GUI 的价值来自把正确流程做得更方便，而不是把 Shell
完整搬进浏览器。

### P3：暂缓项目

以下方向有吸引力，但现在不应优先：

- **PWA**：会引入 service worker 缓存与版本一致性问题，等自动部署和 build SHA 稳定后再做。
- **PJAX**：Butterfly 支持，但第三方脚本、加密文章和自定义逻辑需要逐一验证。
- **恢复评论系统**：先明确是否真的愿意长期管理评论、垃圾信息和隐私；否则保留邮件/知乎
  等反馈渠道更轻。
- **全站迁移 Astro/Hugo**：除非内容模型、图片规模或自定义界面需求发生变化。
- **复杂分析系统**：访问量不是当前主要约束，不值得为数字引入更多追踪脚本。

## 七、建议执行顺序

### 第一阶段：1–2 次维护即可完成

1. 修正旧域名、无协议链接与 HTTP 友情链接。
2. 自托管并压缩首页默认封面，压缩 `bk1.jpg`、`bk2.png`。
3. 关闭 canvas-nest 与 preloader，评估移除不蒜子和动态诗词。
4. 加入 sitemap、feed、robots.txt，并扩展构建验证。
5. 把 `npm run test:gui` 接入 CI。

这一阶段不改文章 URL、不迁移主题，风险最低。

### 第二阶段：建立发布闭环

1. 为源码仓库配置 GitHub remote。
2. 建立 Pages artifact 工作流与受保护 environment。
3. 写入 build SHA，并在部署后执行线上 smoke test。
4. 稳定运行两到三次发布后，决定是否退役本地 deployer。

这一阶段直接解决“本地已经更新，线上仍是旧版本”的问题。

### 第三阶段：内容治理

1. 为重点文章补 description。
2. 合并重复文章并保留旧 URL 重定向。
3. 收敛标签、建立系列。
4. 开启符合本站语气的旧文提示。
5. 在 GUI 中增加内容健康视图。

### 第四阶段：用数据决定是否继续

收集两到三个月的 Search Console、线上 Core Web Vitals 与发布记录，再判断：

- 搜索是否带来实际读者。
- 首页图片与脚本优化是否改善 LCP。
- 站内搜索是否常用。
- 豆瓣大页面是否需要重构。
- 是否真的出现 Hexo 无法支持的新内容形态。

只有最后一个问题持续为“是”，才启动 Astro/Hugo 迁移验证。

## 八、三个未来剧本

### 最可能：Hexo 成为稳定的个人出版系统

自动部署与内容 lint 建立后，维护者主要在 GUI 中写作、预览和确认发布。Hexo 与 Butterfly
继续小步更新，站点不追逐所有新功能，但页面更快、链接更干净、搜索和 RSS 让旧文章重新
可见。这条路线成本最低，也最符合个人博客的生命力来源：持续写作。

### 最危险：功能继续增加，发布仍靠偶尔手工处理

GUI 加入更多按钮，PWA、PJAX、评论和统计陆续打开，但源码仍没有可靠远端，线上版本与
本地状态继续分离。故障出现时，缓存、第三方脚本和两套部署路径互相干扰。网站看起来更
丰富，却再次变成只有维护者本人能解释的系统。

### 最乐观：内容体系扩张后有计划地迁移

未来博客增加项目作品、摄影、系列课程或互动内容。此时先通过 schema、资源预算与 URL
清单把 Hexo 内容整理干净，再用一个小型 Astro 原型验证图片管线和内容集合，保持现有
permalink。迁移由真实内容需求驱动，而不是由“旧框架焦虑”驱动。历史文章、搜索入口和
读者链接都能平稳保留。

## 九、最终建议

如果下一轮只选三件事，我会选：

1. **GitHub Actions 受保护部署 + build SHA**：解决线上滞后和部署可观察性。
2. **首屏图片与第三方脚本瘦身**：解决当前最明显的性能与可靠性负担。
3. **sitemap + RSS + 本地搜索 + description 规范**：让已有 51 篇长文真正可被发现。

框架保持 Hexo，主题保持 Butterfly。把迁移评估放到路线图末尾，而不是开头。

这不是保守。是先把已经拥有的东西用好。

## 十、第二轮思考：工作台建成后，下一步该往哪里走

第一轮优化解决的是“多年没有维护后还能不能可靠构建”；内容工作台解决的是“能不能不靠
命令行完成日常编辑”。站在这个节点继续加功能，很容易犯一个错：把所有看起来像 CMS 的
能力都搬进来，最后在静态博客旁边重新造出一个难维护的动态 CMS。

更合适的判断标准不是“公众号后台还有什么按钮”，而是每一个按钮能否缩短以下链路：

```text
想写 → 写完 → 看清改了什么 → 确认能发布 → 知道线上已更新 → 知道旧文章是否被读到
```

当前工作台已经覆盖“想写、写完、构建和手工发布”，缺口主要位于中间的版本判断和右端的
发布反馈。下一阶段应围绕五件事展开：内容状态、版本恢复、图片加工、发布历史和读者反馈。

### 1. 最高优先级：把“保存文件”升级为“可恢复的编辑历史”

现在的 SHA-256 保护能避免覆盖其他程序刚修改的文章，但它解决的是并发冲突，不是作者
主动回到某个历史版本的问题。公众号式后台真正让人安心的地方，是编辑过程中可以反复保存，
并且知道每个版本何时产生、改了哪些段落。

建议在不引入数据库的前提下，增加文章级历史：

- 每次保存前，把旧版本写入 `.blog-admin/history/<article-id>/`，按时间倒序只保留若干版。
- 历史记录包含时间、内容哈希、标题和变更摘要，不保存浏览器令牌。
- 提供左右或行级差异视图；恢复时仍走哈希冲突检查，不能静默覆盖当前版本。
- “恢复”先生成一个新版本，而不是删除恢复点。
- 历史目录继续被 Git 忽略，源码 Git 只记录作者明确选择提交的最终内容。

这里不建议让 GUI 自动执行 `git add . && git commit`。当前工作树既可能有文章，也可能有
主题和程序修改；全量自动提交会把无关改动混在一起。若以后增加提交按钮，它只能提交当前
文章及作者明确勾选的素材，并在提交前展示路径清单。

Ghost 的文章历史会保存多个编辑版本并允许恢复；Decap CMS 则把草稿、审阅和发布映射为
分支与 Pull Request。它们共同说明，成熟内容后台的关键不是“富文本工具栏有多少按钮”，
而是编辑状态有可追溯的落点。当前博客是单人本地写作，轻量文件历史比立刻引入每篇文章
一个 PR 更合适。

### 2. 最高优先级：建立明确但不过度设计的内容状态

Hexo 默认把 `source/_posts/` 中的 Markdown 全部视为可发布内容。工作台虽然能编辑，
但“刚起一个标题”“正文完成”“等待补封面”在文件层没有区别。下一步可增加三种状态：

| 状态 | 含义 | 构建行为 |
|------|------|----------|
| 草稿 | 结构和文字都可能变化 | 不进入正式构建 |
| 待发布 | 正文完成，等待检查或发布 | 可预览，正式发布前必须通过检查 |
| 已发布 | 已进入线上版本 | 正常构建 |

实现时优先沿用 Hexo 的 `source/_drafts/`，而不是在每篇文章上发明新的私有字段。工作台
提供“移入草稿”“送交发布”“退回草稿”，移动前展示目标路径并检查同名冲突。单人博客
不需要“编辑、主编、管理员”三套权限，但仍需要状态，因为后续重读时作者也承担审阅角色。

计划发布要等远端自动部署建立后再做。仅在本机记录一个未来时间没有实际意义：电脑关机时
不会有人执行发布。可靠的定时发布需要 GitHub Actions 或长期运行的服务承担调度，并处理
时区、失败重试和重复执行。Ghost 能可靠排期，是因为它背后有持续运行的服务器；静态博客
不能只复制界面而忽略运行条件。

### 3. 最高优先级：把素材库升级为“封面工作室”

现在素材库解决了上传和选择，但作者仍要在外部软件中裁剪、压缩和适配比例。对于这个博客，
图片优化的高收益不在滤镜、美颜或复杂图层，而在四个固定动作：

1. 选择焦点与裁剪区域。
2. 一次生成首页横图、文章卡片和分享图所需比例。
3. 限制长边和文件体积，生成 WebP，必要时保留原图。
4. 记录替代文本，避免图片只有视觉用途而没有内容描述。

建议预设 `16:9`、`4:3` 和 `1:1` 三种比例，并让输出文件名携带尺寸或用途。裁剪可在
浏览器完成，编码与尺寸约束放在 Node 后端完成；这样浏览器负责交互，后端负责结果一致性。
产物先写临时文件，验证文件签名、像素尺寸和体积后再原子移动到素材目录。

这项能力还能解决结构化数据问题。Google 的 Article 文档建议提供清晰的文章图片、
`datePublished`、`dateModified` 和作者信息，并示例了 `1:1`、`4:3`、`16:9` 多比例图片。
因此封面工作室不只是视觉便利，也能为搜索与分享卡片提供稳定输入。

不建议在工作台内建设完整 Photoshop。旋转、裁剪、焦点、压缩、格式转换和删除背景已经
覆盖绝大多数博客场景；继续增加图层、文字特效和滤镜，会显著增加浏览器状态、撤销栈和
文件格式的维护成本。

### 4. 高优先级：增加“发布前差异”，而不是再加一个发布按钮

路线图形成时，发布页能运行检查并要求确认短语，但作者仍需要从长日志里判断这次发布究竟改变了什么。
下一步应在构建后生成发布清单：

- 新增、修改、删除了哪些文章 URL。
- 哪些文章的标题、摘要、封面、分类或标签发生变化。
- 哪些静态资源新增或体积明显增长。
- `CNAME`、canonical、部署仓库和分支是否与保护基线一致。
- 本次构建的 commit、时间和生成文件数量。

界面只要给出“内容变化”和“基础设施变化”两个区域。正常写文章时，后者应当为空；一旦
主题配置或部署配置变化，就用更强的视觉提示并要求单独确认。这样可以把曾经的配置误改
风险从“脚本最后报错”提前到“发布前一眼可见”。

发布后还应比较本地 `build-info.json` 与线上版本。两者 SHA 一致才显示“已上线”；HTTP
成功但 SHA 不一致只能算“站点可访问，尚未更新”。GitHub 的部署历史可以关联提交、
工作流日志、状态和部署 URL，工作台以后可以读取这些只读信息，而不必自己维护另一套
发布数据库。

### 5. 高优先级：完成远端发布闭环，但继续保留人工门槛

源码 remote 已配置；当前最大的工程边界变为 Pages Source 和 `github-pages` environment
尚未经过确认。满足这些前置条件后，推荐采用 GitHub Pages 官方 artifact 流程：

```text
push / 手动触发
  → npm ci
  → 内容、GUI、构建与隐私检查
  → upload-pages-artifact
  → github-pages environment 审批
  → deploy-pages
  → 线上 smoke test
```

GitHub 官方文档把 Pages 自定义流程拆为构建、上传 artifact 和部署，并允许 environment
增加分支限制、人工审批与部署历史。对本博客来说，关键不是“每次提交自动上线”，而是构建
发生在可重复环境中，发布仍需要明确确认。

在迁移稳定前，本地 `hexo-deployer-git` 应保留为回退手段，但两条发布路径不能同时自动
运行。稳定完成两到三次 artifact 发布后，再决定是否退役本地部署器。

### 6. 中优先级：把内容健康从数字变成可执行队列

工作台已经知道 51 篇历史文章没有显式摘要和封面。如果它永远只显示“51”，这个数字很快
会变成家具。更有用的形式是内容治理队列：

- 按发布时间倒序靠前但缺摘要。
- 首页出现但缺封面。
- 标签只出现一次。
- 标题或正文高度相似。
- 外链失效或仍为 HTTP。
- 超过一定时间且可能需要补充“历史语境”的文章。

每个问题都应能直接进入对应文章，并在修复后即时消失。历史文章可以保持警告，新文章则
逐步收紧规则，例如新文章进入“待发布”时必须有摘要；封面仍然可选，因为不是每篇随笔都
需要一张装饰图片。

标签治理也不应自动合并。系统可以给出“文学 8 篇、小说 1 篇，两者可能重叠”这样的候选，
最终仍由作者决定。重复文章可以展示差异和候选，但仍应像 2026-07-28 的
《月亮与六便士》合并一样，由作者决定保留版本并为旧 URL 留下跳转。

### 7. 中优先级：增加文章、手机和社交三种预览

当前 Markdown 即时预览适合检查结构，却不等于主题最终页面。成熟出版后台会把预览分开：

- 编辑预览：快速检查 Markdown。
- 站点预览：使用真实 Butterfly 页面、目录、字体和加密插件。
- 分享预览：展示搜索结果标题、摘要以及 Open Graph 卡片。

Ghost 把桌面、移动、邮件和社交预览放在同一发布入口。这个博客不需要邮件会员体系，但
“桌面、移动、社交”三种视角仍有价值。实现上应复用本地 Hexo 服务，并通过固定视口截图，
而不是在管理后台复制一份 Butterfly CSS。复制主题样式会在下次主题升级后漂移。

### 8. 中优先级：让性能回归变成趋势，而不是一次测量

现有构建已对两张关键 WebP 设置体积上限，但浏览器性能仍只在人工验收时测量。建议增加
轻量性能基线：

- 首页、代表文章、图书页、电影页四个固定路由。
- 记录文档大小、请求数、脚本数、第三方来源、控制台错误。
- 体积和请求数使用硬预算；LCP 在本地环境中先只警告，不做单次硬阻断。
- 连续多次超出趋势再升级为错误。

Lighthouse CI 支持按资源类型设置数量和体积预算，也支持多次采样。当前博客的豆瓣页面
HTML 很大，最适合先用文档体积预算监控；本地 LCP 对冷缓存和 CDN 延迟敏感，不应因为一次
抖动阻止全部文章发布。

### 9. 中优先级：建立“发现效果”看板，而不是引入全站追踪

已经生成 sitemap、Atom 和本地搜索，接下来要知道它们有没有产生实际效果。优先接入
Google Search Console 的人工导出或只读数据：

- 页面是否被索引。
- 哪些查询带来曝光和点击。
- 哪些旧文章仍有稳定搜索需求。
- 哪些页面出现抓取或结构化数据问题。

Google Search Console 可以按查询、页面和国家查看搜索表现，也能监控 sitemap 和索引
问题。这些数据足以指导先补哪篇摘要、先更新哪篇旧文，不必为了一个访问数字重新引入
第三方实时统计脚本。

若以后确实需要站内访问统计，应先明确问题，例如“读者是否使用站内搜索”“书影音页面
是否有人打开”，再选隐私边界清楚的方案。不要因为后台看起来空，就给每个页面重新装满
追踪代码。

### 10. 低优先级观察项：订阅、邮件与多端写作

Atom 已经提供开放订阅入口。下一步可以在首页和工作台增加订阅说明、复制链接和二维码，
成本很低。邮件 Newsletter 则完全是另一种产品：订阅者管理、退订、投递声誉、模板兼容和
隐私责任都会出现。Ghost 原生支持分组 Newsletter 与定时发送，但这是因为它承担了会员和
邮件基础设施。

除非作者明确准备持续经营邮件读者，不建议现在自建 Newsletter。更轻的做法是先观察 Atom
订阅与搜索流量；如果以后形成稳定更新节奏，再评估 Ghost、Buttondown 等独立邮件服务，
博客仍作为内容正本。

远程在线编辑同样暂缓。Decap CMS 可以把 Markdown Front Matter 和媒体映射为表单，并用
Git 分支/PR 管理草稿；TinaCMS 强在可视化编辑和 Git 内容层。但当前本机工作台已经理解
Hexo 的加密文章、abbrlink、Butterfly 外观字段和特殊部署保护。替换它们会重新引入认证、
OAuth、在线写权限与多系统配置。只有出现“经常需要在非本人电脑或手机上写长文”的真实
需求，在线 CMS 才值得进入原型阶段。

### 11. 明确不建议现在做的事

- **不迁移 Astro/Hugo**：工作台、主题和构建保护刚形成，迁移不会解决内容状态和发布反馈。
- **不引入任意命令输入框**：白名单命令是当前后台安全边界。
- **不让 AI 自动改写全部历史摘要**：可以生成候选，但必须逐篇确认，避免抹平原文语气。
- **不自动删除“重复”文章**：相似度只能提示，旧 URL 和写作阶段本身可能有保存价值。
- **不在本机伪造可靠定时发布**：调度必须依赖持续运行的远端执行器。
- **不恢复装饰性统计和第三方脚本**：先证明读者问题存在，再增加运行时依赖。
- **不做完整富文本编辑器替换 Markdown**：Hexo 标签、代码块、加密与原文件可移植性会增加
  双向转换风险。

### 12. 推荐实施顺序

#### 下一小步：不依赖远端即可完成

1. 文章本地版本历史、差异和恢复。
2. 草稿/待发布/已发布状态。
3. 封面裁剪、比例预设、WebP 和 alt 文本。
4. 发布前 URL、内容、资源和配置差异。
5. 内容治理队列。

这五项都直接建立在现有工作台上，不改变 GitHub Pages、不改变文章永久链接，也不要求
新的外部账号。

#### remote 配置后实施

1. Pages artifact 构建与受保护部署。
2. 工作台展示 GitHub Actions 和部署历史。
3. 线上 `build-info` 对账与部署后 smoke test。
4. 可靠的计划发布。
5. Pull Request 预览链接。

#### 有真实数据后再决定

1. Lighthouse CI 趋势与更严格预算。
2. Search Console 内容更新队列。
3. Newsletter。
4. 在线 CMS 或移动写作入口。
5. Astro/Hugo 迁移原型。

### 13. 横纵交汇后的判断

博客早期的优势是 Markdown 文件简单、可携带；后来的风险来自配置和发布依赖个人记忆。
2026 年的维护用 Git、构建验证和本地工作台修复了这个风险。如果下一阶段为了“更像 CMS”
引入数据库、在线认证和复杂富文本，反而会重新走回依赖隐性状态的老路。

因此最适合这个博客的方向不是做一个缩小版 WordPress，而是做一个“看得见文件、看得见
差异、看得见发布结果”的个人出版台。它可以拥有公众号后台的便利，但不必继承公众号平台
的封闭内容模型。

三个未来剧本也因此更加清晰：

- **最可能**：本地工作台补齐历史、封面和发布差异，GitHub Actions 承担可审计发布；
  Markdown 继续是唯一内容正本。
- **最危险**：GUI 不断增加装饰功能，却没有版本历史和线上对账；作者再次不敢确定点击
  发布后会发生什么。
- **最乐观**：内容治理逐渐形成专题、系列和稳定更新节奏，Atom、搜索与 Search Console
  让旧文章重新被发现；等真实内容形态超出 Hexo 时，再带着干净数据和稳定 URL 迁移。

我的最终排序是：**先恢复、再图片、再差异、再远端发布、最后才是增长工具。**

## 十一、信息来源

### 本地与线上证据

- `package.json`、`_config.yml`、`_config.butterfly.yml`
- `.github/workflows/ci.yml`、`.github/dependabot.yml`
- `source/_posts/`、`source/_data/widget.yml`、`source/_data/link.yml`
- `public/` 生成结果及 2026-07-27 本地浏览器测量
- [Threeyang's Blog 线上首页](https://threeyang.top/)

### 官方资料

- [Hexo 8.1.2 Releases](https://github.com/hexojs/hexo/releases)
- [Hexo 官方插件目录](https://hexo.io/plugins/)
- [Butterfly 快速开始与升级建议](https://butterfly.js.org/posts/21cfbf15/)
- [Butterfly 主题配置：搜索、Lazyload、PWA、PJAX](https://butterfly.js.org/posts/4aa8abbe/)
- [Butterfly 5.6.1 Release](https://github.com/jerryc127/hexo-theme-butterfly/releases)
- [GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [GitHub Actions 部署保护与 concurrency](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments)
- [GitHub Dependency Review](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/manage-your-dependency-security/configure-dependency-review-action)
- [Google：Sitemap 概览](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview)
- [Google：Article 结构化数据](https://developers.google.com/search/docs/appearance/structured-data/article)
- [web.dev：Core Web Vitals](https://web.dev/articles/vitals)
- [web.dev：优化 LCP](https://web.dev/articles/optimize-lcp)
- [web.dev：浏览器原生图片懒加载](https://web.dev/articles/browser-level-image-lazy-loading)
- [Decap CMS：Editorial Workflows](https://decapcms.org/docs/editorial-workflows/)
- [Decap CMS：配置与媒体目录](https://decapcms.org/docs/configure-decap-cms/)
- [TinaCMS 官方仓库：Git 内容与可视化编辑](https://github.com/tinacms/tinacms)
- [Ghost：发布、预览与计划发布](https://ghost.org/help/publishing-content/)
- [Ghost：文章设置与版本历史](https://ghost.org/help/post-settings/)
- [Ghost：Newsletter](https://docs.ghost.org/newsletters)
- [GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [GitHub Actions：部署环境与保护规则](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
- [GitHub：查看部署历史](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/view-deployment-history)
- [Lighthouse CI：配置与性能预算](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md)
- [Google Search Console 入门](https://developers.google.com/search/docs/monitor-debug/search-console-start)
- [Google：Article 结构化数据](https://developers.google.com/search/docs/appearance/structured-data/article)
- [Astro Content Collections](https://docs.astro.build/en/guides/content-collections/)
- [Astro 图片优化](https://docs.astro.build/en/guides/images/)
- [Astro RSS](https://docs.astro.build/en/recipes/rss/)
- [Hugo 内容管理](https://gohugo.io/content-management/)
- [Hugo 图片处理](https://gohugo.io/content-management/image-processing/)

## 十二、方法论说明

本报告使用横纵分析法：纵向追踪博客从内容积累、功能叠加、配置漂移到工程化维护的演进；
横向比较 Hexo、Astro、Hugo 与动态 CMS 在当前需求下的收益和代价，最后用两条轴的交叉
结果决定优化顺序。所有建议以 2026-07-27 的仓库和公开官方资料为基准。
