#!/usr/bin/env node
const { ESLint } = require('eslint');
const path = require('path');

async function run() {
  const configPath = path.resolve(__dirname, '..', '.eslintrc.cjs');
  const config = require(configPath);

  const eslint = new ESLint({
    overrideConfig: config,
    fix: true,
  });

  const results = await eslint.lintFiles(['server.js', 'src/**/*.js']);
  await ESLint.outputFixes(results);

  const formatter = await eslint.loadFormatter('stylish');
  console.log(formatter.format(results));
  const errors = results.reduce((s, r) => s + r.errorCount, 0);
  process.exit(errors > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(2);
});
