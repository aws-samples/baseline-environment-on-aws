module.exports = {
  preset: require.resolve('conventional-changelog-conventionalcommits'),
  types: [
    { type: 'feat', section: 'Features' },
    { type: 'fix', section: 'Bug Fixes' },
    { type: 'chore', section: 'Chores', hidden: true },
    { type: 'docs', section: 'Document Changes', hidden: false },
    { type: 'refactor', section: 'Refactoring', hidden: false },
    { type: 'test', section: 'Test Improvements', hidden: false },
  ],
};
