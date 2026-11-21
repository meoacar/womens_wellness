module.exports = {
    extends: ['expo', 'prettier'],
    plugins: ['react-hooks'],
    env: {
        node: true,
    },
    rules: {
        // React Hook Rules - CRITICAL for preventing hook errors
        'react-hooks/rules-of-hooks': 'error', // Enforce Rules of Hooks
        'react-hooks/exhaustive-deps': 'warn', // Warn about missing dependencies
    },
    overrides: [
        {
            files: ['*.ts', '*.tsx'],
            parser: '@typescript-eslint/parser',
            parserOptions: {
                project: './tsconfig.json',
            },
        },
        {
            files: ['**/__tests__/**/*.ts', '**/__tests__/**/*.tsx', '**/*.test.ts', '**/*.test.tsx'],
            env: {
                jest: true,
            },
            parser: '@typescript-eslint/parser',
            parserOptions: {
                project: null,
            },
        },
    ],
};
