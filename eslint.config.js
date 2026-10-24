import js from '@eslint/js';

export default [
  {
    ignores: [
      '**/node_modules/**',
      'dist/**',
      'three/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  {
    files: [
      '*.config.js',
      'scripts/**/*.js',
      'src/**/*.js',
      'tests/**/*.js',
      'js/share-url.js',
      'js/main.js',
      'js/ui.js',
    ],
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
    },
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        window: 'readonly',
        document: 'readonly',
      },
    },
  },
];
