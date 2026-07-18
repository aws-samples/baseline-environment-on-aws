/* eslint @typescript-eslint/no-explicit-any: 0 */
module.exports = {
  test: (val: any) => typeof val === 'string',
  serialize: (val: any) => {
    return `"${val.replace(/[A-Fa-f0-9]{64}(\.zip|\.json|:[A-Za-z0-9_-]*)/g, (match: string, suffix: string) => {
      // Normalize trailing short hash (6-8 hex chars) in asset identifiers
      // to avoid environment-dependent snapshot differences (e.g., Node.js version)
      const normalized = suffix.replace(/-[A-Fa-f0-9]{6,8}$/, '-SHORTHASH');
      return 'HASH-REPLACED' + normalized;
    })}"`;
  },
};
