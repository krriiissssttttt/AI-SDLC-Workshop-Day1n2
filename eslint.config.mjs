export default [
  {
    ignores: ['.next/**', 'node_modules/**', 'coverage/**', '**/*.d.ts'],
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    rules: {
      'no-debugger': 'error',
      'no-alert': 'error',
      eqeqeq: 'error',
    },
  },
];
