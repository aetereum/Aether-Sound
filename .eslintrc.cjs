module.exports = {
  env: {
    node: true,
    es2021: true,
    browser: true
  },
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module'
  },
  ignorePatterns: ['node_modules/', 'public/', 'assets/', 'output/', 'uploads/', 'mixxx/', 'tests/', 'tmp/'],
  extends: ['eslint:recommended', 'plugin:unicorn/recommended'],
  rules: {
    'no-console': 'off',
    'unicorn/no-process-exit': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
  },
  overrides: [
    {
      files: ['server.js', 'src/**', 'scripts/**', '*.js'],
      env: { node: true, browser: false },
      globals: {
        require: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
        Buffer: 'readonly'
      }
    },
    {
      files: ['public/**', 'src/**/client/**', 'src/**/ui/**', 'tests/**'],
      env: { browser: true, node: false }
    }
  ]
};
