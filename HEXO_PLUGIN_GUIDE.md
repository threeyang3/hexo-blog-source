# Hexo 博客发布 Obsidian 插件开发指南

> 维护状态：2026-07-27 已按 Hexo 8.1.2、Butterfly 5.6.1 更新。主题通过
> npm 安装，不再存在可编辑的 `themes/butterfly/`。发布插件应调用
> `npm run check` 和 `npm run deploy`，不要直接调用 `hexo deploy -g`。
> 仓库已内置 `npm run gui` 内容工作台；Obsidian 插件如需写文章，应遵循相同的
> 路径边界、Front Matter 保留和并发修改保护。

## 一、Hexo 项目结构

```
blog/
├── _config.yml              # 主配置文件
├── _config.[theme].yml      # 主题配置文件（如 _config.butterfly.yml）
├── package.json             # 依赖管理
├── scaffolds/               # 文章模板
│   ├── draft.md             # 草稿模板
│   ├── page.md              # 页面模板
│   └── post.md              # 文章模板
├── source/                  # 源文件目录
│   ├── _posts/              # 文章目录（Markdown 文件）
│   ├── _drafts/             # 草稿目录（默认不渲染）
│   ├── _data/               # 数据文件（YAML/JSON）
│   │   ├── link.yml         # 友链数据
│   │   └── widget.yml       # 挂件配置
│   ├── categories/          # 分类页面
│   ├── tags/                # 标签页面
│   └── about/               # 关于页面
├── source/img/              # 主题个性化图片
├── tools/                   # 构建与部署保护工具
├── node_modules/hexo-theme-butterfly/ # npm 安装的只读主题
├── public/                  # 生成的静态文件（部署用）
├── .deploy_git/             # Git 部署目录
└── db.json                  # Hexo 数据库缓存
```

### 关键目录说明

| 目录 | 说明 | 插件需关注 |
|------|------|-----------|
| `source/_posts/` | 已发布文章 | ✅ 主要操作目录 |
| `source/_drafts/` | 草稿 | ✅ 草稿管理 |
| `scaffolds/` | 模板 | ✅ 新建文章模板 |
| `_config.yml` | 配置 | ✅ 读取站点配置 |
| `public/` | 输出目录 | ❌ 自动生成 |

---

## 二、Hexo 常用命令

### 2.1 基础命令

```bash
# 初始化博客
hexo init [folder]

# 新建文章
hexo new [layout] <title>
hexo new post "我的文章"      # 在 source/_posts/ 创建
hexo new draft "草稿"         # 在 source/_drafts/ 创建
hexo new page "关于"          # 在 source/ 创建页面

# 生成静态文件
hexo generate    # 或 hexo g
hexo g --watch   # 监听文件变化

# 启动本地服务器
hexo server      # 或 hexo s，默认端口 4000
hexo s -p 5000   # 指定端口

# 部署
hexo deploy      # 底层命令；本仓库不要直接调用，使用 npm run deploy
hexo d -g        # 生成并部署

# 清理缓存
hexo clean       # 删除 public/ 和 db.json
```

### 2.2 组合命令

```bash
# 安全工作流
npm run check                       # 清理、生成、部署保护验证
npm run server                      # 本地预览
npm run deploy                      # 校验通过后部署

# 发布草稿
hexo publish <filename>            # 将草稿移到 _posts/

# 本仓库的本地管理界面
npm run gui                       # 打开 Blog Control Room
npm run test:gui                  # 验证 GUI API 和安全边界
```

### 2.3 调试命令

```bash
# 显示 Hexo 版本
hexo version

# 列出所有文章
hexo list post

# 列出所有页面
hexo list page

# 安全模式（不加载插件）
hexo --safe

# 调试模式
hexo --debug
```

### 2.4 npm scripts（package.json）

```json
{
  "scripts": {
    "build": "hexo generate",
    "check": "npm run verify:content && npm run clean && npm run build -- --bail && npm run verify && npm run verify:performance",
    "clean": "hexo clean",
    "deploy": "hexo deploy",
    "gui": "node admin/server.js",
    "predeploy": "npm run check",
    "server": "hexo server",
    "smoke:live": "node tools/smoke-live.js",
    "test:gui": "node tools/test-admin.js && node tools/test-editorial-workflow.js",
    "verify": "node tools/verify-build.js",
    "verify:content": "node tools/verify-content.js",
    "verify:performance": "node tools/verify-performance.js"
  }
}
```

---

## 三、文章格式（Front Matter）

### 3.1 标准 Front Matter

```yaml
---
title: 文章标题
date: 2024-07-15 10:30:00
updated: 2024-07-20 15:00:00
categories: 
  - 随笔
tags:
  - 标签1
  - 标签2
excerpt: 摘要内容（可选）
keywords: 关键词（可选）
author: 作者名（可选）
---
```

### 3.2 Butterfly 主题扩展属性

```yaml
---
title: 文章标题
date: 2024-07-15 10:30:00
categories: 随笔
tags:
  - 梦想
  - 个人

# Butterfly 主题特有
sticky: 100              # 置顶优先级（数字越大越靠前）
abbrlink: 2a0d           # 短链接（hexo-abbrlink 自动生成）
cover: /img/cover.jpg    # 封面图片
description: 文章描述    # SEO 描述
toc: true                # 是否显示目录（默认 true）
comments: true           # 是否显示评论（默认 true）

# 文章加密（hexo-blog-encrypt；公开源码使用 Secret 引用）
password_secret: BLOG_ENCRYPTION_PASSWORD_C57A
abstract: 加密提示信息
message: 输入密码提示
---
```

### 3.3 Front Matter 字段详解

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | string | ✅ | 文章标题 |
| `date` | datetime | ✅ | 创建时间，格式 `YYYY-MM-DD HH:mm:ss` |
| `updated` | datetime | ❌ | 更新时间 |
| `categories` | string/array | ✅ | 分类，支持嵌套 |
| `tags` | array | ✅ | 标签列表 |
| `sticky` | number | ❌ | 置顶优先级 |
| `abbrlink` | string | ✅ | 全局唯一短链接 ID；内置 GUI 新建时生成 |
| `cover` | string | ❌ | 封面图片路径 |
| `description` | string | ❌ | 文章描述/摘要 |
| `toc` | boolean | ❌ | 是否显示目录 |
| `comments` | boolean | ❌ | 是否显示评论 |
| `password_secret` | string | ❌ | 构建时注入文章密码的 Secret 名称 |

### 3.4 分类嵌套写法

```yaml
# 单层分类
categories: 随笔

# 多层嵌套分类
categories:
  - [随笔, 书评]
  - [读书笔记]

# 等价于
categories: [[随笔, 书评], [读书笔记]]
```

---

## 四、Markdown 内容规范

### 4.1 标题层级

```markdown
# 一级标题（文章标题，通常不用，已在 Front Matter 中）

## 二级标题（章节标题，对应目录一级）

### 三级标题（子章节，对应目录二级）

#### 四级标题（更细分）
```

**注意**：
- 文章标题已在 Front Matter 的 `title` 中定义，正文不需要 `#` 标题
- 章节使用 `##`，子章节使用 `###`
- 目录（TOC）会根据标题层级自动生成

### 4.2 常用 Markdown 语法

```markdown
<!-- 文字样式 -->
**粗体** *斜体* ~~删除线~~ `代码`

<!-- 引用 -->
> 引用内容

<!-- 列表 -->
- 无序列表
1. 有序列表

<!-- 代码块 -->
```javascript
console.log('Hello');
```

<!-- 链接 -->
[链接文字](https://example.com)

<!-- 图片 -->
![图片描述](/img/example.jpg)

<!-- 表格 -->
| 列1 | 列2 |
|-----|-----|
| 内容 | 内容 |
```

### 4.3 Butterfly 主题标签插件

```markdown
<!-- Note 提示框 -->
{% note info %}
提示信息
{% endnote %}

<!-- Button 按钮 -->
{% btn 'https://url', 文字, fa fa-icon %}

<!-- Tab 标签页 -->
{% tabs test, 1 %}
<!-- tab 第一个 -->
内容1
<!-- endtab -->
<!-- tab 第二个 -->
内容2
<!-- endtab -->
{% endtabs %}

<!-- 隐藏内容 -->
{% hideToggle 点击展开 %}
隐藏的内容
{% endhideToggle %}
```

---

## 五、配置文件说明

### 5.1 _config.yml 主配置

```yaml
# 站点信息
title: 博客标题
subtitle: 副标题
description: 描述
author: 作者
language: zh_CN
timezone: ''

# URL 配置
url: https://example.com
permalink: posts/:abbrlink/    # 永久链接格式
permalink_defaults:

# 目录配置
source_dir: source             # 源文件目录
public_dir: public             # 输出目录
tag_dir: tags                  # 标签目录
archive_dir: archives          # 归档目录
category_dir: categories       # 分类目录

# 写作配置
new_post_name: :title.md       # 新文章文件名格式
default_layout: post           # 默认布局
post_asset_folder: false       # 是否创建资源文件夹

# 分页
per_page: 10                   # 每页文章数

# 主题
theme: butterfly               # 使用的主题

# 部署
deploy:
  type: git
  repo: https://github.com/user/user.github.io.git
  branch: master
```

### 5.2 重要配置项

| 配置项 | 说明 | 插件需读取 |
|--------|------|-----------|
| `source_dir` | 文章源目录 | ✅ |
| `new_post_name` | 新文章命名规则 | ✅ |
| `permalink` | 链接格式 | ✅ |
| `theme` | 当前主题 | ✅ |
| `language` | 语言 | ✅ |
| `per_page` | 每页文章数 | ❌ |

---

## 六、插件开发关键点

### 6.1 文章文件命名

```
# 默认格式：:title.md
我的文章.md

# 带日期格式：:year-:month-:day-:title.md
2024-07-15-我的文章.md

# 中文命名支持（需 UTF-8 编码）
二十岁生日随笔.md
```

### 6.2 文章路径解析

```
source/_posts/文章标题.md
           ↓
posts/:abbrlink/
           ↓
https://blog.com/posts/2a0d/
```

### 6.3 需要监听的文件变化

- 新建文章 → `source/_posts/` 新增 `.md` 文件
- 修改文章 → 文件内容变化
- 删除文章 → 文件删除
- Front Matter 变化 → 需重新解析

### 6.4 插件需要实现的功能

1. **文章管理**
   - 新建文章（使用 scaffolds 模板）
   - 编辑文章（打开 Markdown 文件）
   - 删除文章
   - 发布草稿

2. **Front Matter 操作**
   - 解析 YAML Front Matter
   - 修改 title、date、categories、tags
   - 添加自定义字段（sticky、cover 等）

3. **Hexo 命令集成**
   - 执行 `hexo new` 创建文章
   - 执行 `hexo generate` 生成
   - 执行 `npm run deploy` 部署，禁止绕过 predeploy 校验
   - 执行 `hexo server` 预览

4. **状态同步**
   - 监听文件变化
   - 更新文章列表
   - 显示发布状态

### 6.5 与内置内容工作台协作

`admin/content-store.js` 是当前仓库已验证的写入参考：

- 已有文章只替换允许编辑的顶层字段，不能重新序列化并丢失未知字段。
- 日常文章 API 不读取或返回密码，只根据 `password_secret` 返回“是否加密”。被 Git
  忽略的本地历史会原样保存 Front Matter，但历史列表和差异 API 必须过滤敏感字段。
- 保存前比较读取时的内容哈希；不覆盖来自其他编辑器的新版本。
- 草稿、待发布和已发布分别映射到 `_drafts` + workflow、`_posts`；状态移动也检查哈希。
- 文件名和素材路径必须在服务端验证，不能直接信任 UI 传入路径。
- 新文章必须立即获得唯一 `abbrlink`，因为 `npm run verify:content` 在构建前执行。

Obsidian 插件若与工作台同时使用，应在写入前重新读取文件，并对比 mtime 或内容哈希。

---

## 七、常用插件配置

### 7.1 hexo-abbrlink（短链接）

```yaml
# _config.yml
permalink: posts/:abbrlink/
abbrlink:
  alg: crc16      # 算法：crc16 或 crc32
  rep: hex        # 进制：dec 或 hex
```

### 7.2 hexo-blog-encrypt（文章加密）

```yaml
# _config.yml
encrypt:
  enable: true

# 文章 Front Matter
password_secret: BLOG_ENCRYPTION_PASSWORD_C57A
abstract: 加密提示
```

### 7.3 hexo-deployer-git（Git 部署）

```yaml
deploy:
  type: git
  repo: https://github.com/user/repo.git
  branch: master
  message: "Site updated: {{ now('YYYY-MM-DD HH:mm:ss') }}"
```

---

## 八、开发建议

### 8.1 技术栈

- TypeScript + Obsidian API
- gray-matter（解析 Front Matter）
- child_process（执行 Hexo 命令）
- chokidar（监听文件变化）

### 8.2 核心数据结构

```typescript
interface HexoPost {
  path: string;           // 文件路径
  title: string;          // 标题
  date: Date;             // 创建时间
  updated?: Date;         // 更新时间
  categories: string[];   // 分类
  tags: string[];         // 标签
  abbrlink?: string;      // 短链接
  sticky?: number;        // 置顶
  cover?: string;         // 封面
  content: string;        // 正文内容
  raw: string;            // 原始内容
}

interface HexoConfig {
  source_dir: string;
  public_dir: string;
  theme: string;
  permalink: string;
  new_post_name: string;
}
```

### 8.3 命令执行封装

```typescript
import { existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { spawn } from 'child_process';

const allowedActions = {
  check: ['run', 'check'],
  preview: ['run', 'server'],
  deploy: ['run', 'deploy'],
} as const;

async function runAction(
  action: keyof typeof allowedActions,
  cwd: string
): Promise<string> {
  const npmCli = [
    process.env.npm_execpath,
    join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    resolve(dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ].find(candidate => candidate && existsSync(candidate));
  if (!npmCli) throw new Error('找不到 npm-cli.js');

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [npmCli, ...allowedActions[action]], {
      cwd,
      shell: false,
      windowsHide: true,
    });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    child.on('close', code => {
      if (code === 0) resolve(output);
      else reject(new Error(`Action failed with exit code ${code}\n${output}`));
    });
  });
}

// 使用
await runAction('check', blogPath);
await runAction('deploy', blogPath);
```

不要把用户输入拼接成 Shell 命令。需要支持文章标题等参数时，应先做长度、字符
和路径边界验证，再作为独立的 `args` 元素传给 `spawn`。部署只能调用
`npm run deploy`，让 `predeploy` 保护继续生效。

### 8.4 Front Matter 解析

```typescript
import matter from 'gray-matter';

function parsePost(content: string): HexoPost {
  const { data, content: body } = matter(content);
  return {
    ...data,
    content: body,
    raw: content
  };
}

function stringifyPost(post: HexoPost): string {
  const { content, raw, ...frontMatter } = post;
  return matter.stringify(content, frontMatter);
}
```

---

## 九、参考资源

- [Hexo 官方文档](https://hexo.io/docs/)
- [Hexo API 文档](https://hexo.io/api/)
- [Butterfly 主题文档](https://butterfly.js.org/)
- [Obsidian 插件开发文档](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- [gray-matter](https://github.com/jonschlinkert/gray-matter)
