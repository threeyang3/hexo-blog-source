'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function currentCommit() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: hexo.base_dir,
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

hexo.extend.filter.register('after_generate', () => {
  const output = {
    commit: currentCommit(),
    builtAt: new Date().toISOString(),
    generator: `Hexo ${hexo.version}`,
  };
  const target = path.join(hexo.public_dir, 'build-info.json');
  fs.mkdirSync(hexo.public_dir, { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
});
