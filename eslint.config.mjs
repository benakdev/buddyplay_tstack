import convexPlugin from '@convex-dev/eslint-plugin';
import pluginRouter from '@tanstack/eslint-plugin-router';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
  ...tseslint.configs.recommended,
  ...pluginRouter.configs['flat/recommended'],
  {
    ...reactPlugin.configs.flat.recommended,
    ...reactPlugin.configs.flat['jsx-runtime'], // React 19 JSX transform
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    plugins: {
      'react-hooks': reactHooksPlugin
    },
    rules: {
      ...reactHooksPlugin.configs.recommended.rules
    }
  },
  ...convexPlugin.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/only-throw-error': [
        'error',
        {
          allow: [
            {
              from: 'package',
              package: '@tanstack/router-core',
              name: 'Redirect'
            },
            {
              from: 'package',
              package: '@tanstack/router-core',
              name: 'NotFoundError'
            }
          ]
        }
      ]
    }
  },
  globalIgnores([
    '**/convex/_generated/**',
    '.tanstack',
    '.output',
    '*.config.mjs',
    '*.config.ts',
    'ios',
    'android',
    'dist'
  ])
]);
