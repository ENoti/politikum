import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

// Keep the release gate focused on runtime reference errors, including in JSX.
export default [{
  files: ['src/**/*.{js,jsx}'],
  plugins: { 'react-hooks': reactHooks },
  linterOptions: { reportUnusedDisableDirectives: false },
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
    globals: {
      ...globals.browser,
      __GIT_SHA__: 'readonly',
      __GIT_SHA_SHORT__: 'readonly',
      __GIT_BRANCH__: 'readonly',
      __ENGINE_GIT_SHA_SHORT__: 'readonly',
    },
  },
  rules: { 'no-undef': 'error' },
}];
