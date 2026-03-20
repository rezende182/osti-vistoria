import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

/** Alinhado ao craco (react-hooks/recommended) para `npm run lint` local e CI. */
export default [
  {
    ignores: ['build/**', 'node_modules/**'],
  },
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
];
