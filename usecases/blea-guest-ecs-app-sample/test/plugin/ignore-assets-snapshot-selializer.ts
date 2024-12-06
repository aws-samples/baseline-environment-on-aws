/* eslint @typescript-eslint/no-explicit-any: 0 */
module.exports = {
  test: (val: any) => typeof val === 'string',
  serialize: (val: any) => {
    return `"${val.replace(/[A-Fa-f0-9]{64}(\.zip|\.json|:[A-Za-z0-9_-]*)/g, 'HASH-REPLACED$1')}"`;
  },
};
