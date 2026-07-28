'use strict';

const assert = require('node:assert/strict');
const { once } = require('node:events');
const net = require('node:net');
const { actionDefinitions, createServer, TOKEN } = require('../admin/server');
const { __test: contentHelpers } = require('../admin/content-store');
const { applyEncryptionSecret } = require('../scripts/encryption-secrets');

async function request(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  return { response, body: await response.json().catch(() => null) };
}

async function main() {
  const protectedFrontMatter = [
    'title: "旧标题"',
    'password: never-return-this-value',
    'categories: 随笔',
    'tags:',
    '  - 原标签',
    "abbrlink: '1234'",
  ].join('\n');
  const patchedFrontMatter = contentHelpers.patchFrontMatter(protectedFrontMatter, {
    title: '新标题',
    date: '2026-07-27 18:00:00',
    categories: ['读书笔记'],
    tags: ['文学', '思考'],
    cover: '/img/cover.webp',
    description: '摘要',
    body: '正文',
  }, '\n');
  const parsedFrontMatter = contentHelpers.parseFrontMatter(patchedFrontMatter);
  assert.equal(parsedFrontMatter.title, '新标题');
  assert.deepEqual(parsedFrontMatter.tags, ['文学', '思考']);
  assert.equal(parsedFrontMatter.password, 'never-return-this-value');
  assert.equal(parsedFrontMatter.abbrlink, '1234');
  const draftDocument = contentHelpers.applyWorkflow(`---\ntitle: "测试"\npassword: secret\n---\n正文`, 'pending');
  const draftParts = contentHelpers.splitDocument(draftDocument);
  assert.equal(contentHelpers.parseFrontMatter(draftParts.frontMatter).workflow, 'pending');
  assert.equal(contentHelpers.parseFrontMatter(draftParts.frontMatter).password, 'secret');
  assert.equal(contentHelpers.hasImageSignature(Buffer.from('not-an-image'), 'png'), false);
  assert.equal(
    contentHelpers.hasImageSignature(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      'png',
    ),
    true,
  );
  const encryptedData = applyEncryptionSecret(
    { password_secret: 'BLOG_ENCRYPTION_TEST' },
    process.cwd(),
    { BLOG_ENCRYPTION_TEST: 'in-memory-test-secret' },
  );
  assert.equal(encryptedData.password, 'in-memory-test-secret');
  assert.equal(Object.hasOwn(encryptedData, 'password_secret'), false);
  assert.throws(
    () => applyEncryptionSecret(
      { password_secret: 'BLOG_ENCRYPTION_MISSING' },
      process.cwd(),
      {},
    ),
    /缺少加密密码/,
  );
  const placeholderData = applyEncryptionSecret(
    { password_secret: 'BLOG_ENCRYPTION_PR_TEST' },
    process.cwd(),
    { BLOG_ALLOW_PLACEHOLDER_ENCRYPTION: 'true' },
  );
  assert.match(placeholderData.password, /^CI-PLACEHOLDER-NOT-FOR-PRODUCTION-/);

  if (process.env.npm_execpath) {
    assert.equal(actionDefinitions.check.command, process.execPath);
    assert.equal(actionDefinitions.check.args[0], process.env.npm_execpath);
  }

  const sourceStatus = {
    branch: 'main',
    origin: 'https://github.com/threeyang3/hexo-blog-source.git',
    originMatches: true,
    head: 'a'.repeat(40),
    shortHead: 'aaaaaaa',
    remoteHead: 'a'.repeat(40),
    ahead: 0,
    behind: 0,
    clean: true,
    changes: [],
    managedChanges: [],
    blockedChanges: [],
    ci: { state: 'success', label: 'success' },
    readyForDeploy: true,
    blockers: [],
  };
  const sourceControl = {
    getStatus: async () => sourceStatus,
    sync: async (body, onLog) => {
      assert.equal(body.confirmation, 'SYNC SOURCE');
      assert.deepEqual(body.paths, ['source/_posts/example.md']);
      onLog('system', 'mock source sync');
      return { committedHead: sourceStatus.head, status: sourceStatus };
    },
    pushPending: async () => ({ status: sourceStatus }),
    assertDeployReady: async () => sourceStatus,
  };
  const server = createServer({ sourceControl });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const home = await fetch(`${baseUrl}/`);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /Threeyang 内容工作台/);
    assert.equal(home.headers.get('x-frame-options'), 'DENY');

    const unauthorized = await request(baseUrl, '/api/status');
    assert.equal(unauthorized.response.status, 401);

    const status = await request(baseUrl, '/api/status', {
      headers: { 'X-Blog-Admin-Token': TOKEN },
    });
    assert.equal(status.response.status, 200);
    assert.equal(status.body.project.cname, 'threeyang.top');
    assert.equal(status.body.project.hexo, '8.1.2');
    assert.equal(typeof status.body.contentHealth.missingCover, 'number');
    assert.equal(typeof status.body.contentHealth.published, 'number');
    assert.equal(typeof status.body.contentHealth.drafts, 'number');
    assert.ok(Array.isArray(status.body.actions));
    assert.ok(status.body.actions.some((action) => action.id === 'deploy'));

    const source = await request(baseUrl, '/api/source-status?refresh=1', {
      headers: { 'X-Blog-Admin-Token': TOKEN },
    });
    assert.equal(source.response.status, 200);
    assert.equal(source.body.status.readyForDeploy, true);
    assert.equal(source.body.status.ci.state, 'success');

    const sourceSync = await request(baseUrl, '/api/source-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Blog-Admin-Token': TOKEN,
        Origin: baseUrl,
      },
      body: JSON.stringify({
        confirmation: 'SYNC SOURCE',
        message: 'content: example',
        paths: ['source/_posts/example.md'],
      }),
    });
    assert.equal(sourceSync.response.status, 200);
    assert.equal(sourceSync.body.committedHead, sourceStatus.head);

    const foreignSourceSync = await request(baseUrl, '/api/source-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Blog-Admin-Token': TOKEN,
        Origin: 'https://example.com',
      },
      body: '{}',
    });
    assert.equal(foreignSourceSync.response.status, 403);

    const posts = await request(baseUrl, '/api/posts', {
      headers: { 'X-Blog-Admin-Token': TOKEN },
    });
    assert.equal(posts.response.status, 200);
    assert.ok(posts.body.posts.length > 0);
    assert.ok(posts.body.posts[0].id);
    assert.equal(posts.body.posts.some((post) => Object.hasOwn(post, 'password')), false);

    const firstPost = await request(baseUrl, `/api/posts/${encodeURIComponent(posts.body.posts[0].id)}`, {
      headers: { 'X-Blog-Admin-Token': TOKEN },
    });
    assert.equal(firstPost.response.status, 200);
    assert.equal(typeof firstPost.body.post.body, 'string');
    assert.equal(typeof firstPost.body.post.hash, 'string');
    assert.ok(['draft', 'pending', 'published'].includes(firstPost.body.post.status));
    assert.equal(typeof firstPost.body.post.abbrlink, 'string');

    const history = await request(
      baseUrl,
      `/api/posts/${encodeURIComponent(posts.body.posts[0].id)}/history`,
      { headers: { 'X-Blog-Admin-Token': TOKEN } },
    );
    assert.equal(history.response.status, 200);
    assert.ok(Array.isArray(history.body.history));

    const health = await request(baseUrl, '/api/health', {
      headers: { 'X-Blog-Admin-Token': TOKEN },
    });
    assert.equal(health.response.status, 200);
    assert.equal(health.body.health.summary.total, posts.body.posts.length);
    assert.ok(Array.isArray(health.body.health.issues));

    const release = await request(baseUrl, '/api/release-report', {
      headers: { 'X-Blog-Admin-Token': TOKEN },
    });
    assert.equal(release.response.status, 200);
    assert.equal(typeof release.body.report.reportHash, 'string');
    assert.equal(typeof release.body.report.remoteConfigured, 'boolean');

    const conflictingSave = await request(baseUrl, `/api/posts/${encodeURIComponent(posts.body.posts[0].id)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Blog-Admin-Token': TOKEN,
        Origin: baseUrl,
      },
      body: JSON.stringify({
        ...firstPost.body.post.fields,
        body: firstPost.body.post.body,
        originalHash: 'not-the-current-hash',
      }),
    });
    assert.equal(conflictingSave.response.status, 409);

    const conflictingTransition = await request(
      baseUrl,
      `/api/posts/${encodeURIComponent(posts.body.posts[0].id)}/status`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Blog-Admin-Token': TOKEN,
          Origin: baseUrl,
        },
        body: JSON.stringify({ status: 'draft', originalHash: 'not-the-current-hash' }),
      },
    );
    assert.equal(conflictingTransition.response.status, 409);

    const media = await request(baseUrl, '/api/media', {
      headers: { 'X-Blog-Admin-Token': TOKEN },
    });
    assert.equal(media.response.status, 200);
    assert.ok(media.body.media.length > 0);
    const mediaFile = await fetch(
      `${baseUrl}/api/media/file/${encodeURIComponent(media.body.media[0].id)}?token=${TOKEN}`,
    );
    assert.equal(mediaFile.status, 200);
    assert.match(mediaFile.headers.get('content-type'), /^image\//);

    const visuals = await request(baseUrl, '/api/visuals', {
      headers: { 'X-Blog-Admin-Token': TOKEN },
    });
    assert.equal(visuals.response.status, 200);
    assert.equal(typeof visuals.body.visuals.hash, 'string');
    assert.ok(visuals.body.visuals.indexImg);

    const unconfirmedVisualSave = await request(baseUrl, '/api/visuals', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Blog-Admin-Token': TOKEN,
        Origin: baseUrl,
      },
      body: JSON.stringify({ confirmation: 'SAVE' }),
    });
    assert.equal(unconfirmedVisualSave.response.status, 400);

    const traversal = await fetch(`${baseUrl}/..%2fpackage.json`);
    assert.equal(traversal.status, 403);

    const wrongDeploy = await request(baseUrl, '/api/actions/deploy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Blog-Admin-Token': TOKEN,
        Origin: baseUrl,
      },
      body: JSON.stringify({ confirmation: 'DEPLOY' }),
    });
    assert.equal(wrongDeploy.response.status, 400);

    const foreignOrigin = await request(baseUrl, '/api/preview/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Blog-Admin-Token': TOKEN,
        Origin: 'https://example.com',
      },
      body: '{}',
    });
    assert.equal(foreignOrigin.response.status, 403);

    const portBlocker = net.createServer();
    let blockerListening = false;
    let previewPortUnavailable = false;
    try {
      await new Promise((resolve, reject) => {
        portBlocker.once('error', (error) => {
          if (error.code === 'EADDRINUSE' || error.code === 'EACCES') {
            previewPortUnavailable = true;
            resolve();
          }
          else reject(error);
        });
        portBlocker.listen(5000, '127.0.0.1', () => {
          blockerListening = true;
          resolve();
        });
      });
      if (blockerListening || !previewPortUnavailable) {
        const occupiedPreview = await request(baseUrl, '/api/preview/start', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Blog-Admin-Token': TOKEN,
            Origin: baseUrl,
          },
          body: '{}',
        });
        assert.equal(occupiedPreview.response.status, 409);
        assert.match(occupiedPreview.body.error, /5000 端口已被其他程序占用/);
      }
    } finally {
      if (blockerListening) {
        portBlocker.close();
        await once(portBlocker, 'close');
      }
    }

    console.log('Blog Control Room API tests passed.');
  } finally {
    server.close();
    await once(server, 'close');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
