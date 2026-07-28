'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SECRET_KEY_PATTERN = /^BLOG_ENCRYPTION_[A-Z0-9_]+$/;

function readLocalSecrets(baseDir) {
  const filePath = path.join(baseDir, '.blog-admin', 'secrets.json');
  if (!fs.existsSync(filePath)) return {};
  const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('.blog-admin/secrets.json 必须是 JSON 对象');
  }
  return value;
}

function resolveEncryptionSecret(key, baseDir, env = process.env) {
  if (!SECRET_KEY_PATTERN.test(key)) {
    throw new Error(`加密密码引用名称无效：${key}`);
  }
  const environmentValue = String(env[key] || '');
  if (environmentValue) return environmentValue;

  const localValue = String(readLocalSecrets(baseDir)[key] || '');
  if (localValue) return localValue;

  if (String(env.BLOG_ALLOW_PLACEHOLDER_ENCRYPTION || '').toLowerCase() === 'true') {
    return `CI-PLACEHOLDER-NOT-FOR-PRODUCTION-${key}`;
  }
  throw new Error(
    `缺少加密密码 ${key}；请配置 .blog-admin/secrets.json 或同名环境变量`,
  );
}

function applyEncryptionSecret(data, baseDir, env = process.env) {
  const key = String(data.password_secret || '').trim();
  if (!key) return data;
  data.password = resolveEncryptionSecret(key, baseDir, env);
  delete data.password_secret;
  return data;
}

if (typeof hexo !== 'undefined') {
  hexo.extend.filter.register('before_post_render', (data) => (
    applyEncryptionSecret(data, hexo.base_dir)
  ));
}

module.exports = {
  SECRET_KEY_PATTERN,
  applyEncryptionSecret,
  resolveEncryptionSecret,
};
