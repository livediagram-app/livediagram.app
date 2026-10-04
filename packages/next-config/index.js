/**
 * Shared Next.js settings for every Next app in the monorepo (live, help, telemetry, marketing).
 * See docs/specs/003-system-architecture/e2e-smoke.md "Cost controls".
 */

/** The environment variable that lets a build skip Next's own type check. */
export const SKIP_TYPECHECK_ENV = 'BUILD_SKIP_TYPECHECK';

/**
 * Next's `typescript` setting. `next build` type-checks the app by default; a build made only to be
 * tested (the E2E Smoke jobs) sets BUILD_SKIP_TYPECHECK=1 and skips it, because CI's required Checks
 * job already type-checks every app with `tsc --noEmit` against the same tsconfig. Production and
 * staging builds leave it unset and keep the check.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ ignoreBuildErrors: boolean }}
 */
export function typescriptConfig(env = process.env) {
  const skip = env[SKIP_TYPECHECK_ENV] === '1';
  if (skip) console.log(`[next-config] ${SKIP_TYPECHECK_ENV}=1: next build skips its type check`);
  return { ignoreBuildErrors: skip };
}
