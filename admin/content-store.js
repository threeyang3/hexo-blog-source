'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(process.env.BLOG_ADMIN_ROOT || path.resolve(__dirname, '..'));
const SOURCE_DIR = path.join(ROOT, 'source');
const POSTS_DIR = path.join(SOURCE_DIR, '_posts');
const DRAFTS_DIR = path.join(SOURCE_DIR, '_drafts');
const THEME_CONFIG = path.join(ROOT, '_config.butterfly.yml');
const BACKUP_DIR = path.join(ROOT, '.blog-admin', 'backups');
const HISTORY_DIR = path.join(ROOT, '.blog-admin', 'history');
const MEDIA_METADATA = path.join(SOURCE_DIR, '_data', 'media.json');
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
const MEDIA_DIRECTORIES = ['img', 'picture'];
const MAX_POST_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_HISTORY_ITEMS = 20;

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function fileId(relativePath) {
  return Buffer.from(relativePath, 'utf8').toString('base64url');
}

function decodeFileId(id) {
  try {
    return Buffer.from(String(id), 'base64url').toString('utf8');
  } catch {
    return '';
  }
}

function assertInside(parent, target) {
  const resolvedParent = path.resolve(parent);
  const resolvedTarget = path.resolve(target);
  if (resolvedTarget !== resolvedParent && !resolvedTarget.startsWith(`${resolvedParent}${path.sep}`)) {
    const error = new Error('路径不在允许的内容目录中');
    error.statusCode = 403;
    throw error;
  }
  return resolvedTarget;
}

function resolvePost(id) {
  const decoded = decodeFileId(id);
  if (!decoded || path.isAbsolute(decoded)) {
    const error = new Error('文章标识无效');
    error.statusCode = 400;
    throw error;
  }
  const normalized = decoded.replace(/\\/g, '/');
  const match = normalized.match(/^(posts|drafts)\/(.+\.md)$/i);
  const directory = match?.[1].toLowerCase() === 'drafts' ? DRAFTS_DIR : POSTS_DIR;
  const relativePath = match ? match[2] : normalized;
  if (path.extname(relativePath).toLowerCase() !== '.md') {
    const error = new Error('文章标识无效');
    error.statusCode = 400;
    throw error;
  }
  return {
    directory,
    filePath: assertInside(directory, path.join(directory, relativePath)),
    relativePath,
    statusRoot: directory === DRAFTS_DIR ? 'drafts' : 'posts',
  };
}

function splitDocument(raw) {
  const match = raw.match(/^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) return { frontMatter: '', body: raw, newline: raw.includes('\r\n') ? '\r\n' : '\n' };
  return {
    frontMatter: match[1],
    body: match[2],
    newline: raw.includes('\r\n') ? '\r\n' : '\n',
  };
}

function parseScalar(value) {
  const trimmed = String(value || '').trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    if (trimmed.startsWith('"')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return trimmed.slice(1, -1);
      }
    }
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  if (trimmed === '[]') return [];
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  return trimmed;
}

function parseFrontMatter(frontMatter) {
  const result = {};
  const lines = frontMatter.split(/\r?\n/);
  let activeKey = null;

  for (const line of lines) {
    const topLevel = line.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
    if (topLevel) {
      activeKey = topLevel[1];
      result[activeKey] = parseScalar(topLevel[2] || '');
      continue;
    }
    const listItem = line.match(/^\s+-\s*(.*)$/);
    if (activeKey && listItem) {
      if (!Array.isArray(result[activeKey])) result[activeKey] = [];
      result[activeKey].push(parseScalar(listItem[1]));
    }
  }
  return result;
}

function asList(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (value === undefined || value === null || value === '') return [];
  return [String(value)];
}

function excerpt(body) {
  return body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150);
}

function summarizePost(filePath, statusRoot = 'posts') {
  const raw = fs.readFileSync(filePath, 'utf8');
  const { frontMatter, body } = splitDocument(raw);
  const data = parseFrontMatter(frontMatter);
  const stat = fs.statSync(filePath);
  const contentDirectory = statusRoot === 'drafts' ? DRAFTS_DIR : POSTS_DIR;
  const relativePath = path.relative(contentDirectory, filePath);
  const workflow = String(data.workflow || '');
  const status = statusRoot === 'posts' ? 'published' : workflow === 'pending' ? 'pending' : 'draft';
  return {
    id: fileId(`${statusRoot}/${relativePath.replace(/\\/g, '/')}`),
    fileName: relativePath,
    title: String(data.title || path.basename(relativePath, '.md')),
    date: String(data.date || ''),
    updated: String(data.updated || ''),
    categories: asList(data.categories),
    tags: asList(data.tags),
    cover: String(data.cover || ''),
    description: String(data.description || ''),
    excerpt: excerpt(body),
    words: body.replace(/\s+/g, '').length,
    encrypted: Object.hasOwn(data, 'password') || Object.hasOwn(data, 'password_secret'),
    abbrlink: String(data.abbrlink || ''),
    status,
    modifiedAt: stat.mtime.toISOString(),
    hash: hash(raw),
  };
}

function walk(directory, predicate) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(fullPath, predicate));
    if (entry.isFile() && predicate(fullPath)) files.push(fullPath);
  }
  return files;
}

function listPosts() {
  return [
    ...walk(POSTS_DIR, (filePath) => path.extname(filePath).toLowerCase() === '.md')
      .map((filePath) => summarizePost(filePath, 'posts')),
    ...walk(DRAFTS_DIR, (filePath) => path.extname(filePath).toLowerCase() === '.md')
      .map((filePath) => summarizePost(filePath, 'drafts')),
  ]
    .sort((left, right) => String(right.date).localeCompare(String(left.date), 'zh-CN'));
}

function getPost(id) {
  const resolved = resolvePost(id);
  const { filePath } = resolved;
  if (!fs.existsSync(filePath)) {
    const error = new Error('文章不存在');
    error.statusCode = 404;
    throw error;
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const { frontMatter, body } = splitDocument(raw);
  const data = parseFrontMatter(frontMatter);
  return {
    ...summarizePost(filePath, resolved.statusRoot),
    body,
    fields: {
      title: String(data.title || ''),
      date: String(data.date || ''),
      categories: asList(data.categories),
      tags: asList(data.tags),
      cover: String(data.cover || ''),
      description: String(data.description || ''),
      status: resolved.statusRoot === 'posts' ? 'published' : String(data.workflow || '') === 'pending' ? 'pending' : 'draft',
    },
  };
}

function quoteYaml(value) {
  return JSON.stringify(String(value));
}

function fieldLines(key, value) {
  if ((key === 'cover' || key === 'description') && !value) return [];
  if (key === 'workflow' && !value) return [];
  if (key === 'tags' || key === 'categories') {
    const values = asList(value);
    if (values.length === 0) return [`${key}: []`];
    if (key === 'categories' && values.length === 1) return [`${key}: ${quoteYaml(values[0])}`];
    return [`${key}:`, ...values.map((item) => `  - ${quoteYaml(item)}`)];
  }
  if (key === 'date') return [`date: ${String(value)}`];
  return [`${key}: ${quoteYaml(value)}`];
}

function patchFrontMatter(frontMatter, fields, newline) {
  const keys = ['title', 'date', 'categories', 'tags', 'cover', 'description', 'abbrlink', 'workflow'];
  const lines = frontMatter ? frontMatter.split(/\r?\n/) : [];
  const sections = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^([A-Za-z0-9_-]+):/);
    if (!match) continue;
    let end = index + 1;
    while (end < lines.length && !/^[A-Za-z0-9_-]+:/.test(lines[end])) end += 1;
    sections.push({ key: match[1], start: index, end });
    index = end - 1;
  }

  for (const key of keys) {
    if (!Object.hasOwn(fields, key)) continue;
    const replacement = fieldLines(key, fields[key]);
    const section = sections.find((item) => item.key === key);
    if (section) {
      lines.splice(section.start, section.end - section.start, ...replacement);
      return patchFrontMatter(lines.join(newline), Object.fromEntries(
        keys.filter((remaining) => remaining !== key && Object.hasOwn(fields, remaining))
          .map((remaining) => [remaining, fields[remaining]]),
      ), newline);
    }
    lines.push(...replacement);
  }
  return lines.join(newline).replace(new RegExp(`${newline}{3,}`, 'g'), `${newline}${newline}`).trim();
}

function normalizePostInput(input) {
  const title = String(input.title || '').trim();
  const body = String(input.body || '');
  const date = String(input.date || '').trim();
  const description = String(input.description || '').trim();
  const cover = String(input.cover || '').trim();
  const categories = asList(input.categories).map((item) => item.trim()).filter(Boolean);
  const tags = asList(input.tags).map((item) => item.trim()).filter(Boolean);

  if (!title || title.length > 200) throw Object.assign(new Error('标题不能为空且不能超过 200 字'), { statusCode: 400 });
  if (!/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.test(date)) {
    throw Object.assign(new Error('发布日期格式无效'), { statusCode: 400 });
  }
  if (Buffer.byteLength(body) > MAX_POST_BYTES) throw Object.assign(new Error('文章正文超过 2 MB'), { statusCode: 413 });
  if (description.length > 500) throw Object.assign(new Error('摘要不能超过 500 字'), { statusCode: 400 });
  if (cover.length > 500 || cover.includes('\n')) throw Object.assign(new Error('封面地址无效'), { statusCode: 400 });
  if ([...categories, ...tags].some((item) => item.length > 60 || item.includes('\n'))) {
    throw Object.assign(new Error('分类或标签格式无效'), { statusCode: 400 });
  }
  return { title, body, date: date.replace('T', ' '), description, cover, categories, tags };
}

function atomicWrite(filePath, content) {
  const temporary = `${filePath}.${process.pid}.${crypto.randomBytes(5).toString('hex')}.tmp`;
  fs.writeFileSync(temporary, content, 'utf8');
  try {
    fs.renameSync(temporary, filePath);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function historyKey(relativePath) {
  return fileId(relativePath.replace(/\\/g, '/'));
}

function historyDirectory(relativePath) {
  return path.join(HISTORY_DIR, historyKey(relativePath));
}

function pruneHistory(directory) {
  const entries = fs.readdirSync(directory)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .reverse();
  for (const name of entries.slice(MAX_HISTORY_ITEMS)) {
    fs.unlinkSync(path.join(directory, name));
  }
}

function recordHistory(filePath, relativePath, raw, reason = 'save') {
  const directory = historyDirectory(relativePath);
  fs.mkdirSync(directory, { recursive: true });
  const now = new Date();
  const name = `${now.toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(3).toString('hex')}.json`;
  const data = parseFrontMatter(splitDocument(raw).frontMatter);
  const entry = {
    id: name.slice(0, -5),
    createdAt: now.toISOString(),
    reason,
    hash: hash(raw),
    title: String(data.title || path.basename(relativePath, '.md')),
    raw,
  };
  atomicWrite(path.join(directory, name), `${JSON.stringify(entry)}\n`);
  pruneHistory(directory);
  return entry;
}

function savePost(id, input) {
  const resolved = resolvePost(id);
  const { filePath, relativePath } = resolved;
  if (!fs.existsSync(filePath)) throw Object.assign(new Error('文章不存在'), { statusCode: 404 });
  const raw = fs.readFileSync(filePath, 'utf8');
  if (!input.originalHash || input.originalHash !== hash(raw)) {
    throw Object.assign(new Error('文章已在其他位置被修改，请重新载入后再保存'), { statusCode: 409 });
  }
  const normalized = normalizePostInput(input);
  const { frontMatter, newline } = splitDocument(raw);
  const workflow = resolved.statusRoot === 'drafts'
    ? (String(input.status || '') === 'pending' ? 'pending' : 'draft')
    : '';
  const updatedFrontMatter = patchFrontMatter(frontMatter, { ...normalized, workflow }, newline);
  const updated = `---${newline}${updatedFrontMatter}${newline}---${newline}${normalized.body.replace(/^\r?\n/, '')}`;
  if (updated === raw) return getPost(id);
  recordHistory(filePath, relativePath, raw);
  atomicWrite(filePath, updated);
  return getPost(id);
}

function safeSlug(value) {
  let slug = String(value || '')
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.\s-]+|[.\s-]+$/g, '')
    .slice(0, 100);
  if (!slug || /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(slug)) slug = `post-${Date.now()}`;
  return slug;
}

function createPost(input) {
  const normalized = normalizePostInput({ ...input, body: input.body || '' });
  const requestedStatus = ['pending', 'published'].includes(String(input.status)) ? String(input.status) : 'draft';
  const targetDirectory = requestedStatus === 'published' ? POSTS_DIR : DRAFTS_DIR;
  fs.mkdirSync(targetDirectory, { recursive: true });
  const base = safeSlug(input.slug || normalized.title);
  let fileName = `${base}.md`;
  let sequence = 2;
  while (fs.existsSync(path.join(POSTS_DIR, fileName)) || fs.existsSync(path.join(DRAFTS_DIR, fileName))) {
    fileName = `${base}-${sequence}.md`;
    sequence += 1;
  }
  const newline = '\n';
  const usedAbbrlinks = new Set([
    ...walk(POSTS_DIR, (candidate) => path.extname(candidate).toLowerCase() === '.md'),
    ...walk(DRAFTS_DIR, (candidate) => path.extname(candidate).toLowerCase() === '.md'),
  ]
    .map((candidate) => {
      const raw = fs.readFileSync(candidate, 'utf8');
      return String(parseFrontMatter(splitDocument(raw).frontMatter).abbrlink || '');
    })
    .filter(Boolean));
  let abbrlink;
  do {
    abbrlink = crypto.randomBytes(2).toString('hex');
  } while (usedAbbrlinks.has(abbrlink));
  const workflow = requestedStatus === 'published' ? '' : requestedStatus;
  const frontMatter = patchFrontMatter('', { ...normalized, abbrlink, workflow }, newline);
  const content = `---${newline}${frontMatter}${newline}---${newline}${normalized.body}`;
  atomicWrite(path.join(targetDirectory, fileName), content);
  return getPost(fileId(`${requestedStatus === 'published' ? 'posts' : 'drafts'}/${fileName}`));
}

function statusWorkflow(status) {
  return status === 'published' ? '' : status === 'pending' ? 'pending' : 'draft';
}

function applyWorkflow(raw, status) {
  const { frontMatter, body, newline } = splitDocument(raw);
  const updated = patchFrontMatter(frontMatter, { workflow: statusWorkflow(status) }, newline);
  return `---${newline}${updated}${newline}---${newline}${body.replace(/^\r?\n/, '')}`;
}

function transitionPost(id, input) {
  const targetStatus = String(input.status || '');
  if (!['draft', 'pending', 'published'].includes(targetStatus)) {
    throw Object.assign(new Error('文章状态无效'), { statusCode: 400 });
  }
  const resolved = resolvePost(id);
  if (!fs.existsSync(resolved.filePath)) {
    throw Object.assign(new Error('文章不存在'), { statusCode: 404 });
  }
  const raw = fs.readFileSync(resolved.filePath, 'utf8');
  if (!input.originalHash || input.originalHash !== hash(raw)) {
    throw Object.assign(new Error('文章已发生变化，请重新载入后再切换状态'), { statusCode: 409 });
  }
  const currentStatus = resolved.statusRoot === 'posts'
    ? 'published'
    : String(parseFrontMatter(splitDocument(raw).frontMatter).workflow || '') === 'pending' ? 'pending' : 'draft';
  if (currentStatus === targetStatus) return getPost(id);

  const targetDirectory = targetStatus === 'published' ? POSTS_DIR : DRAFTS_DIR;
  const targetPath = assertInside(targetDirectory, path.join(targetDirectory, resolved.relativePath));
  if (targetPath !== resolved.filePath && fs.existsSync(targetPath)) {
    throw Object.assign(new Error('目标状态目录中存在同名文章，未执行移动'), { statusCode: 409 });
  }
  recordHistory(resolved.filePath, resolved.relativePath, raw, `status:${currentStatus}->${targetStatus}`);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  if (targetPath !== resolved.filePath) fs.renameSync(resolved.filePath, targetPath);
  atomicWrite(targetPath, applyWorkflow(raw, targetStatus));
  return getPost(fileId(`${targetStatus === 'published' ? 'posts' : 'drafts'}/${resolved.relativePath.replace(/\\/g, '/')}`));
}

function historyEntries(relativePath) {
  const directory = historyDirectory(relativePath);
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .reverse()
    .map((name) => {
      const entry = JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
      return {
        id: entry.id,
        createdAt: entry.createdAt,
        reason: entry.reason,
        hash: entry.hash,
        title: entry.title,
      };
    });
}

function listPostHistory(id) {
  const resolved = resolvePost(id);
  if (!fs.existsSync(resolved.filePath)) throw Object.assign(new Error('文章不存在'), { statusCode: 404 });
  return historyEntries(resolved.relativePath);
}

function getHistoryEntry(relativePath, versionId) {
  if (!/^[A-Za-z0-9T-]+$/.test(String(versionId || ''))) {
    throw Object.assign(new Error('历史版本标识无效'), { statusCode: 400 });
  }
  const filePath = assertInside(historyDirectory(relativePath), path.join(historyDirectory(relativePath), `${versionId}.json`));
  if (!fs.existsSync(filePath)) throw Object.assign(new Error('历史版本不存在'), { statusCode: 404 });
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function safeDocument(raw) {
  const { frontMatter, body } = splitDocument(raw);
  const data = parseFrontMatter(frontMatter);
  return [
    `标题：${String(data.title || '')}`,
    `日期：${String(data.date || '')}`,
    `分类：${asList(data.categories).join(' / ')}`,
    `标签：${asList(data.tags).join(' / ')}`,
    `摘要：${String(data.description || '')}`,
    `封面：${String(data.cover || '')}`,
    '',
    body,
  ].join('\n');
}

function compactDiff(oldText, newText) {
  const oldLines = oldText.split(/\r?\n/);
  const newLines = newText.split(/\r?\n/);
  let prefix = 0;
  while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < oldLines.length - prefix
    && suffix < newLines.length - prefix
    && oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]
  ) suffix += 1;
  const contextStart = Math.max(0, prefix - 3);
  const oldEnd = oldLines.length - suffix;
  const newEnd = newLines.length - suffix;
  return [
    ...oldLines.slice(contextStart, prefix).map((line, index) => ({ type: 'context', line, old: contextStart + index + 1, new: contextStart + index + 1 })),
    ...oldLines.slice(prefix, oldEnd).map((line, index) => ({ type: 'remove', line, old: prefix + index + 1, new: null })),
    ...newLines.slice(prefix, newEnd).map((line, index) => ({ type: 'add', line, old: null, new: prefix + index + 1 })),
    ...newLines.slice(newEnd, Math.min(newLines.length, newEnd + 3)).map((line, index) => ({
      type: 'context',
      line,
      old: oldEnd + index + 1,
      new: newEnd + index + 1,
    })),
  ].slice(0, 4000);
}

function diffPostHistory(id, versionId) {
  const resolved = resolvePost(id);
  const current = fs.readFileSync(resolved.filePath, 'utf8');
  const entry = getHistoryEntry(resolved.relativePath, versionId);
  return {
    version: {
      id: entry.id,
      createdAt: entry.createdAt,
      reason: entry.reason,
      title: entry.title,
    },
    lines: compactDiff(safeDocument(entry.raw), safeDocument(current)),
  };
}

function restorePostHistory(id, versionId, input) {
  const resolved = resolvePost(id);
  const current = fs.readFileSync(resolved.filePath, 'utf8');
  if (!input.originalHash || input.originalHash !== hash(current)) {
    throw Object.assign(new Error('文章已发生变化，请重新载入后再恢复'), { statusCode: 409 });
  }
  const entry = getHistoryEntry(resolved.relativePath, versionId);
  const currentData = parseFrontMatter(splitDocument(current).frontMatter);
  const currentStatus = resolved.statusRoot === 'posts'
    ? 'published'
    : String(currentData.workflow || '') === 'pending' ? 'pending' : 'draft';
  recordHistory(resolved.filePath, resolved.relativePath, current, `restore:${versionId}`);
  atomicWrite(resolved.filePath, applyWorkflow(entry.raw, currentStatus));
  return getPost(id);
}

function mediaUrl(relativePath) {
  return `/${relativePath.split(path.sep).map(encodeURIComponent).join('/')}`;
}

function readMediaMetadata() {
  if (!fs.existsSync(MEDIA_METADATA)) return {};
  try {
    const value = JSON.parse(fs.readFileSync(MEDIA_METADATA, 'utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function writeMediaMetadata(metadata) {
  fs.mkdirSync(path.dirname(MEDIA_METADATA), { recursive: true });
  atomicWrite(MEDIA_METADATA, `${JSON.stringify(metadata, null, 2)}\n`);
}

function listMedia() {
  const files = [];
  const metadata = readMediaMetadata();
  for (const directoryName of MEDIA_DIRECTORIES) {
    const directory = path.join(SOURCE_DIR, directoryName);
    for (const filePath of walk(directory, (candidate) => IMAGE_EXTENSIONS.has(path.extname(candidate).toLowerCase()))) {
      const relativePath = path.relative(SOURCE_DIR, filePath);
      const stat = fs.statSync(filePath);
      files.push({
        id: fileId(relativePath),
        name: path.basename(filePath),
        path: relativePath,
        url: mediaUrl(relativePath),
        bytes: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        alt: String(metadata[relativePath.replace(/\\/g, '/')]?.alt || ''),
        width: Number(metadata[relativePath.replace(/\\/g, '/')]?.width || 0),
        height: Number(metadata[relativePath.replace(/\\/g, '/')]?.height || 0),
        variant: String(metadata[relativePath.replace(/\\/g, '/')]?.variant || ''),
      });
    }
  }
  return files.sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt));
}

function resolveMedia(id) {
  const relativePath = decodeFileId(id);
  if (!relativePath || path.isAbsolute(relativePath) || !IMAGE_EXTENSIONS.has(path.extname(relativePath).toLowerCase())) {
    throw Object.assign(new Error('素材标识无效'), { statusCode: 400 });
  }
  const firstSegment = relativePath.split(/[\\/]/)[0];
  if (!MEDIA_DIRECTORIES.includes(firstSegment)) {
    throw Object.assign(new Error('素材不在允许的目录中'), { statusCode: 403 });
  }
  const filePath = assertInside(SOURCE_DIR, path.join(SOURCE_DIR, relativePath));
  if (!fs.existsSync(filePath)) throw Object.assign(new Error('素材不存在'), { statusCode: 404 });
  return filePath;
}

function hasImageSignature(buffer, type) {
  if (type === 'png') {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  }
  if (type === 'jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (type === 'gif') {
    const header = buffer.subarray(0, 6).toString('ascii');
    return header === 'GIF87a' || header === 'GIF89a';
  }
  if (type === 'webp') {
    return buffer.length >= 12
      && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
      && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
}

function uploadMedia(input) {
  const match = String(input.dataUrl || '').match(/^data:image\/(png|jpeg|gif|webp);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) throw Object.assign(new Error('仅支持 PNG、JPEG、GIF 或 WebP 图片'), { statusCode: 400 });
  const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
    throw Object.assign(new Error('图片不能为空且不能超过 8 MB'), { statusCode: 413 });
  }
  if (!hasImageSignature(buffer, match[1])) {
    throw Object.assign(new Error('图片内容与声明格式不一致'), { statusCode: 400 });
  }
  const extension = match[1] === 'jpeg' ? '.jpg' : `.${match[1]}`;
  const stem = safeSlug(path.basename(String(input.name || 'image'), path.extname(String(input.name || ''))));
  const now = new Date();
  const relativeDirectory = path.join('img', 'uploads', String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, '0'));
  const directory = path.join(SOURCE_DIR, relativeDirectory);
  fs.mkdirSync(directory, { recursive: true });
  let fileName = `${stem}${extension}`;
  let sequence = 2;
  while (fs.existsSync(path.join(directory, fileName))) {
    fileName = `${stem}-${sequence}${extension}`;
    sequence += 1;
  }
  fs.writeFileSync(path.join(directory, fileName), buffer);
  const relativePath = path.join(relativeDirectory, fileName);
  const metadata = readMediaMetadata();
  const metadataKey = relativePath.replace(/\\/g, '/');
  const alt = String(input.alt || '').trim();
  if (alt.length > 300 || /[\r\n]/.test(alt)) {
    fs.unlinkSync(path.join(directory, fileName));
    throw Object.assign(new Error('图片替代文本不能超过 300 字'), { statusCode: 400 });
  }
  metadata[metadataKey] = {
    alt,
    width: Number.isInteger(input.width) && input.width > 0 && input.width <= 10000 ? input.width : 0,
    height: Number.isInteger(input.height) && input.height > 0 && input.height <= 10000 ? input.height : 0,
    variant: ['wide', 'card', 'square', 'original'].includes(input.variant) ? input.variant : 'original',
    updatedAt: new Date().toISOString(),
  };
  writeMediaMetadata(metadata);
  return listMedia().find((item) => item.path === relativePath);
}

function updateMediaMetadata(id, input) {
  const filePath = resolveMedia(id);
  const relativePath = path.relative(SOURCE_DIR, filePath).replace(/\\/g, '/');
  const alt = String(input.alt || '').trim();
  if (alt.length > 300 || /[\r\n]/.test(alt)) {
    throw Object.assign(new Error('图片替代文本不能超过 300 字'), { statusCode: 400 });
  }
  const metadata = readMediaMetadata();
  metadata[relativePath] = {
    ...(metadata[relativePath] || {}),
    alt,
    updatedAt: new Date().toISOString(),
  };
  writeMediaMetadata(metadata);
  return listMedia().find((item) => item.path.replace(/\\/g, '/') === relativePath);
}

function findTopLevelScalar(text, key) {
  const match = text.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'));
  return match ? String(parseScalar(match[1])) : '';
}

function findNestedScalar(text, section, key) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line === `${section}:`);
  if (start < 0) return '';
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^[^\s#][^:]*:/.test(lines[index])) break;
    const match = lines[index].match(new RegExp(`^\\s{2}${key}:\\s*(.*)$`));
    if (match) return String(parseScalar(match[1]));
  }
  return '';
}

function findNestedList(text, section, key) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line === `${section}:`);
  if (start < 0) return [];
  let active = false;
  const values = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^[^\s#][^:]*:/.test(lines[index])) break;
    if (new RegExp(`^\\s{2}${key}:\\s*$`).test(lines[index])) {
      active = true;
      continue;
    }
    if (active) {
      const item = lines[index].match(/^\s{4}-\s*(.*)$/);
      if (!item) break;
      values.push(String(parseScalar(item[1])));
    }
  }
  return values;
}

function getVisuals() {
  const raw = fs.readFileSync(THEME_CONFIG, 'utf8');
  return {
    hash: hash(raw),
    indexImg: findTopLevelScalar(raw, 'index_img'),
    defaultTopImg: findTopLevelScalar(raw, 'default_top_img'),
    avatar: findNestedScalar(raw, 'avatar', 'img'),
    defaultCover: findNestedList(raw, 'cover', 'default_cover'),
  };
}

function replaceTopLevelScalar(text, key, value, newline) {
  const replacement = `${key}: ${quoteYaml(value)}`;
  const pattern = new RegExp(`^${key}:.*$`, 'm');
  return pattern.test(text) ? text.replace(pattern, replacement) : `${text.trimEnd()}${newline}${replacement}${newline}`;
}

function replaceNestedField(text, section, key, replacementLines, newline) {
  const lines = text.split(/\r?\n/);
  let sectionStart = lines.findIndex((line) => line === `${section}:`);
  if (sectionStart < 0) {
    if (lines.at(-1) !== '') lines.push('');
    sectionStart = lines.length;
    lines.push(`${section}:`);
  }
  let sectionEnd = sectionStart + 1;
  while (sectionEnd < lines.length && !/^[^\s#][^:]*:/.test(lines[sectionEnd])) sectionEnd += 1;
  const fieldStart = lines.findIndex((line, index) => (
    index > sectionStart
    && index < sectionEnd
    && new RegExp(`^\\s{2}${key}:`).test(line)
  ));
  if (fieldStart < 0) {
    lines.splice(sectionEnd, 0, ...replacementLines);
  } else {
    let fieldEnd = fieldStart + 1;
    while (fieldEnd < sectionEnd && !/^\s{2}[A-Za-z0-9_-]+:/.test(lines[fieldEnd])) fieldEnd += 1;
    lines.splice(fieldStart, fieldEnd - fieldStart, ...replacementLines);
  }
  return lines.join(newline);
}

function validateVisual(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.length > 500 || /[\r\n]/.test(normalized)) {
    throw Object.assign(new Error(`${label}不能为空且不能超过 500 字符`), { statusCode: 400 });
  }
  if (!normalized.startsWith('/img/')
    && !normalized.startsWith('/picture/')
    && !/^https?:\/\//.test(normalized)
    && !/^(linear|radial)-gradient\(/.test(normalized)) {
    throw Object.assign(new Error(`${label}必须是站内图片、HTTP(S) 地址或 CSS 渐变`), { statusCode: 400 });
  }
  return normalized;
}

function saveVisuals(input) {
  const raw = fs.readFileSync(THEME_CONFIG, 'utf8');
  if (!input.originalHash || input.originalHash !== hash(raw)) {
    throw Object.assign(new Error('主题配置已发生变化，请重新载入后再保存'), { statusCode: 409 });
  }
  const values = {
    indexImg: validateVisual(input.indexImg, '首页背景'),
    defaultTopImg: validateVisual(input.defaultTopImg, '页面顶部背景'),
    avatar: validateVisual(input.avatar, '头像'),
    defaultCover: asList(input.defaultCover).map((value) => validateVisual(value, '默认封面')),
  };
  if (values.defaultCover.length === 0) throw Object.assign(new Error('至少需要一张默认封面'), { statusCode: 400 });

  const newline = raw.includes('\r\n') ? '\r\n' : '\n';
  let updated = replaceTopLevelScalar(raw, 'index_img', values.indexImg, newline);
  updated = replaceTopLevelScalar(updated, 'default_top_img', values.defaultTopImg, newline);
  updated = replaceNestedField(updated, 'avatar', 'img', [`  img: ${quoteYaml(values.avatar)}`], newline);
  updated = replaceNestedField(
    updated,
    'cover',
    'default_cover',
    ['  default_cover:', ...values.defaultCover.map((value) => `    - ${quoteYaml(value)}`)],
    newline,
  );

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(THEME_CONFIG, path.join(BACKUP_DIR, `_config.butterfly.${stamp}.yml`));
  atomicWrite(THEME_CONFIG, updated);
  return getVisuals();
}

function getContentHealth() {
  const posts = listPosts();
  const tagCounts = new Map();
  const titleGroups = new Map();
  for (const post of posts) {
    for (const tag of post.tags) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    const normalizedTitle = post.title.replace(/[《》“”"'·\s]/g, '').toLocaleLowerCase('zh-CN');
    if (normalizedTitle) {
      if (!titleGroups.has(normalizedTitle)) titleGroups.set(normalizedTitle, []);
      titleGroups.get(normalizedTitle).push(post);
    }
  }

  const issues = [];
  const add = (post, type, severity, message) => issues.push({
    id: `${type}:${post.id}`,
    postId: post.id,
    title: post.title,
    status: post.status,
    type,
    severity,
    message,
  });
  for (const post of posts) {
    if (!post.description) add(post, 'missing-description', post.status === 'published' ? 'warning' : 'info', '缺少文章摘要');
    if (!post.cover) add(post, 'missing-cover', 'info', '缺少独立封面');
    const singletonTags = post.tags.filter((tag) => tagCounts.get(tag) === 1);
    if (singletonTags.length) add(post, 'singleton-tag', 'info', `仅使用一次的标签：${singletonTags.join('、')}`);
    const fullPost = getPost(post.id);
    if (/http:\/\/[^\s)"']+/i.test(fullPost.body) || /^http:\/\//i.test(post.cover)) {
      add(post, 'insecure-link', 'warning', '包含 HTTP 外链，建议确认 HTTPS 可用性');
    }
  }
  for (const group of titleGroups.values()) {
    if (group.length < 2) continue;
    for (const post of group) add(post, 'similar-title', 'warning', `存在 ${group.length} 篇高度相似标题文章`);
  }
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      total: posts.length,
      published: posts.filter((post) => post.status === 'published').length,
      pending: posts.filter((post) => post.status === 'pending').length,
      drafts: posts.filter((post) => post.status === 'draft').length,
      issues: issues.length,
      warnings: issues.filter((issue) => issue.severity === 'warning').length,
    },
    issues,
  };
}

module.exports = {
  MAX_IMAGE_BYTES,
  createPost,
  diffPostHistory,
  getContentHealth,
  getPost,
  getVisuals,
  listPostHistory,
  listMedia,
  listPosts,
  resolveMedia,
  restorePostHistory,
  savePost,
  saveVisuals,
  transitionPost,
  updateMediaMetadata,
  uploadMedia,
  __test: {
    applyWorkflow,
    hasImageSignature,
    parseFrontMatter,
    patchFrontMatter,
    splitDocument,
  },
};
