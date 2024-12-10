// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config({
  files: ['**/*.ts'],
  ignores: ['**/node_modules/**/*', '**/cdk.out/**/*', '**/*.js', '**/*.d.ts'],
  extends: [eslint.configs.recommended, tseslint.configs.recommended, prettier],
  languageOptions: {
    sourceType: 'script',
    parserOptions: {
      project: './tsconfig.json',
      projectService: true,
    },
  },
});
