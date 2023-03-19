module.exports = {
  env: {
    browser: true,
    es2021: true
  },
  extends: [
    'plugin:react/recommended',
    'standard-with-typescript'
  ],
  overrides: [
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: ['tsconfig.json']
  },
  plugins: [
    'react'
  ],
  ignorePatterns: ["**/*SVG.jsx"],
  rules: {
    "semi": [2, "always"],
    "@typescript-eslint/semi": [2, "always"],
    "indent": ["error", 4],
    "@typescript-eslint/indent": ["error", 4],
    "no-trailing-spaces": 0,
    "@typescript-eslint/space-before-function-paren": 0
  }
}
