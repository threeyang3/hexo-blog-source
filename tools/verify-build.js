'use strict'

const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function assertFile(relativePath) {
  assert(fs.existsSync(path.join(root, relativePath)), `Missing required file: ${relativePath}`)
}

const siteConfig = read('_config.yml')
const themeConfig = read('_config.butterfly.yml')
const packageJson = JSON.parse(read('package.json'))
const sourceCname = read('source/CNAME').trim()
const publicCname = read('public/CNAME').trim()
const indexHtml = read('public/index.html')
const encryptedHtml = read('public/posts/c57a/index.html')
const mergedPostRedirect = read('public/posts/d2f0/index.html')
const encryptedSource = read('source/_posts/漂泊.md')
const sitemapXml = read('public/sitemap.xml')
const atomXml = read('public/atom.xml')
const searchXml = read('public/search.xml')
const robots = read('public/robots.txt')
const buildInfo = JSON.parse(read('public/build-info.json'))

assert(/^url:\s+https:\/\/threeyang\.top\s*$/m.test(siteConfig), 'Site URL must remain https://threeyang.top')
assert(/^theme:\s+butterfly\s*$/m.test(siteConfig), 'Hexo theme must remain butterfly')
assert(/repo:\s+https:\/\/github\.com\/threeyang3\/threeyang3\.github\.io\.git/.test(siteConfig), 'Unexpected deploy repository')
assert(/branch:\s+master\s*$/.test(siteConfig), 'GitHub Pages deployment branch must remain master')
assert(/^comments:\s*[\r\n]+\s+use:\s*$/m.test(themeConfig), 'Comments must remain explicitly disabled')

assert(packageJson.dependencies.hexo === '^8.1.2', 'Unexpected Hexo version range')
assert(packageJson.dependencies['hexo-theme-butterfly'] === '^5.6.1', 'Unexpected Butterfly version range')
assert(packageJson.dependencies['hexo-blog-encrypt'] === '^4.0.2', 'Unexpected encryption plugin version range')
assert(!packageJson.dependencies.valine, 'Unused Valine dependency must not return')
assert(!fs.existsSync(path.join(root, 'themes', 'butterfly')), 'Do not restore a vendored Butterfly theme')

assert(sourceCname === 'threeyang.top', 'source/CNAME changed unexpectedly')
assert(publicCname === sourceCname, 'Generated CNAME does not match source/CNAME')
assert(indexHtml.includes('href="https://threeyang.top/"'), 'Homepage canonical URL is incorrect')
assert(!indexHtml.includes('threeyang3.github.io'), 'Legacy GitHub Pages URL leaked into output')
assert(indexHtml.includes('/search.xml'), 'Local search is not connected to the generated index')
assert(!indexHtml.includes('v1.hitokoto.cn'), 'Hitokoto external request leaked into the homepage')
assert(!indexHtml.includes('busuanzi'), 'Busuanzi script leaked into the homepage')
assert(!indexHtml.includes('canvas_nest'), 'Canvas-nest script leaked into the homepage')
assert(indexHtml.includes('今日事，今日毕'), 'Homepage subtitle text is missing or incorrectly encoded')
assert(!indexHtml.includes('今日事&#44;今日毕'), 'Homepage subtitle leaked an HTML entity into JavaScript')
assert(mergedPostRedirect.includes('url=/posts/586a/'), 'Merged article redirect does not target /posts/586a/')
assert(
  mergedPostRedirect.includes('href="https://threeyang.top/posts/586a/"'),
  'Merged article canonical URL is incorrect'
)
assert(
  (mergedPostRedirect.match(/rel="canonical"/g) || []).length === 1,
  'Merged article redirect must contain exactly one canonical URL'
)

assertFile('public/sitemap.xml')
assertFile('public/atom.xml')
assertFile('public/search.xml')
for (const [name, content] of [
  ['sitemap.xml', sitemapXml],
  ['atom.xml', atomXml],
  ['search.xml', searchXml]
]) {
  assert(!content.includes('localhost'), `${name} contains localhost`)
  assert(!content.includes('threeyang3.github.io'), `${name} contains the legacy GitHub Pages URL`)
}
assert(sitemapXml.includes('https://threeyang.top'), 'sitemap.xml does not use the production domain')
assert(atomXml.includes('https://threeyang.top'), 'atom.xml does not use the production domain')
assert(/^Sitemap:\s+https:\/\/threeyang\.top\/sitemap\.xml\s*$/m.test(robots), 'robots.txt sitemap URL is incorrect')
assert(typeof buildInfo.commit === 'string' && buildInfo.commit.length > 0, 'Build commit marker is missing')
assert(!Number.isNaN(Date.parse(buildInfo.builtAt)), 'Build timestamp is invalid')

assert(encryptedHtml.includes('class="hbe hbe-container"'), 'Encrypted article container is missing')
assert(encryptedHtml.includes('data-hbe-format="4"'), 'Encrypted article was not generated with v4 format')
assert(encryptedHtml.includes('data-kdf-iterations="600000"'), 'Encrypted article KDF setting is incorrect')
const encryptedPlaintextMarker = '漂泊，一个我们平时不太会用到的词'
assert(encryptedSource.includes(encryptedPlaintextMarker), 'Encrypted-content privacy marker is stale')
assert(!/^password\s*:/m.test(encryptedSource), 'Encrypted article contains a plaintext source password')
assert(
  /^password_secret:\s+BLOG_ENCRYPTION_PASSWORD_C57A\s*$/m.test(encryptedSource),
  'Encrypted article secret reference is missing'
)
assert(!encryptedHtml.includes('BLOG_ENCRYPTION_PASSWORD_C57A'), 'Encryption secret reference leaked into output')
assert(!atomXml.includes(encryptedPlaintextMarker), 'Encrypted article plaintext leaked into atom.xml')
assert(!searchXml.includes(encryptedPlaintextMarker), 'Encrypted article plaintext leaked into search.xml')
assert(searchXml.includes('data-hbe-format="4"'), 'Encrypted article container is missing from search.xml')

for (const asset of [
  'source/img/404.jpg',
  'source/img/4261.JPG',
  'source/img/bk1.jpg',
  'source/img/bk1.webp',
  'source/img/bk2.webp',
  'source/img/error-page.png',
  'source/img/friend_404.gif',
  'source/img/logo.ico'
]) {
  assertFile(asset)
}

for (const [asset, maxBytes] of [
  ['source/img/bk1.webp', 400 * 1024],
  ['source/img/bk2.webp', 300 * 1024]
]) {
  const bytes = fs.statSync(path.join(root, asset)).size
  assert(bytes <= maxBytes, `${asset} exceeds its ${maxBytes}-byte performance budget`)
}

console.log('Verified deployment configuration, CNAME, discovery files, build identity, theme assets, performance budgets, and encrypted output privacy.')
