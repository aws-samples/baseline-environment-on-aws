import { KnipConfig } from 'knip';

export default {
  ignoreBinaries: ['git-secrets'],
  ignoreDependencies: ['simple-git-hooks', 'ts-node', 'esbuild'],
  ignoreExportsUsedInFile: true,
  workspaces: {
    'usecases/*': {
      entry: ['bin/*.ts', 'lambda/**/*.{js,ts}'],
      project: '**/*.{js,ts}',
      ignore: ['parameter.ts'], // FIXME: ignore to avoid unused errors on `stagingParameter`. We should use all sample values.
    },
  },
} as const satisfies KnipConfig;
