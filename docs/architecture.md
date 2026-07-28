# 架构与配置边界

## 发布链路

```text
GUI 受管内容变化
        │ 明确勾选 + SYNC SOURCE
        ▼
hexo-blog-source:main
        │ GitHub Actions / npm run check
        ▼
已验证源码 commit
        │
        ├── _config.yml
        ├── _config.butterfly.yml
        └── package-lock.json
                 │
                 ▼
        Hexo 8 + Butterfly 5
                 │
                 ▼
              public/
                 │
                 ▼
            .deploy_git/
                 │
                 ▼
threeyang3/threeyang3.github.io:master
                 │
                 ▼
       https://threeyang.top
```

`public/`、`db.json` 和 `.deploy_git/` 都是可重新生成的数据。博客的可恢复
源文件是源码 Git 中的配置、文章、图片、模板、依赖清单和维护脚本。

## 本地管理控制台

Blog Control Room 是发布链路之前的一层本机内容与操作界面，不替代 Hexo。
文章、素材和四个主题视觉字段可以通过受限 API 修改；站点 URL、CNAME、部署仓库、
部署分支和其他配置不能通过 GUI 修改：

```text
浏览器（127.0.0.1:4173）
           │ 临时令牌 + Origin 检查
           ▼
admin/server.js
           ├── 固定 action ID → 固定命令与参数
           │   ├── npm run check / build / clean / deploy
           │   ├── npm audit / outdated / smoke:live
           │   ├── git status
           │   ├── 发布差异与内容治理只读报告
           │   ├── 受管源码选择 → check → commit → origin/main
           │   ├── 当前 HEAD 对应 GitHub Actions 状态
           │   └── Hexo preview --draft（localhost:5000）
           ├── admin/source-control.js
           │   ├── 固定源码 origin 与 main 分支
           │   ├── 明确路径清单，禁止 git add .
           │   ├── ahead / behind / remote SHA 校验
           │   └── CI 成功后解锁 Pages 部署
           └── admin/content-store.js
               ├── source/_posts/*.md（已发布）
               ├── source/_drafts/*.md（草稿/待发布）
               ├── source/img/ 与 source/picture/
               ├── source/_data/media.json
               ├── .blog-admin/history/（本地恢复点）
               └── _config.butterfly.yml 四字段白名单
```

后端使用 Node 内置 HTTP 和 `child_process.spawn`，不增加 Web 框架或生产
依赖。普通维护动作同一时间只运行一个；预览进程单独管理。stdout/stderr 通过
Server-Sent Events 实时发送到浏览器，末尾最多 500 行仅保存在当前服务进程内。

文章保存不重新序列化整份 Front Matter，而是只替换标题、日期、分类、标签、封面和
摘要，未知字段原样保留。浏览器必须提交读取时的 SHA-256；文件在此期间被其他程序
修改时，服务返回 409，避免覆盖较新的内容。`password` 只用于判断文章是否加密，
不会返回给浏览器。

每次有内容变化的保存、状态移动或恢复前，旧原文会写入被 Git 忽略的
`.blog-admin/history/<article-id>/`，每篇最多保留 20 版。历史文件可能包含原始
Front Matter，因此只能留在本机；列表和差异 API 过滤 `password`。恢复不会删除
恢复点，并先保存当前版本。状态使用目录表达：`_drafts` 中无 `workflow` 为草稿，
`workflow: pending` 为待发布，`_posts` 为已发布。

素材上传只接受 PNG、JPEG、GIF 和 WebP，单张上限 8 MB，输出到
`source/img/uploads/YYYY/MM/`。文章和素材 ID 使用服务端生成的编码标识，解码后的
路径必须再次通过目录边界检查。浏览器封面工作室生成 WebP 后，后端仍校验声明格式、
文件签名和路径；尺寸、比例用途与 alt 写入 `source/_data/media.json`。

外观保存只允许 `index_img`、`default_top_img`、`cover.default_cover` 和
`avatar.img`。写入前比较配置哈希、创建 `.blog-admin/backups/` 备份，再使用同目录
临时文件原子替换。该目录已被 Git 忽略；正式回滚仍优先使用 Git 中的已知版本。

API 只供同源前端使用：

| 路由 | 方法 | 用途 |
|------|------|------|
| `/api/status` | GET | 读取版本、CNAME、文章数、Git、任务和预览状态 |
| `/api/events` | GET | 订阅实时日志与状态事件 |
| `/api/posts` | GET / POST | 列出文章或创建带唯一 abbrlink 的新文章 |
| `/api/posts/:id` | GET / PUT | 读取文章或经并发哈希保护后保存 |
| `/api/posts/:id/status` | PUT | 经哈希保护后切换草稿、待发布、已发布 |
| `/api/posts/:id/history` | GET | 列出被过滤的本地版本元数据 |
| `/api/posts/:id/history/:version` | GET / POST | 查看安全差异 / 恢复版本 |
| `/api/media` | GET / POST | 列出或上传受支持的图片 |
| `/api/media/:id` | PUT | 更新素材 alt、尺寸和用途元数据 |
| `/api/media/file/:id` | GET | 预览素材库中的本地图片 |
| `/api/health` | GET | 读取内容治理问题队列 |
| `/api/release-report` | GET | 读取文章、素材、配置和基础设施变更清单 |
| `/api/source-status` | GET | 读取源码变化、远端同步、当前提交 CI 与部署门禁 |
| `/api/source-sync` | POST | 完整检查后提交并推送明确选择的受管路径 |
| `/api/source-push` | POST | 继续推送已创建但尚未到达远端的本地提交 |
| `/api/visuals` | GET / PUT | 读取或保存四个 Butterfly 视觉字段 |
| `/api/actions/:id` | POST | 执行命令白名单中的动作 |
| `/api/preview/start` | POST | 启动 5000 端口的 Hexo 预览 |
| `/api/preview/stop` | POST | 停止由控制台启动的预览 |

API 必须携带每次启动随机生成的令牌。修改类请求还校验 Origin；部署 action
额外要求完整确认短语，源码同步要求 `SYNC SOURCE`，外观保存要求 `SAVE VISUALS`。
源码提交说明与路径都作为独立进程参数传递，Git 和 npm 始终使用 `shell: false`。服务固定绑定
`127.0.0.1`，不能作为远程管理面板使用。

## 配置所有权

### `_config.yml`

只包含 Hexo 和 Hexo 插件配置，尤其包括：

- `url: https://threeyang.top`
- `permalink: posts/:abbrlink/`
- `theme: butterfly`
- hexo-blog-encrypt、hexo-douban 等插件配置
- Sitemap、Atom 和 `search.xml` 生成配置
- GitHub Pages 仓库和 `master` 部署分支

### `_config.butterfly.yml`

只包含本站需要覆盖的 Butterfly 配置。主题默认值来自 npm 包：

```text
node_modules/hexo-theme-butterfly/_config.yml
```

升级主题时先阅读新版默认配置和 release notes，再迁移确实需要的覆盖项。不要
把 `_config.yml` 复制成 `_config.butterfly.yml`。

### `source/CNAME`

内容固定为：

```text
threeyang.top
```

Hexo 会把它复制到 `public/CNAME`，随后部署到 GitHub Pages 分支根目录。
仓库内的校验脚本会阻止 CNAME、部署仓库或部署分支被意外修改。

## 主题和静态资源

Butterfly 通过 `package.json` 和 `package-lock.json` 管理，不再保留
`themes/butterfly` 副本。这样可以避免主题代码、旧配置和手工修改互相覆盖。

个人图片位于 `source/img/`，个人 CSS 位于 `source/css/custom.css`，并由
`_config.butterfly.yml` 的 `inject.head` 引入。

首页背景和默认封面使用 `bk1.webp`、`bk2.webp`；原 JPG/PNG 暂时保留为回滚源。
文章正文启用浏览器原生懒加载，首页首屏不懒加载。canvas-nest、click-heart、
preloader、不蒜子和外部诗词副标题已关闭。本地搜索由
`hexo-generator-searchdb` 与 Butterfly `local_search` 共同提供。

## 生成与可观察性

`scripts/build-info.js` 在生成时写入 `public/build-info.json`，包含源码 commit、
构建时间和 Hexo 版本。`tools/verify-build.js` 同时验证 CNAME、canonical、加密
输出、Sitemap、Atom、搜索索引、robots 和构建标识。

`tools/verify-content.js` 在生成前同时检查 `_posts` 与 `_drafts` 的必填字段、
abbrlink 唯一性、本地封面和受管链接。历史已发布文章缺少显式封面或摘要时发出警告；
治理页把缺摘要、缺封面、单例标签、HTTP 链接和相似标题转成可进入文章的队列。
`tools/verify-performance.js` 根据 `tools/performance-budgets.json` 检查代表页面体积、
首页脚本数和运行时第三方来源。

## 公开源码与加密密码

公开 Markdown 不保存 hexo-blog-encrypt 的明文密码，只保存：

```yaml
password_secret: BLOG_ENCRYPTION_PASSWORD_C57A
```

`scripts/encryption-secrets.js` 在 `before_post_render` 阶段解析引用：本机读取被忽略的
`.blog-admin/secrets.json`，CI/部署读取同名环境变量，随后仅在内存中的文章对象设置
`password`，再由 hexo-blog-encrypt 的 `after_post_render` 生成密文。正常构建缺少真实
secret 会失败；只有 Pull Request CI 可显式使用非生产占位值检查构建结构。

`tools/verify-source-privacy.js` 在 `npm run check` 最前执行，拒绝文章明文 `password`、
常见 GitHub/AWS 令牌和私钥模式。`tools/verify-build.js` 另外确认密码引用、文章明文和
引用名称没有进入 HTML、Atom 或搜索索引。

部署后，npm 的 `postdeploy` 生命周期自动调用 `tools/smoke-live.js`。检查器允许 Pages
在有限重试窗口内完成 legacy build，然后同时核验首页、Sitemap、Atom、robots、加密文章、
旧 URL canonical 跳转，以及线上 `build-info.json` 是否等于当前源码提交。HTTP 200
但 SHA 尚未更新只表示旧站仍可访问，不会被误判为部署完成。

`.github/workflows/ci.yml` 在 push/PR 上运行锁定依赖构建，PR 另外运行 dependency
review。公开源码仓库为 `threeyang3/hexo-blog-source`，其中已配置文章密码对应的
Repository Secret；GitHub Pages artifact 部署仍未启用，当前发布仍由受保护的
`npm run deploy` 完成。`admin/source-control.js` 通过公开 GitHub Actions API 查询
当前 HEAD 的运行结果；状态缺失、失败或 API 不可用都保持部署锁定。
`tools/verify-source-sync.js` 在命令行 `predeploy` 中执行同一门禁。未来工作流只提供在
`docs/templates/pages-artifact.yml`，满足模板顶部四项前置条件后才能人工启用。

## 加密文章

hexo-blog-encrypt 4 使用 AES-256-GCM。当前公开 Front Matter 只保存
`password_secret`；构建钩子解析真实 Secret 后，在内存中设置插件所需的 `password`
字段并触发加密。生成结果必须包含：

- `data-hbe-format="4"`
- `data-kdf-iterations="600000"`
- `data-auto-save="false"`

源码密码不能写入普通配置、日志或维护文档。
