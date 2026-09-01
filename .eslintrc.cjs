module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  globals: {
    // Loaded at runtime by googleDriveService via Google's script tags.
    gapi: 'readonly',
    google: 'readonly',
  },
  overrides: [
    {
      files: ['vite.config.js', '.eslintrc.cjs'],
      env: { node: true },
    },
    {
      // Cloud Functions are CommonJS running on Node, not browser ESM.
      files: ['functions/**/*.js'],
      env: { node: true, browser: false },
      parserOptions: { sourceType: 'script' },
    },
  ],
  settings: { react: { version: '18.2' } },
  plugins: ['react-refresh'],
  rules: {
    'react/jsx-no-target-blank': 'off',
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
  },
}
