module.exports = {
  env: {
    es2021: true,
    node: true,
    jest: true,
  },
  extends: [
    'eslint:recommended',
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  rules: {
    'indent': ['error', 2],
    'linebreak-style': ['error', 'unix'],
    'quotes': ['error', 'single'],
    'semi': ['error', 'always'],
    'no-unused-vars': ['warn'],
    'no-console': 'off',
    'no-undef': 'error',
  },
  globals: {
    'BigInt': 'readonly',
    'Worker': 'readonly',
    'navigator': 'readonly',
    'importScripts': 'readonly',
    'self': 'readonly',
  },
};