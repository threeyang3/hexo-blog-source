'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const {
  SOURCE_CONFIRMATION,
  createSourceControl,
  isManagedPath,
  parsePorcelain,
  validateCommitMessage,
  validateManagedPath,
} = require('../admin/source-control');

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true }).trim();
}

async function main() {
  assert.equal(isManagedPath('source/_posts/test.md'), true);
  assert.equal(isManagedPath('source/img/cover.webp'), true);
  assert.equal(isManagedPath('_config.butterfly.yml'), true);
  assert.equal(isManagedPath('_config.yml'), false);
  assert.throws(() => validateManagedPath('../outside.md'), /不安全/);
  assert.throws(() => validateManagedPath('source/_posts/bad\nname.md'), /不允许/);
  assert.throws(() => validateManagedPath('package.json'), /不允许/);
  assert.throws(() => validateCommitMessage('bad'), /5–100/);
  assert.deepEqual(parsePorcelain(' M source/_posts/a.md\0?? package.json\0'), [
    { code: ' M', path: 'source/_posts/a.md', managed: true, staged: false, unstaged: true },
    { code: '??', path: 'package.json', managed: false, staged: false, unstaged: true },
  ]);

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-source-control-'));
  const remote = path.join(tempRoot, 'remote.git');
  const work = path.join(tempRoot, 'work');
  fs.mkdirSync(work);
  try {
    git(tempRoot, ['init', '--bare', remote]);
    git(work, ['init', '-b', 'main']);
    git(work, ['config', 'user.name', 'Blog Control Room Test']);
    git(work, ['config', 'user.email', 'test@example.invalid']);
    fs.mkdirSync(path.join(work, 'source', '_posts'), { recursive: true });
    fs.writeFileSync(path.join(work, 'source', '_posts', 'seed.md'), 'seed\n');
    fs.writeFileSync(path.join(work, 'package.json'), '{"private":true}\n');
    git(work, ['add', 'source/_posts/seed.md', 'package.json']);
    git(work, ['commit', '-m', 'test: initial']);
    git(work, ['remote', 'add', 'origin', remote]);
    git(work, ['push', '-u', 'origin', 'main']);

    const control = createSourceControl({
      root: work,
      expectedOrigin: remote,
      runCheck: async (onLog) => onLog('system', 'isolated check passed'),
      ciResolver: async () => ({ state: 'success', label: 'success', url: null, updatedAt: null }),
    });
    fs.writeFileSync(path.join(work, 'source', '_posts', 'seed.md'), 'updated\n');
    fs.writeFileSync(path.join(work, 'source', '_posts', 'new.md'), 'new\n');
    fs.writeFileSync(path.join(work, 'package.json'), '{"private":true,"changed":true}\n');
    const before = await control.getStatus({ refreshRemote: true });
    assert.equal(before.managedChanges.length, 2);
    assert.equal(before.blockedChanges.length, 1);
    assert.equal(before.readyForDeploy, false);

    await assert.rejects(
      control.sync({
        confirmation: 'SYNC',
        message: 'content: update seed',
        paths: ['source/_posts/seed.md'],
      }),
      /确认短语/,
    );
    await assert.rejects(
      control.sync({
        confirmation: SOURCE_CONFIRMATION,
        message: 'content: update seed',
        paths: ['package.json'],
      }),
      /不允许/,
    );

    const result = await control.sync({
      confirmation: SOURCE_CONFIRMATION,
      message: 'content: update seed',
      paths: ['source/_posts/seed.md', 'source/_posts/new.md'],
    });
    assert.equal(result.status.ahead, 0);
    assert.deepEqual(
      git(work, ['show', '--format=', '--name-only', 'HEAD']).split(/\r?\n/).sort(),
      ['source/_posts/new.md', 'source/_posts/seed.md'],
    );
    assert.match(git(work, ['status', '--short']), /package\.json/);
    assert.equal(git(remote, ['show', 'main:source/_posts/seed.md']), 'updated');
    assert.equal(git(remote, ['show', 'main:source/_posts/new.md']), 'new');
    git(work, ['restore', 'package.json']);
    assert.equal((await control.assertDeployReady()).readyForDeploy, true);

    const wrongRemoteControl = createSourceControl({
      root: work,
      expectedOrigin: `${remote}-wrong`,
      runCheck: async () => {},
      ciResolver: async () => ({ state: 'success', label: 'success' }),
    });
    assert.equal((await wrongRemoteControl.getStatus()).originMatches, false);

    fs.writeFileSync(path.join(work, 'source', '_posts', 'seed.md'), 'pending push\n');
    git(work, ['add', 'source/_posts/seed.md']);
    git(work, ['commit', '-m', 'content: pending push']);
    const pending = await control.getStatus();
    assert.equal(pending.ahead, 1);
    const pushed = await control.pushPending({ confirmation: SOURCE_CONFIRMATION });
    assert.equal(pushed.status.ahead, 0);
  } finally {
    const resolved = path.resolve(tempRoot);
    if (resolved.startsWith(path.resolve(os.tmpdir()))) {
      fs.rmSync(resolved, { recursive: true, force: true });
    }
  }

  console.log('Source control safety tests passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
