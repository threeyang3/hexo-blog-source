'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

if (!process.env.BLOG_EDITORIAL_TEST_CHILD) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-editorial-'));
  try {
    for (const relative of ['source/_posts', 'source/_drafts', 'source/_data']) {
      fs.mkdirSync(path.join(directory, relative), { recursive: true });
    }
    fs.writeFileSync(path.join(directory, '_config.butterfly.yml'), 'index_img: /img/test.webp\n', 'utf8');
    const result = spawnSync(process.execPath, [__filename], {
      cwd: path.resolve(__dirname, '..'),
      env: {
        ...process.env,
        BLOG_ADMIN_ROOT: directory,
        BLOG_EDITORIAL_TEST_CHILD: '1',
      },
      encoding: 'utf8',
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.status !== 0) process.exitCode = result.status || 1;
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
} else {
  const store = require('../admin/content-store');

  const created = store.createPost({
    title: 'Editorial workflow test',
    date: '2026-07-27 20:00:00',
    categories: ['测试'],
    tags: ['工作流'],
    description: '初始摘要',
    cover: '',
    body: '第一版正文',
    status: 'draft',
  });
  assert.equal(created.status, 'draft');
  assert.match(created.id, /^[A-Za-z0-9_-]+$/);

  const saved = store.savePost(created.id, {
    ...created.fields,
    title: created.title,
    date: created.date,
    categories: created.categories,
    tags: created.tags,
    description: '第二版摘要',
    cover: '',
    body: '第二版正文',
    status: 'draft',
    originalHash: created.hash,
  });
  assert.equal(saved.body, '第二版正文');
  assert.equal(store.listPostHistory(saved.id).length, 1);

  const pending = store.transitionPost(saved.id, {
    status: 'pending',
    originalHash: saved.hash,
  });
  assert.equal(pending.status, 'pending');

  const published = store.transitionPost(pending.id, {
    status: 'published',
    originalHash: pending.hash,
  });
  assert.equal(published.status, 'published');
  assert.equal(store.listPosts().length, 1);

  const history = store.listPostHistory(published.id);
  const diff = store.diffPostHistory(published.id, history.at(-1).id);
  assert.ok(diff.lines.some((line) => line.type === 'add' || line.type === 'remove'));

  const restored = store.restorePostHistory(published.id, history.at(-1).id, {
    originalHash: published.hash,
  });
  assert.equal(restored.status, 'published');
  assert.equal(restored.body, '第一版正文');
  console.log('Editorial history, status transition, diff, and restore tests passed.');
}
