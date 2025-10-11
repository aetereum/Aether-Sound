#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { ESLint } = require('eslint');

function walk(dir, filelist = []) {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filepath = path.join(dir, file);
    const stat = fs.statSync(filepath);
    if (stat.isDirectory()) {
      walk(filepath, filelist);
    } else if (stat.isFile() && filepath.endsWith('.js')) {
      filelist.push(filepath);
    }
  });
  return filelist;
}

async function run() {
  const overrideConfig = {
    env: { node: true, es2021: true },
    parserOptions: { ecmaVersion: 2021, sourceType: 'script' },
    rules: {
      semi: ['error', 'always'],
      quotes: ['error', 'single'],
      'no-trailing-spaces': 'error',
      'eol-last': ['error', 'always'],
      indent: ['error', 2]
    }
  };

  const eslint = new ESLint({ overrideConfig, fix: true });

  const files = [path.resolve('server.js')];
  const srcDir = path.resolve('src');
  if (fs.existsSync(srcDir)) {
    walk(srcDir, files);
  }

  let totalFixed = 0;
  for (const file of files) {
    try {
      const code = fs.readFileSync(file, 'utf8');
      const results = await eslint.lintText(code, { filePath: file });
      await ESLint.outputFixes(results);
      const fixed = results.reduce((s, r) => s + (r.output ? 1 : 0), 0);
      if (fixed) {
        totalFixed += fixed;
        console.log(`Applied fixes to ${file}`);
      }
    } catch (err) {
      console.error(`Error linting ${file}:`, err.message || err);
    }
  }

  console.log(`Total files fixed: ${totalFixed}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(2);
});
