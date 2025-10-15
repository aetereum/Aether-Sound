const globals = require('globals');

module.exports = [
  {
    ignores: ['node_modules/**', 'public/**', 'assets/**', 'output/**', 'uploads/**', 'mixxx/**', 'tests/**', 'tmp/**'],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'commonjs',
      globals: {
        ...globals.node
      }
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
    }
  },
  {
    files: ['public/**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'script',
      globals: {
        ...globals.browser
      }
    },
    rules: {
      'no-console': 'warn'
    }
  }
];
