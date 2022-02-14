module.exports = {
  test: (val: unknown) => typeof val === 'string',
  print: (val: unknown) => {
    const newVal = (val as string).replace(/([A-Fa-f0-9]{64})(\.zip)/, '[HASH REMOVED]');
    return `"${newVal}"`;
  },
};
