#!/usr/bin/env node
const { ESLint } = require('eslint');

async function run() {
  const eslint = new ESLint({
    overrideConfig: {
      env: { node: true, es2021: true },
      parserOptions: { ecmaVersion: 2021, sourceType: 'script' },
      rules: {
        semi: ['error', 'always'],
        quotes: ['error', 'single'],
        'no-trailing-spaces': 'error',
        'eol-last': ['error', 'always'],
        indent: ['error', 2]
      }
    },
    fix: true,
  });

  const results = await eslint.lintFiles(['server.js', 'src/**/*.js']);
  await ESLint.outputFixes(results);
  const formatter = await eslint.loadFormatter('stylish');
  console.log(formatter.format(results));
  const errorCount = results.reduce((s, r) => s + r.errorCount, 0);
  process.exit(errorCount > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(2);
});
