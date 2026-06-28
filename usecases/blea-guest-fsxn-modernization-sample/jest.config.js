/**
 * Shared Jest configuration for all FSxN BLEA use cases.
 * Copy to each usecase root and adjust if needed.
 *
 * Key features:
 * - Asset hash exclusion for stable snapshots across CDK versions
 * - TypeScript support via ts-jest
 */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
