import js from '@eslint/js';

export default [
  {
    ignores: [
      '**/node_modules/**',
      'dist/**',
      'vendor/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  {
    files: ['*.config.js', 'scripts/**/*.js', 'src/**/*.js', 'tests/**/*.js'],
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
