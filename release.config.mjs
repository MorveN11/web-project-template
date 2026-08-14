/**
 * semantic-release config. Reads conventional commits to bump the version,
 * generates release notes, and tags the docker images via the release
 * workflow matrix in `.github/workflows/release.{prod,test}.yml`.
 *
 * Branches: `main` → stable release, `test` → prerelease.
 * @type {import('semantic-release').Options}
 */
/** biome-ignore-all lint/suspicious/noTemplateCurlyInString: 'Release config file' */
export default {
  branches: [
    { name: 'main', channel: 'latest' },
    { name: 'test', channel: 'test', prerelease: true },
  ],
  tagFormat: '${version}',
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    '@semantic-release/github',
  ],
  preset: 'conventionalcommits',
  presetConfig: {
    types: [
      { type: 'feat', section: 'Features' },
      { type: 'fix', section: 'Bug Fixes' },
      { type: 'chore', section: 'Chores', hidden: false },
      { type: 'docs', section: 'Docs' },
      { type: 'style', section: 'Styling', hidden: true },
      { type: 'refactor', section: 'Refactors' },
      { type: 'perf', section: 'Performance' },
      { type: 'test', section: 'Tests' },
      { type: 'build', section: 'Build System' },
      { type: 'ci', section: 'CI/CD' },
    ],
  },
};
