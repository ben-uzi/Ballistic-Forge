import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.next/**',
      '**/.vercel/**',
      'supabase/.temp/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: ['*.{js,mjs,ts}', 'scripts/**/*.{js,mjs,ts}', '**/*.config.{js,mjs,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    // The service worker is plain JS running in a worker global scope.
    files: ['apps/web/public/sw.js'],
    languageOptions: { globals: globals.serviceworker },
  },
  {
    // The engine must stay pure and portable to React Native: no any, no DOM, no network, no Node APIs.
    files: ['packages/engine/src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'navigator',
        'localStorage',
        'fetch',
        'XMLHttpRequest',
        'process',
        'require',
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-*', 'next', 'next/*'],
              message: 'Engine must not depend on UI.',
            },
            {
              group: ['node:*', 'fs', 'path', 'os'],
              message: 'Engine must not depend on Node APIs.',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
