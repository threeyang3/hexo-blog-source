'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, '..');
const EXPECTED_BRANCH = 'main';
const EXPECTED_ORIGIN = 'https://github.com/threeyang3/hexo-blog-source.git';
const SOURCE_CONFIRMATION = 'SYNC SOURCE';
const CI_API = 'https://api.github.com/repos/threeyang3/hexo-blog-source/actions/runs?branch=main&per_page=30';
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;

function httpError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\/+/, '');
}

function isManagedPath(filePath) {
  const normalized = normalizePath(filePath);
  if (!normalized
    || path.posix.isAbsolute(normalized)
    || normalized.split('/').includes('..')
    || /[\u0000-\u001f\u007f]/.test(normalized)) {
    return false;
  }
  return normalized === '_config.butterfly.yml'
    || normalized === 'source/_data/media.json'
    || /^source\/_(posts|drafts)\/[^/].*/.test(normalized)
    || /^source\/(img|picture)\/[^/].*/.test(normalized);
}

function validateManagedPath(filePath) {
  const normalized = normalizePath(filePath);
  if (!normalized || path.posix.isAbsolute(normalized) || normalized.split('/').includes('..')) {
    throw httpError(`不安全的源码路径：${filePath}`);
  }
  if (!isManagedPath(normalized)) {
    throw httpError(`GUI 不允许提交此路径：${normalized}`);
  }
  return normalized;
}

function validateCommitMessage(message) {
  const value = String(message || '').trim();
  if (value.length < 5 || value.length > 100 || /[\r\n\u0000-\u001f\u007f]/.test(value)) {
    throw httpError('提交说明必须是 5–100 个字符的单行文本');
  }
  return value;
}

function parsePorcelain(raw) {
  return String(raw || '').split('\0').filter(Boolean).map((entry) => {
    const code = entry.slice(0, 2);
    const filePath = normalizePath(entry.slice(3));
    return {
      code,
      path: filePath,
      managed: isManagedPath(filePath),
      staged: code[0] !== ' ' && code[0] !== '?',
      unstaged: code[1] !== ' ',
    };
  });
}

async function defaultCiResolver(headSha) {
  const response = await fetch(CI_API, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'threeyang-blog-control-room',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    throw new Error(`GitHub Actions API 返回 ${response.status}`);
  }
  const payload = await response.json();
  const run = (payload.workflow_runs || []).find(
    (candidate) => candidate.head_sha === headSha && candidate.name === 'Validate Hexo site',
  );
  if (!run) {
    return { state: 'missing', label: '尚未找到当前提交的 CI', url: null, updatedAt: null };
  }
  const state = run.status === 'completed'
    ? (run.conclusion === 'success' ? 'success' : 'failure')
    : 'pending';
  return {
    state,
    label: run.status === 'completed' ? (run.conclusion || 'completed') : run.status,
    url: run.html_url,
    updatedAt: run.updated_at,
    runId: run.id,
  };
}

function npmInvocation(args) {
  const npmCli = process.env.npm_execpath;
  if (npmCli && fs.existsSync(npmCli)) {
    return { command: process.execPath, args: [npmCli, ...args] };
  }
  return { command: process.platform === 'win32' ? 'npm.cmd' : 'npm', args };
}

function runStreaming(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || ROOT,
      env: { ...process.env, FORCE_COLOR: '0' },
      shell: false,
      windowsHide: true,
    });
    let outputSize = 0;
    const consume = (stream, chunk) => {
      outputSize += chunk.length;
      if (outputSize > MAX_OUTPUT_BYTES) {
        child.kill();
        reject(httpError('命令输出过大，操作已停止', 500));
        return;
      }
      options.onLog?.(stream, chunk.toString('utf8'));
    };
    child.stdout.on('data', (chunk) => consume('stdout', chunk));
    child.stderr.on('data', (chunk) => consume('stderr', chunk));
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (code === 0) resolve();
      else reject(httpError(`命令执行失败（退出码 ${code ?? '未知'}${signal ? `，信号 ${signal}` : ''}）`, 500));
    });
  });
}

function createSourceControl(options = {}) {
  const root = path.resolve(options.root || ROOT);
  const expectedOrigin = options.expectedOrigin || EXPECTED_ORIGIN;
  const expectedBranch = options.expectedBranch || EXPECTED_BRANCH;
  const ciResolver = options.ciResolver || defaultCiResolver;
  const runCheck = options.runCheck || (async (onLog) => {
    const invocation = npmInvocation(['run', 'check']);
    await runStreaming(invocation.command, invocation.args, { cwd: root, onLog });
  });

  async function git(args) {
    const { stdout } = await execFileAsync('git', args, {
      cwd: root,
      windowsHide: true,
      maxBuffer: MAX_OUTPUT_BYTES,
      encoding: 'utf8',
      timeout: 120000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
    return stdout;
  }

  async function getStatus({ refreshRemote = false, includeCi = true } = {}) {
    const [branchRaw, originRaw, headRaw, changesRaw] = await Promise.all([
      git(['branch', '--show-current']),
      git(['remote', 'get-url', 'origin']).catch(() => ''),
      git(['rev-parse', 'HEAD']),
      git(['status', '--porcelain=v1', '--no-renames', '-z', '--untracked-files=all']),
    ]);
    const branch = branchRaw.trim();
    const origin = originRaw.trim();
    const head = headRaw.trim();
    const originMatches = origin === expectedOrigin;

    let remoteError = null;
    if (refreshRemote && originMatches && branch === expectedBranch) {
      try {
        await git(['fetch', '--quiet', 'origin', expectedBranch]);
      } catch (error) {
        remoteError = `无法刷新源码远端：${error.message}`;
      }
    }

    let remoteHead = null;
    let ahead = null;
    let behind = null;
    if (originMatches) {
      try {
        remoteHead = (await git(['rev-parse', `refs/remotes/origin/${expectedBranch}`])).trim();
        const counts = (await git(['rev-list', '--left-right', '--count', `HEAD...origin/${expectedBranch}`]))
          .trim().split(/\s+/).map(Number);
        [ahead, behind] = counts;
      } catch (error) {
        remoteError ||= `无法读取源码远端状态：${error.message}`;
      }
    }

    const changes = parsePorcelain(changesRaw);
    let ci = { state: 'unavailable', label: 'CI 状态不可用', url: null, updatedAt: null };
    if (includeCi && head) {
      try {
        ci = await ciResolver(head);
      } catch (error) {
        ci = { state: 'unavailable', label: error.message, url: null, updatedAt: null };
      }
    }

    const blockers = [];
    if (origin !== expectedOrigin) blockers.push('源码 origin 与受信任仓库不一致');
    if (branch !== expectedBranch) blockers.push(`当前分支不是 ${expectedBranch}`);
    if (changes.length > 0) blockers.push('工作区仍有未提交变化');
    if (remoteError) blockers.push(remoteError);
    if (ahead === null || behind === null) blockers.push('无法确认本地与远端是否同步');
    else {
      if (ahead > 0) blockers.push(`有 ${ahead} 个本地提交尚未推送`);
      if (behind > 0) blockers.push(`本地落后远端 ${behind} 个提交`);
    }
    if (remoteHead && remoteHead !== head) blockers.push('远端源码提交与当前 HEAD 不一致');
    if (includeCi && ci.state !== 'success') blockers.push(`当前提交的 CI 未通过：${ci.label}`);

    return {
      expectedOrigin,
      expectedBranch,
      confirmation: SOURCE_CONFIRMATION,
      branch,
      origin,
      originMatches,
      head,
      shortHead: head.slice(0, 7),
      remoteHead,
      ahead,
      behind,
      clean: changes.length === 0,
      changes,
      managedChanges: changes.filter((entry) => entry.managed),
      blockedChanges: changes.filter((entry) => !entry.managed),
      ci,
      readyForDeploy: blockers.length === 0,
      blockers,
      checkedAt: new Date().toISOString(),
    };
  }

  function assertConfirmation(body) {
    if (body?.confirmation !== SOURCE_CONFIRMATION) {
      throw httpError(`源码同步确认短语不正确，请输入：${SOURCE_CONFIRMATION}`);
    }
  }

  async function assertSyncBase(status) {
    if (!status.originMatches) throw httpError('源码 origin 与受信任仓库不一致，已停止操作', 409);
    if (status.branch !== expectedBranch) throw httpError(`只能从 ${expectedBranch} 分支同步源码`, 409);
    if (status.behind === null) throw httpError('无法确认远端状态，已停止操作', 503);
    if (status.behind > 0) throw httpError(`本地落后远端 ${status.behind} 个提交，请先人工合并`, 409);
    if (status.ahead > 0) throw httpError('已有本地提交尚未推送，请使用“继续推送”', 409);
  }

  async function sync(body, onLog = () => {}) {
    assertConfirmation(body);
    const message = validateCommitMessage(body.message);
    const requested = [...new Set((Array.isArray(body.paths) ? body.paths : []).map(validateManagedPath))];
    if (requested.length === 0) throw httpError('请至少选择一个可提交文件');

    onLog('system', '刷新并核对受信任的源码仓库…');
    const before = await getStatus({ refreshRemote: true, includeCi: false });
    await assertSyncBase(before);
    const eligible = new Set(before.managedChanges.map((entry) => entry.path));
    for (const filePath of requested) {
      if (!eligible.has(filePath)) throw httpError(`文件已变化或不在可提交清单中：${filePath}`, 409);
    }

    onLog('system', '运行完整检查；通过后才会创建源码提交…');
    await runCheck((stream, messageChunk) => onLog(stream, messageChunk));
    await git(['add', '--', ...requested]);
    await git(['diff', '--cached', '--check', '--', ...requested]);
    onLog('system', `创建受限源码提交：${message}`);
    await git(['commit', '--only', '-m', message, '--', ...requested]);
    const committedHead = (await git(['rev-parse', 'HEAD'])).trim();
    onLog('system', `推送源码 ${committedHead.slice(0, 7)} 到 origin/${expectedBranch}…`);
    await git(['push', 'origin', expectedBranch]);
    const after = await getStatus({ refreshRemote: true, includeCi: true });
    return { committedHead, status: after };
  }

  async function pushPending(body, onLog = () => {}) {
    assertConfirmation(body);
    const before = await getStatus({ refreshRemote: true, includeCi: false });
    if (!before.originMatches || before.branch !== expectedBranch) {
      throw httpError('当前源码仓库或分支不受信任，已停止推送', 409);
    }
    if (before.behind === null || before.behind > 0) {
      throw httpError('无法安全快进推送：本地落后远端或远端状态不可用', 409);
    }
    if (!before.ahead) throw httpError('没有待推送的本地源码提交', 409);
    onLog('system', `继续推送 ${before.ahead} 个本地源码提交…`);
    await git(['push', 'origin', expectedBranch]);
    return { status: await getStatus({ refreshRemote: true, includeCi: true }) };
  }

  async function assertDeployReady() {
    const status = await getStatus({ refreshRemote: true, includeCi: true });
    if (!status.readyForDeploy) {
      throw httpError(`部署门禁未通过：${status.blockers.join('；')}`, 409);
    }
    return status;
  }

  return { getStatus, sync, pushPending, assertDeployReady };
}

const defaultSourceControl = createSourceControl();

module.exports = {
  CI_API,
  EXPECTED_BRANCH,
  EXPECTED_ORIGIN,
  SOURCE_CONFIRMATION,
  createSourceControl,
  isManagedPath,
  parsePorcelain,
  validateCommitMessage,
  validateManagedPath,
  ...defaultSourceControl,
};
