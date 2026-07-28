'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { SECRET_KEY_PATTERN } = require('../scripts/encryption-secrets');

const ROOT = path.resolve(__dirname, '..');
const EXCLUDED_DIRECTORIES = new Set([
  '.git',
  '.blog-admin',
  '.deploy_git',
  'node_modules',
  'output',
  'public',
]);
const TEXT_EXTENSIONS = new Set([
  '.bat', '.css', '.html', '.js', '.json', '.md', '.txt', '.xml', '.yaml', '.yml',
]);
const secretPatterns = [
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['GitHub classic token', /\bghp_[A-Za-z0-9]{36,}\b/],
  ['GitHub fine-grained token', /\bgithub_pat_[A-Za-z0-9_]{50,}\b/],
  ['AWS access key', /\bAKIA[A-Z0-9]{16}\b/],
];
const errors = [];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) return [];
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
      ? [fullPath]
      : [];
  });
}

for (const filePath of walk(ROOT)) {
  const relativePath = path.relative(ROOT, filePath).replace(/\\/g, '/');
  const text = fs.readFileSync(filePath, 'utf8');
  if (/^password\s*:/m.test(text) && /^source\/_(?:posts|drafts)\//.test(relativePath)) {
    errors.push(`${relativePath}: plaintext password Front Matter is forbidden`);
  }
  for (const [label, pattern] of secretPatterns) {
    if (pattern.test(text)) errors.push(`${relativePath}: possible ${label}`);
  }
  for (const match of text.matchAll(/^password_secret\s*:\s*(\S+)\s*$/gm)) {
    if (!SECRET_KEY_PATTERN.test(match[1])) {
      errors.push(`${relativePath}: invalid password_secret reference`);
    }
  }
}

if (errors.length) {
  for (const error of errors) console.error(`ERROR ${error}`);
  process.exitCode = 1;
} else {
  console.log('Verified public-source privacy: no plaintext post passwords or common credential patterns.');
}
