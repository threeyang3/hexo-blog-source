'use strict';

const checks = [
  ['homepage', 'https://threeyang.top/', (response, body) => response.ok && body.includes("Threeyang's blog")],
  ['sitemap', 'https://threeyang.top/sitemap.xml', (response, body) => response.ok && body.includes('<urlset')],
  ['feed', 'https://threeyang.top/atom.xml', (response, body) => response.ok && body.includes('<feed')],
  ['robots', 'https://threeyang.top/robots.txt', (response, body) => response.ok && body.includes('sitemap.xml')],
  ['encrypted article', 'https://threeyang.top/posts/c57a/', (response, body) => response.ok && body.includes('hbe-container')],
];

async function main() {
  const failures = [];
  for (const [name, url, verify] of checks) {
    try {
      const response = await fetch(`${url}?healthcheck=${Date.now()}`, {
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
        headers: { 'User-Agent': 'threeyang-blog-healthcheck/1.0' },
      });
      const body = await response.text();
      if (!verify(response, body)) failures.push(`${name}: unexpected response (${response.status})`);
      else console.log(`PASS ${name}: ${response.status} ${response.url}`);
    } catch (error) {
      failures.push(`${name}: ${error.message}`);
    }
  }
  if (failures.length) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('Live site health check passed.');
  }
}

main();
