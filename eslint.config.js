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
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: ['*.{js,ts}', 'scripts/**/*.{js,ts}', '**/*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
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
