'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const budgets = JSON.parse(fs.readFileSync(path.join(__dirname, 'performance-budgets.json'), 'utf8'));

function fail(message) {
  throw new Error(message);
}

function bytes(relativePath) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) fail(`Missing performance target: ${relativePath}`);
  return fs.statSync(filePath).size;
}

function verifySize(relativePath, budget) {
  const actual = bytes(relativePath);
  if (actual > budget) fail(`${relativePath} exceeds budget: ${actual} > ${budget} bytes`);
  return actual;
}

const results = {
  documents: {},
  assets: {},
};

for (const [relativePath, budget] of Object.entries(budgets.documents)) {
  results.documents[relativePath] = verifySize(relativePath, budget);
}
for (const [relativePath, budget] of Object.entries(budgets.assets)) {
  results.assets[relativePath] = verifySize(relativePath, budget);
}

const homepage = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const scriptCount = (homepage.match(/<script\b/gi) || []).length;
if (scriptCount > budgets.homepage.maxScripts) {
  fail(`Homepage script count exceeds budget: ${scriptCount} > ${budgets.homepage.maxScripts}`);
}
const productionOrigin = 'https://threeyang.top';
const resourceReferences = [...homepage.matchAll(/<(?:script|link|img)\b[^>]*(?:src|href)=["']([^"']+)["'][^>]*>/gi)]
  .map((match) => match[1])
  .filter((value) => value.startsWith('https://'));
const origins = [...new Set(resourceReferences.map((value) => {
  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
}).filter((origin) => origin && origin !== productionOrigin))];
const unexpected = origins.filter((origin) => !budgets.allowedExternalOrigins.includes(origin));
if (unexpected.length) fail(`Homepage contains unexpected external origins: ${unexpected.join(', ')}`);
if (origins.length > budgets.homepage.maxExternalOrigins) {
  fail(`Homepage external-origin count exceeds budget: ${origins.length} > ${budgets.homepage.maxExternalOrigins}`);
}

console.log(JSON.stringify({
  ...results,
  homepage: {
    scripts: scriptCount,
    externalOrigins: origins,
  },
}, null, 2));
console.log('Performance structure and resource budgets passed.');
