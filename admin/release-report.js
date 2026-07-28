'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { listPosts } = require('./content-store');

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, '..');
async function git(args) {
  const { stdout } = await execFileAsync('git', args, {
    cwd: ROOT,
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
    encoding: 'utf8',
  });
  return stdout;
}

function normalizeGitPath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^"|"$/g, '');
}

function classify(filePath) {
  if (/^source\/_(posts|drafts)\//.test(filePath)) return 'content';
  if (/^source\/(img|picture)\//.test(filePath)) return 'media';
  if (filePath === '_config.yml' || filePath === '_config.butterfly.yml' || filePath === 'source/CNAME') return 'protected';
  return 'infrastructure';
}

function readableBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function fileBytes(filePath) {
  const absolute = path.join(ROOT, filePath);
  return fs.existsSync(absolute) && fs.statSync(absolute).isFile() ? fs.statSync(absolute).size : null;
}

async function getReleaseReport() {
  const raw = await git(['status', '--porcelain=v1', '--no-renames', '-z', '--untracked-files=all']);
  const entries = raw.split('\0').filter(Boolean).map((entry) => {
    const code = entry.slice(0, 2).trim() || 'M';
    const filePath = normalizeGitPath(entry.slice(3));
    const bytes = fileBytes(filePath);
    return {
      code,
      path: filePath,
      kind: classify(filePath),
      bytes,
      size: bytes === null ? null : readableBytes(bytes),
    };
  });

  const posts = listPosts();
  const content = entries.filter((entry) => entry.kind === 'content').map((entry) => {
    const relative = entry.path.replace(/^source\/_(?:posts|drafts)\//, '');
    const post = posts.find((candidate) => normalizeGitPath(candidate.fileName) === relative);
    return {
      ...entry,
      title: post?.title || path.basename(relative, '.md'),
      status: post?.status || (entry.code.includes('D') ? 'deleted' : 'unknown'),
      url: post?.abbrlink && post.status === 'published' ? `/posts/${post.abbrlink}/` : null,
    };
  });

  let remote = '';
  try {
    remote = (await git(['remote', 'get-url', 'origin'])).trim();
  } catch {
    remote = '';
  }
  const protectedChanges = entries.filter((entry) => entry.kind === 'protected');
  const payload = {
    remoteConfigured: Boolean(remote),
    remote,
    content,
    media: entries.filter((entry) => entry.kind === 'media'),
    protectedChanges,
    infrastructure: entries.filter((entry) => entry.kind === 'infrastructure'),
    totals: {
      changes: entries.length,
      content: content.length,
      media: entries.filter((entry) => entry.kind === 'media').length,
      protected: protectedChanges.length,
    },
  };
  const reportHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  return {
    generatedAt: new Date().toISOString(),
    reportHash,
    ...payload,
  };
}

module.exports = { getReleaseReport };
