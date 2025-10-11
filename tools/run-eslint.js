const { ESLint } = require('eslint');

(async () => {
  try {
    const eslint = new ESLint({
      overrideConfigFile: '.eslintrc.cjs',
      fix: true
    });

    const results = await eslint.lintFiles(['server.js', 'src/**']);
    await ESLint.outputFixes(results);

    const formatter = await eslint.loadFormatter('stylish');
    const resultText = formatter.format(results);
    console.log(resultText);

    const errorCount = results.reduce((sum, r) => sum + r.errorCount, 0);
    process.exit(errorCount > 0 ? 1 : 0);
  } catch (err) {
    console.error('Error running ESLint programmatically:', err);
    process.exit(2);
  }
})();
