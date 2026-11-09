import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';
import prettier from 'eslint-config-prettier';

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/.vinext/**',
      '**/.wrangler/**',
      '**/.cloudflare/**',
      'apps/**',
      'packages/**',
      'hosting/**',
      'data/**',
    ],
  },
  ...compat.extends('next/core-web-vitals'),
  prettier,
];
