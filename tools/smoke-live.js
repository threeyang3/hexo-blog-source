'use strict';

const { execFileSync } = require('node:child_process');

const SITE_URL = new URL(process.env.BLOG_LIVE_URL || 'https://threeyang.top/');
const MAX_ATTEMPTS = boundedInteger(process.env.BLOG_SMOKE_ATTEMPTS, 12, 1, 30);
const RETRY_DELAY_MS = boundedInteger(process.env.BLOG_SMOKE_DELAY_MS, 10000, 1000, 60000);
const EXPECTED_COMMIT = process.env.BLOG_EXPECTED_COMMIT || currentCommit();

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

function currentCommit() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function target(pathname) {
  return new URL(pathname, SITE_URL).toString();
}

const checks = [
  ['homepage', '/', (response, body) => response.ok && body.includes("Threeyang's blog")],
  ['sitemap', '/sitemap.xml', (response, body) => response.ok && body.includes('<urlset')],
  ['feed', '/atom.xml', (response, body) => response.ok && body.includes('<feed')],
  ['robots', '/robots.txt', (response, body) => response.ok && body.includes('sitemap.xml')],
  ['encrypted article', '/posts/c57a/', (response, body) => response.ok && body.includes('hbe-container')],
  [
    'legacy article redirect',
    '/posts/d2f0/',
    (response, body) =>
      response.ok &&
      body.includes('https://threeyang.top/posts/586a/') &&
      body.includes('rel="canonical"'),
  ],
  [
    'build identity',
    '/build-info.json',
    (response, body) => {
      if (!response.ok || !EXPECTED_COMMIT) return false;
      try {
        return JSON.parse(body).commit === EXPECTED_COMMIT;
      } catch {
        return false;
      }
    },
  ],
];

async function runChecks() {
  return Promise.all(
    checks.map(async ([name, pathname, verify]) => {
      const url = target(pathname);
      try {
        const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}healthcheck=${Date.now()}`, {
          redirect: 'follow',
          cache: 'no-store',
          signal: AbortSignal.timeout(15000),
          headers: { 'User-Agent': 'threeyang-blog-healthcheck/2.0' },
        });
        const body = await response.text();
        return {
          name,
          ok: verify(response, body),
          detail: `${response.status} ${response.url}`,
        };
      } catch (error) {
        return { name, ok: false, detail: error.message };
      }
    }),
  );
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const results = await runChecks();
    const failures = results.filter((result) => !result.ok);
    if (!failures.length) {
      for (const result of results) console.log(`PASS ${result.name}: ${result.detail}`);
      console.log(`Live site health check passed for source commit ${EXPECTED_COMMIT}.`);
      return;
    }

    const summary = failures.map((result) => `${result.name} (${result.detail})`).join(', ');
    if (attempt === MAX_ATTEMPTS) {
      console.error(`Live site did not converge after ${MAX_ATTEMPTS} attempts: ${summary}`);
      process.exitCode = 1;
      return;
    }

    console.log(
      `Live site not ready (${attempt}/${MAX_ATTEMPTS}): ${summary}; retrying in ${RETRY_DELAY_MS / 1000}s.`,
    );
    await wait(RETRY_DELAY_MS);
  }
}

main().catch((error) => {
  console.error(`Live site health check failed: ${error.message}`);
  process.exitCode = 1;
});
