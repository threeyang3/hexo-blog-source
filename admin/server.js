'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');
const {
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
} = require('./content-store');
const { getReleaseReport } = require('./release-report');

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(__dirname, 'public');
const LOOPBACK = '127.0.0.1';
const DEFAULT_PORT = 4173;
const BLOG_PORT = 5000;
const MAX_BODY_BYTES = 16 * 1024;
const MAX_LOG_LINES = 500;
const TOKEN = crypto.randomBytes(24).toString('hex');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npmCli = [
  process.env.npm_execpath,
  path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  path.resolve(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
].find((candidate) => candidate && fs.existsSync(candidate));

function npmInvocation(args) {
  return npmCli
    ? { command: process.execPath, args: [npmCli, ...args] }
    : { command: npmCommand, args };
}

const actionDefinitions = Object.freeze({
  check: {
    label: '完整检查',
    ...npmInvocation(['run', 'check']),
  },
  build: {
    label: '生成站点',
    ...npmInvocation(['run', 'build', '--', '--bail']),
  },
  clean: {
    label: '清理缓存',
    ...npmInvocation(['run', 'clean']),
  },
  audit: {
    label: '依赖安全审计',
    ...npmInvocation(['audit', '--omit=dev', '--registry=https://registry.npmjs.org']),
    successfulExitCodes: [0, 1],
  },
  outdated: {
    label: '检查依赖更新',
    ...npmInvocation(['outdated']),
    successfulExitCodes: [0, 1],
  },
  'git-status': {
    label: 'Git 状态',
    command: 'git',
    args: ['status', '--short', '--branch'],
  },
  'smoke-live': {
    label: '线上健康检查',
    command: process.execPath,
    args: [path.join(ROOT, 'tools', 'smoke-live.js')],
  },
  performance: {
    label: '性能预算',
    ...npmInvocation(['run', 'verify:performance']),
  },
  deploy: {
    label: '部署到 GitHub Pages',
    ...npmInvocation(['run', 'deploy']),
    confirmation: 'DEPLOY threeyang.top',
  },
});

const state = {
  currentJob: null,
  lastJob: null,
  preview: null,
  logSequence: 0,
  logs: [],
  clients: new Set(),
};

function timestamp() {
  return new Date().toISOString();
}

function pushEvent(type, payload) {
  const event = {
    id: ++state.logSequence,
    type,
    time: timestamp(),
    ...payload,
  };

  if (type === 'log') {
    state.logs.push(event);
    if (state.logs.length > MAX_LOG_LINES) {
      state.logs.shift();
    }
  }

  const encoded = `id: ${event.id}\nevent: ${type}\ndata: ${JSON.stringify(event)}\n\n`;
  for (const client of state.clients) {
    client.write(encoded);
  }
}

function writeLog(source, stream, message) {
  const normalized = String(message).replace(/\r\n/g, '\n');
  for (const line of normalized.split('\n')) {
    if (line.length > 0) {
      pushEvent('log', { source, stream, message: line });
    }
  }
}

function safeJson(res, statusCode, body) {
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': data.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(data);
}

function isAuthorized(req, url) {
  const headerToken = req.headers['x-blog-admin-token'];
  const queryToken = url.searchParams.get('token');
  const provided = Buffer.from(String(headerToken || queryToken || ''));
  const expected = Buffer.from(TOKEN);
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
}

function hasAllowedOrigin(req, port) {
  const origin = req.headers.origin;
  return !origin || origin === `http://${LOOPBACK}:${port}` || origin === `http://localhost:${port}`;
}

async function readJsonBody(req, maxBytes = MAX_BODY_BYTES) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error('请求内容过大');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('请求不是有效的 JSON');
    error.statusCode = 400;
    throw error;
  }
}

async function gitStatus() {
  try {
    const { stdout } = await execFileAsync('git', ['status', '--short', '--branch'], {
      cwd: ROOT,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
    const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
    return {
      branch: (lines[0] || '## unknown').replace(/^##\s*/, ''),
      changes: Math.max(0, lines.length - 1),
      clean: lines.length <= 1,
    };
  } catch (error) {
    return { branch: '不可用', changes: null, clean: false, error: error.message };
  }
}

function countMarkdownFiles(directory) {
  if (!fs.existsSync(directory)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) total += countMarkdownFiles(fullPath);
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) total += 1;
  }
  return total;
}

async function getStatus() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const cnamePath = path.join(ROOT, 'source', 'CNAME');
  const cname = fs.existsSync(cnamePath) ? fs.readFileSync(cnamePath, 'utf8').trim() : '缺失';
  const git = await gitStatus();
  const posts = listPosts();
  const workflow = {
    published: posts.filter((post) => post.status === 'published').length,
    pending: posts.filter((post) => post.status === 'pending').length,
    drafts: posts.filter((post) => post.status === 'draft').length,
  };

  return {
    project: {
      name: "Threeyang's Blog",
      url: 'https://threeyang.top',
      cname,
      posts: posts.length,
      node: process.version,
      hexo: packageJson.hexo?.version || packageJson.dependencies?.hexo || '未知',
      theme: packageJson.dependencies?.['hexo-theme-butterfly'] || '未知',
    },
    contentHealth: {
      missingCover: posts.filter((post) => !post.cover).length,
      missingDescription: posts.filter((post) => !post.description).length,
      encrypted: posts.filter((post) => post.encrypted).length,
      ...workflow,
    },
    git,
    currentJob: state.currentJob
      ? { id: state.currentJob.id, action: state.currentJob.action, label: state.currentJob.label }
      : null,
    lastJob: state.lastJob,
    preview: state.preview
      ? { active: true, startedAt: state.preview.startedAt, url: `http://localhost:${BLOG_PORT}/` }
      : { active: false, url: `http://localhost:${BLOG_PORT}/` },
    actions: Object.entries(actionDefinitions).map(([id, action]) => ({
      id,
      label: action.label,
      requiresConfirmation: Boolean(action.confirmation),
      confirmation: action.confirmation || null,
    })),
  };
}

function attachProcessOutput(child, source) {
  child.stdout.on('data', (chunk) => writeLog(source, 'stdout', chunk));
  child.stderr.on('data', (chunk) => writeLog(source, 'stderr', chunk));
  child.on('error', (error) => writeLog(source, 'stderr', error.message));
}

function runAction(actionId, body) {
  const definition = actionDefinitions[actionId];
  if (!definition) {
    const error = new Error('未知操作');
    error.statusCode = 404;
    throw error;
  }
  if (state.currentJob) {
    const error = new Error(`“${state.currentJob.label}”仍在运行，请等待完成`);
    error.statusCode = 409;
    throw error;
  }
  if (definition.confirmation && body.confirmation !== definition.confirmation) {
    const error = new Error(`部署确认短语不正确，请输入：${definition.confirmation}`);
    error.statusCode = 400;
    throw error;
  }

  const job = {
    id: crypto.randomUUID(),
    action: actionId,
    label: definition.label,
    startedAt: timestamp(),
  };
  const child = spawn(definition.command, definition.args, {
    cwd: ROOT,
    env: { ...process.env, FORCE_COLOR: '0' },
    shell: false,
    windowsHide: true,
  });

  job.process = child;
  state.currentJob = job;
  writeLog(actionId, 'system', `开始：${definition.label}`);
  pushEvent('state', { reason: 'job-started' });
  attachProcessOutput(child, actionId);

  child.on('close', (code, signal) => {
    const successfulExitCodes = definition.successfulExitCodes || [0];
    const result = {
      id: job.id,
      action: actionId,
      label: definition.label,
      startedAt: job.startedAt,
      finishedAt: timestamp(),
      exitCode: code,
      signal,
      success: successfulExitCodes.includes(code),
    };
    state.currentJob = null;
    state.lastJob = result;
    writeLog(actionId, result.success ? 'system' : 'stderr', result.success
      ? `完成：${definition.label}`
      : `失败：${definition.label}（退出码 ${code ?? '未知'}）`);
    pushEvent('state', { reason: 'job-finished', result });
  });

  return { id: job.id, action: actionId, label: definition.label };
}

function assertPreviewPortAvailable() {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: LOOPBACK, port: BLOG_PORT });
    socket.once('connect', () => {
      socket.destroy();
      reject(Object.assign(
        new Error(`${BLOG_PORT} 端口已被其他程序占用，未启动 Hexo 预览`),
        { statusCode: 409 },
      ));
    });
    socket.once('error', (error) => {
      socket.destroy();
      if (error.code === 'ECONNREFUSED') resolve();
      else reject(Object.assign(new Error(`无法检查预览端口：${error.message}`), { statusCode: 503 }));
    });
    socket.setTimeout(1000, () => {
      socket.destroy();
      reject(Object.assign(new Error('检查预览端口超时'), { statusCode: 504 }));
    });
  });
}

async function startPreview() {
  if (state.preview) {
    const error = new Error('本地预览已经在运行');
    error.statusCode = 409;
    throw error;
  }

  await assertPreviewPortAvailable();

  const hexoCli = path.join(ROOT, 'node_modules', 'hexo', 'bin', 'hexo');
  if (!fs.existsSync(hexoCli)) {
    const error = new Error('缺少本地 Hexo，请先运行 npm ci');
    error.statusCode = 503;
    throw error;
  }

  const child = spawn(process.execPath, [hexoCli, 'server', '--draft', '--port', String(BLOG_PORT)], {
    cwd: ROOT,
    env: { ...process.env, FORCE_COLOR: '0' },
    shell: false,
    windowsHide: true,
  });
  state.preview = { process: child, startedAt: timestamp() };
  writeLog('preview', 'system', `启动本地预览：http://localhost:${BLOG_PORT}/`);
  pushEvent('state', { reason: 'preview-started' });
  attachProcessOutput(child, 'preview');

  child.on('close', (code, signal) => {
    if (state.preview?.process === child) {
      state.preview = null;
      writeLog('preview', code === 0 || signal ? 'system' : 'stderr', '本地预览已停止');
      pushEvent('state', { reason: 'preview-stopped' });
    }
  });

  return { url: `http://localhost:${BLOG_PORT}/` };
}

function stopPreview() {
  if (!state.preview) {
    const error = new Error('本地预览没有运行');
    error.statusCode = 409;
    throw error;
  }
  state.preview.process.kill();
}

function waitForPreviewReady(timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const attempt = () => {
      const request = http.get(`http://${LOOPBACK}:${BLOG_PORT}/`, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode < 500) {
          resolve();
          return;
        }
        if (Date.now() >= deadline) {
          reject(Object.assign(new Error('本地预览启动超时'), { statusCode: 504 }));
          return;
        }
        setTimeout(attempt, 250);
      });
      request.on('error', () => {
        if (Date.now() >= deadline) {
          reject(Object.assign(new Error('本地预览启动超时'), { statusCode: 504 }));
        } else {
          setTimeout(attempt, 250);
        }
      });
      request.setTimeout(1000, () => request.destroy());
    };
    attempt();
  });
}

function contentType(filePath) {
  return {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  }[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function serveStatic(url, res) {
  const requested = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  const filePath = path.resolve(PUBLIC_DIR, requested);
  if (!filePath.startsWith(`${PUBLIC_DIR}${path.sep}`) && filePath !== path.join(PUBLIC_DIR, 'index.html')) {
    safeJson(res, 403, { error: '拒绝访问' });
    return;
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    safeJson(res, 404, { error: '页面不存在' });
    return;
  }

  const body = fs.readFileSync(filePath);
  res.writeHead(200, {
    'Content-Type': contentType(filePath),
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; frame-src http://127.0.0.1:5000 http://localhost:5000; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  });
  res.end(body);
}

function openBrowser(url) {
  if (process.argv.includes('--no-open') || process.env.CI) return;
  const command = process.platform === 'win32' ? 'cmd.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
}

function createServer() {
  let actualPort = DEFAULT_PORT;
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || `${LOOPBACK}:${actualPort}`}`);

    try {
      if (url.pathname.startsWith('/api/')) {
        if (!isAuthorized(req, url)) {
          safeJson(res, 401, { error: '访问令牌无效，请从启动窗口重新打开控制台' });
          return;
        }

        if (url.pathname === '/api/events' && req.method === 'GET') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
          });
          res.write('retry: 1500\n\n');
          for (const event of state.logs) {
            res.write(`id: ${event.id}\nevent: log\ndata: ${JSON.stringify(event)}\n\n`);
          }
          state.clients.add(res);
          req.on('close', () => state.clients.delete(res));
          return;
        }

        if (url.pathname === '/api/status' && req.method === 'GET') {
          safeJson(res, 200, await getStatus());
          return;
        }

        if (url.pathname === '/api/posts' && req.method === 'GET') {
          safeJson(res, 200, { posts: listPosts() });
          return;
        }

        if (url.pathname === '/api/health' && req.method === 'GET') {
          safeJson(res, 200, { health: getContentHealth() });
          return;
        }

        if (url.pathname === '/api/release-report' && req.method === 'GET') {
          safeJson(res, 200, { report: await getReleaseReport() });
          return;
        }

        const postHistoryDiffRoute = url.pathname.match(/^\/api\/posts\/([^/]+)\/history\/([^/]+)$/);
        if (postHistoryDiffRoute && req.method === 'GET') {
          safeJson(res, 200, {
            diff: diffPostHistory(decodeURIComponent(postHistoryDiffRoute[1]), decodeURIComponent(postHistoryDiffRoute[2])),
          });
          return;
        }

        const postHistoryRoute = url.pathname.match(/^\/api\/posts\/([^/]+)\/history$/);
        if (postHistoryRoute && req.method === 'GET') {
          safeJson(res, 200, { history: listPostHistory(decodeURIComponent(postHistoryRoute[1])) });
          return;
        }

        const postRoute = url.pathname.match(/^\/api\/posts\/([^/]+)$/);
        if (postRoute && req.method === 'GET') {
          const id = decodeURIComponent(postRoute[1]);
          safeJson(res, 200, { post: getPost(id) });
          return;
        }

        if (url.pathname === '/api/media' && req.method === 'GET') {
          safeJson(res, 200, { media: listMedia() });
          return;
        }

        if (url.pathname.startsWith('/api/media/file/') && req.method === 'GET') {
          const id = decodeURIComponent(url.pathname.slice('/api/media/file/'.length));
          const filePath = resolveMedia(id);
          const body = fs.readFileSync(filePath);
          res.writeHead(200, {
            'Content-Type': contentType(filePath),
            'Content-Length': body.length,
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
          });
          res.end(body);
          return;
        }

        if (url.pathname === '/api/visuals' && req.method === 'GET') {
          safeJson(res, 200, { visuals: getVisuals() });
          return;
        }

        if (!hasAllowedOrigin(req, actualPort)) {
          safeJson(res, 403, { error: '请求来源不受信任' });
          return;
        }

        if (url.pathname.startsWith('/api/actions/') && req.method === 'POST') {
          const actionId = decodeURIComponent(url.pathname.slice('/api/actions/'.length));
          safeJson(res, 202, { job: runAction(actionId, await readJsonBody(req)) });
          return;
        }

        if (url.pathname === '/api/posts' && req.method === 'POST') {
          safeJson(res, 201, { post: createPost(await readJsonBody(req, MAX_BODY_BYTES * 8)) });
          return;
        }

        if (postRoute && req.method === 'PUT') {
          const id = decodeURIComponent(postRoute[1]);
          safeJson(res, 200, { post: savePost(id, await readJsonBody(req, MAX_BODY_BYTES * 160)) });
          return;
        }

        const postStatusRoute = url.pathname.match(/^\/api\/posts\/([^/]+)\/status$/);
        if (postStatusRoute && req.method === 'PUT') {
          safeJson(res, 200, {
            post: transitionPost(decodeURIComponent(postStatusRoute[1]), await readJsonBody(req)),
          });
          return;
        }

        if (postHistoryDiffRoute && req.method === 'POST') {
          safeJson(res, 200, {
            post: restorePostHistory(
              decodeURIComponent(postHistoryDiffRoute[1]),
              decodeURIComponent(postHistoryDiffRoute[2]),
              await readJsonBody(req),
            ),
          });
          return;
        }

        if (url.pathname === '/api/media' && req.method === 'POST') {
          safeJson(res, 201, {
            media: uploadMedia(await readJsonBody(req, Math.ceil(MAX_IMAGE_BYTES * 1.5))),
          });
          return;
        }

        const mediaMetadataRoute = url.pathname.match(/^\/api\/media\/([^/]+)$/);
        if (mediaMetadataRoute && req.method === 'PUT') {
          safeJson(res, 200, {
            media: updateMediaMetadata(decodeURIComponent(mediaMetadataRoute[1]), await readJsonBody(req)),
          });
          return;
        }

        if (url.pathname === '/api/visuals' && req.method === 'PUT') {
          const body = await readJsonBody(req, MAX_BODY_BYTES * 2);
          if (body.confirmation !== 'SAVE VISUALS') {
            safeJson(res, 400, { error: '确认短语不正确，请输入：SAVE VISUALS' });
            return;
          }
          safeJson(res, 200, { visuals: saveVisuals(body) });
          return;
        }

        if (url.pathname === '/api/preview/start' && req.method === 'POST') {
          const preview = await startPreview();
          try {
            await waitForPreviewReady();
          } catch (error) {
            if (state.preview) state.preview.process.kill();
            throw error;
          }
          safeJson(res, 202, { ...preview, ready: true });
          return;
        }

        if (url.pathname === '/api/preview/stop' && req.method === 'POST') {
          stopPreview();
          safeJson(res, 202, { stopping: true });
          return;
        }

        safeJson(res, 404, { error: '接口不存在' });
        return;
      }

      serveStatic(url, res);
    } catch (error) {
      safeJson(res, error.statusCode || 500, { error: error.message || '内部错误' });
    }
  });

  server.on('listening', () => {
    actualPort = server.address().port;
  });

  return server;
}

function parsePort() {
  const portArgument = process.argv.find((arg) => arg.startsWith('--port='));
  if (!portArgument) return DEFAULT_PORT;
  const port = Number(portArgument.slice('--port='.length));
  return Number.isInteger(port) && port >= 0 && port <= 65535 ? port : DEFAULT_PORT;
}

if (require.main === module) {
  const server = createServer();
  server.listen(parsePort(), LOOPBACK, () => {
    const port = server.address().port;
    const url = `http://${LOOPBACK}:${port}/?token=${TOKEN}`;
    console.log('');
    console.log('  BLOG CONTROL ROOM');
    console.log(`  ${url}`);
    console.log('  仅监听本机；关闭此窗口即可停止管理界面。');
    console.log('');
    writeLog('system', 'system', '博客控制台已启动');
    openBrowser(url);
  });

  const shutdown = () => {
    if (state.preview) state.preview.process.kill();
    if (state.currentJob) state.currentJob.process.kill();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 2000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = { actionDefinitions, createServer, ROOT, TOKEN };
