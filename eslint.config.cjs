module.exports = [
  {
    ignores: ['node_modules/**', 'public/**', 'assets/**', 'output/**', 'uploads/**', 'mixxx/**', 'tests/**', 'tmp/**'],
  },
  {
    files: ['server.js', 'src/**', 'scripts/**', '*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'script'
    },
    env: { node: true, browser: false },
    rules: {
      'no-console': 'off',
      'unicorn/no-process-exit': 'off'
    }
  },
  {
    files: ['public/**', 'src/**/client/**', 'src/**/ui/**', 'tests/**', 'public/**/*.js'],
    env: { browser: true, node: false },
    rules: {
      'no-console': 'warn'
    }
  }
];
