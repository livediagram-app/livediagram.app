// Which changed files make a CI run check everything (docs/ci.md "What a run checks"), kept apart from
// ci-plan.mjs so the rule is tested on its own: ci-plan runs as it loads.

// Changing one of these can break any workspace without turbo seeing it as theirs: run everything.
export const RUN_ALL = [
  /^\.github\//,
  /^package\.json$/,
  /^pnpm-workspace\.yaml$/,
  /^turbo\.json$/,
  /^tsconfig\.base\.json$/,
  /^prettier\.config\.js$/,
  /^\.prettierignore$/,
  /^\.npmrc$/,
  /^(livediagram|liveplanner|livedesign|livedocuments|livehuddle|liveknowledge)\/(package\.json|tsconfig\.base\.json|prettier\.config\.js|\.prettierignore)$/,
];

// A guard's baseline list (the copies and the files over 800 lines that exist today): data only its own
// guard reads, so it can break no workspace. Shrinking one after a tidy-up once checked all 196 workspaces.
export const GUARD_DATA = [/^\.github\/scripts\/[\w-]+-baseline\.txt$/];

// The platform workspace a guard-data change is given when it reaches no other, so the platform's Checks
// job (the guards themselves, and the CI script tests) still runs on it. Small, with nothing of its own to build.
export const GUARD_DATA_HOST = '@liveworkspace/vitest-config';

/** @param {string} file */
export const isGuardData = (file) => GUARD_DATA.some((re) => re.test(file));

/** Whether a changed file means every workspace is checked. @param {string} file */
export const forcesAll = (file) => RUN_ALL.some((re) => re.test(file)) && !isGuardData(file);
