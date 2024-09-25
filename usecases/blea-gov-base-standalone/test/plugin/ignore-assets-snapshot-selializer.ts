/* eslint @typescript-eslint/no-explicit-any: 0 */
module.exports = {
  test: (val: any) => typeof val === 'string',
  serialize: (val: any) => {
    return `"${val.replace(/[A-Fa-f0-9]{64}.(zip|json)/, 'HASH-REPLACED.$1')}"`;
  },
};
