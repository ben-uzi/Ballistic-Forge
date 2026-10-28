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
    // supabase-js constrains a schema's tables to `Record<string, unknown>`.
    // Interfaces get no implicit index signature and fail that constraint, which
    // silently degrades every Insert to `never` — so the generated-types idiom
    // (object type aliases plus mapped-never members) is required in this file.
    files: ['packages/db/src/types.ts'],
    rules: {
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/consistent-indexed-object-style': 'off',
    },
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
