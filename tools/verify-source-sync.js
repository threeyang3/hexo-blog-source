'use strict';

const { assertDeployReady } = require('../admin/source-control');

async function main() {
  const status = await assertDeployReady();
  console.log(`Source release gate passed: ${status.shortHead} · CI ${status.ci.label}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
