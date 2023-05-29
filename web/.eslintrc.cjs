module.exports = {
    env: {
        browser: true,
        es2021: true
    },
    extends: ['plugin:react/recommended', 'standard-with-typescript'],
    overrides: [],
    parserOptions: {
        tsconfigRootDir: __dirname,
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: ['tsconfig.json']
    },
    plugins: ['react'],
    ignorePatterns: ['**/*SVG.jsx', '../**/*.js', '**/src/lib/legacy/*.js', 'node_modules/ami.js/**/*.js'],
    rules: {
        semi: [2, 'always'],
        '@typescript-eslint/semi': [2, 'always'],
        indent: ['error', 4, { "SwitchCase": 1 }],
        '@typescript-eslint/indent': ['error', 4],
        'no-trailing-spaces': 0,
        '@typescript-eslint/space-before-function-paren': 0,
        '@typescript-eslint/no-extraneous-class': 0
    }
};
