import base from '@firstround/config/eslint';

export default [
  ...base,
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
      'docs/plans/**',
    ],
  },
];
