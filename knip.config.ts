import { KnipConfig } from 'knip';

export default {
  workspaces: {
    /**
     * root
     */
    '.': {
      ignore: ['node_modules'],
      ignoreBinaries: ['git-secrets'],
      ignoreDependencies: ['simple-git-hooks', 'ts-node'],
    },
    /**
     * usecases
     */
    'usecases/blea-guest-serverless-api-sample': {
      entry: ['bin/*.ts', 'lambda/**/*.{js,ts}'],
      project: '**/*.{js,ts}',
      ignore: ['parameter.ts'], // this is an example, so parameters not used externally are also exported.
      ignoreDependencies: ['esbuild'], // to bundle Lambda functions
    },
    'usecases/*': {
      entry: ['bin/*.ts'],
      project: '**/*.{js,ts}',
      ignore: ['parameter.ts'], // this is an example, so parameters not used externally are also exported.
    },
  },
} as const satisfies KnipConfig;
