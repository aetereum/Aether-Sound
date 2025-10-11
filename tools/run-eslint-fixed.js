#!/usr/bin/env node
const { ESLint } = require('eslint');
const path = require('path');

async function run() {
  // Use a minimal programmatic overrideConfig and disable loading other configs
  const path = require('path');
  const tempConfig = path.resolve(__dirname, '..', '.eslintrc.temp.cjs');
  const eslint = new ESLint({
    overrideConfigFile: tempConfig,
    ignore: true,
    fix: true,
  });

  const results = await eslint.lintFiles(['server.js', 'src/**/*.js']);
  await ESLint.outputFixes(results);

  const formatter = await eslint.loadFormatter('stylish');
  const resultText = formatter.format(results);
  console.log(resultText);

  const errorCount = results.reduce((s, r) => s + r.errorCount, 0);
  process.exit(errorCount > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(2);
});
