module.exports = {
  root: true,
  parser: require.resolve('@typescript-eslint/parser', {
    paths: [__dirname, '../../apps/mobile/node_modules', '../../apps/api/node_modules'],
  }),
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react-hooks'],
  extends: ['plugin:@typescript-eslint/recommended'],
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  ignorePatterns: ['.next/**', 'node_modules/**', '.eslintrc.js'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-var-requires': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
  },
};
