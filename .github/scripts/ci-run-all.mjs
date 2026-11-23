// Which changed files make a CI run check everything, and what the rest of `.github/` reaches (docs/ci.md
// "Only what changed"), kept apart from ci-plan.mjs so the rule is tested on its own: ci-plan runs as it loads.

// The parts of `.github/` every CI job runs: a mistake there can fail any job.
const CI_SHARED = [
  /^\.github\/workflows\/ci\.yml$/,
  /^\.github\/actions\/(setup|turbo-cache|turbo-cache-save|cancel-on-failure)\//,
  /^\.github\/scripts\/(ci-plan|ci-run-all|ci-readers|cpu-budget-guard|cancel-on-failure|coverage-floors|lcov)\.mjs$/,
  /^\.github\/scripts\/coverage-floors\.json$/,
  /^\.github\/scripts\/format-check\.sh$/,
];

// Changing one of these can break any workspace without turbo seeing it as theirs: run everything.
export const RUN_ALL = [
  ...CI_SHARED,
  /^package\.json$/,
  /^pnpm-workspace\.yaml$/,
  /^turbo\.json$/,
  /^tsconfig\.base\.json$/,
  /^prettier\.config\.js$/,
  /^\.prettierignore$/,
  /^\.npmrc$/,
  /^(livediagram|liveplanner|livedesign|livedocuments|livehuddle|liveknowledge)\/(package\.json|\.prettierignore)$/,
];

// What only the e2e jobs run: every product's E2E, and nothing else for it.
export const E2E_ALL = [
  /^\.github\/workflows\/(e2e|e2e-product)\.yml$/,
  /^\.github\/actions\/(e2e-setup|next-cache-restore|next-cache-save)\//,
  /^\.github\/scripts\/next-build-cold-retry\.sh$/,
];

// The platform workspace a `.github/` change is given when it reaches no other, so the platform's Checks
// job (the repo guards over the whole repository, and the CI script tests) still runs on it. Small, with
// nothing of its own to build.
export const GUARD_DATA_HOST = '@liveworkspace/vitest-config';

/** Whether a changed file means every workspace is checked. @param {string} file */
export const forcesAll = (file) => RUN_ALL.some((re) => re.test(file));

/** Whether a changed file means every product's E2E runs. @param {string} file */
export const forcesE2e = (file) => E2E_ALL.some((re) => re.test(file));

/**
 * Whether a changed file is CI's own and checks no workspace of its own: the repo guards and their
 * baseline lists, the other workflows and scripts. The platform's Checks job runs on it.
 * @param {string} file
 */
export const needsPlatformChecks = (file) => file.startsWith('.github/') && !forcesAll(file);
