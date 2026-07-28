'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { __test: contentHelpers } = require('../admin/content-store');

const root = path.resolve(__dirname, '..');
const postsDirectory = path.join(root, 'source', '_posts');
const draftsDirectory = path.join(root, 'source', '_drafts');
const errors = [];
const warnings = [];
const abbrlinks = new Map();
let missingCover = 0;
let missingDescription = 0;

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return entry.isFile() && entry.name.toLowerCase().endsWith('.md') ? [fullPath] : [];
  });
}

const contentFiles = [
  ...walk(postsDirectory).map((filePath) => ({ filePath, published: true })),
  ...walk(draftsDirectory).map((filePath) => ({ filePath, published: false })),
];

for (const { filePath, published } of contentFiles) {
  const relativePath = path.relative(root, filePath);
  const raw = fs.readFileSync(filePath, 'utf8');
  const { frontMatter } = contentHelpers.splitDocument(raw);
  if (!frontMatter) {
    errors.push(`${relativePath}: missing Front Matter`);
    continue;
  }
  const data = contentHelpers.parseFrontMatter(frontMatter);
  if (data.password !== undefined) {
    errors.push(`${relativePath}: plaintext password is forbidden; use password_secret`);
  }
  if (
    data.password_secret !== undefined
    && !/^BLOG_ENCRYPTION_[A-Z0-9_]+$/.test(String(data.password_secret))
  ) {
    errors.push(`${relativePath}: invalid password_secret reference`);
  }
  for (const field of ['title', 'date', 'categories', 'tags', 'abbrlink']) {
    if (data[field] === undefined || data[field] === '') errors.push(`${relativePath}: missing ${field}`);
  }
  const abbrlink = String(data.abbrlink || '');
  if (abbrlink) {
    if (abbrlinks.has(abbrlink)) errors.push(`${relativePath}: duplicate abbrlink ${abbrlink} (also ${abbrlinks.get(abbrlink)})`);
    abbrlinks.set(abbrlink, relativePath);
  }
  if (published && !data.cover) missingCover += 1;
  if (published && !data.description) missingDescription += 1;
  if (String(data.cover || '').startsWith('/')) {
    const coverPath = path.join(root, 'source', String(data.cover).replace(/^\/+/, ''));
    if (!fs.existsSync(coverPath)) errors.push(`${relativePath}: local cover does not exist (${data.cover})`);
  }
}

for (const relativePath of ['source/_data/widget.yml', 'source/_data/link.yml']) {
  const text = fs.readFileSync(path.join(root, relativePath), 'utf8');
  if (text.includes('threeyang3.github.io')) errors.push(`${relativePath}: legacy GitHub Pages domain remains`);
  if (/^\s+(?:link|avatar):\s+http:\/\//m.test(text)) errors.push(`${relativePath}: insecure HTTP link remains`);
}

warnings.push(`${missingCover} posts do not yet have an explicit cover`);
warnings.push(`${missingDescription} posts do not yet have an explicit description`);
for (const warning of warnings) console.warn(`WARN  ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`ERROR ${error}`);
  process.exitCode = 1;
} else {
  const draftCount = contentFiles.filter((item) => !item.published).length;
  console.log(`Verified ${abbrlinks.size} content files (${draftCount} drafts): required Front Matter, unique abbrlinks, local covers, and managed links.`);
}
