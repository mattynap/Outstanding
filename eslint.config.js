import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/www/**',
      '**/coverage/**',
      '**/.angular/**',
      'sim-output/**',
      '**/android/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // L'app gira nel browser (WebView di Capacitor).
    files: ['packages/app/src/**/*.ts'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    // Il motore deve restare puro, deterministico e indipendente dalla UI.
    files: ['packages/engine/src/**/*.ts'],
    languageOptions: {
      globals: {},
    },
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded Rng class.' },
        {
          object: 'Date',
          property: 'now',
          message: 'The engine must not depend on wall-clock time.',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date']",
          message: 'The engine must not depend on wall-clock time.',
        },
      ],
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'localStorage',
        'sessionStorage',
        'navigator',
        'fetch',
        'process',
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '@angular/*',
            '@ionic/*',
            '@capacitor/*',
            'phaser',
            '@outstanding/app',
            'node:*',
            'fs',
            'path',
          ],
        },
      ],
    },
  },
  prettier,
);
