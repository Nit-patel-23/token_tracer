import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Vanilla dashboard scripts + vendored daemon (linted lightly for now)
    'public/**/*.js',
    'public/sync-daemon.mjs',
    'bin/**',
    'lib/**/*.mjs',
    'scratch/**',
    '.agents/**',
  ]),
  {
    rules: {
      // Gradual hardening — prefer typed models over blanket any bans in legacy API routes.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@next/next/no-html-link-for-pages': 'warn',
      '@next/next/no-css-tags': 'off',
    },
  },
]);

export default eslintConfig;
