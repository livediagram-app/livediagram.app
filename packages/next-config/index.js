/**
 * Shared Next.js settings for every Next app in the monorepo (live, help, telemetry, community, marketing).
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

/**
 * Whether this build runs under Turbopack. Next sets `TURBOPACK` before it loads the config; the webpack escape
 * hatch (`dev:webpack`) leaves it unset.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
export function isTurbopack(env = process.env) {
  return Boolean(env.TURBOPACK);
}

/**
 * The settings every Next app shares (docs/specs/016-platform/nextjs.md "One configuration"); an app spreads this and
 * adds only what is its own. The React Compiler (Rust port) and the Turbopack flags come only under Turbopack: the
 * Rust port throws under webpack.
 *
 * @param {{ env?: NodeJS.ProcessEnv, exportInDev?: boolean, now?: Date }} [options]
 * @returns {import('next').NextConfig}
 */
export function livediagramNextConfig({
  env = process.env,
  exportInDev = true,
  now = new Date(),
} = {}) {
  const exporting = exportInDev || env.NODE_ENV === 'production';
  const turbopack = isTurbopack(env);
  console.log(`[next-config] turbopack=${turbopack} export=${exporting} compiler=${turbopack}`);
  return {
    ...(exporting ? { output: 'export' } : {}),
    // Dev builds into its own directory: `scripts/next-dev.mjs` sets NEXT_DISTDIR=.next-dev, so a `next build` running
    // anywhere in the checkout (repo-root `pnpm build`, a turbo task) cannot overwrite the dev server's
    // `_buildManifest.js.tmp.*` mid-flight (the ENOENT 500s that left the help centre unstyled). Build and CI leave it
    // unset and keep `.next`.
    distDir: env.NEXT_DISTDIR ?? '.next',
    typescript: typescriptConfig(env),
    images: { unoptimized: true },
    // The footer's year, inlined at build so the prerender and the browser render the same text.
    env: { NEXT_PUBLIC_BUILD_YEAR: String(now.getFullYear()) },
    // The repository's agent files are written by hand: `next dev` must not generate an AGENTS.md.
    agentRules: false,
    ...(turbopack ? { reactCompiler: true } : {}),
    experimental: {
      agentUpgrade: 'latest',
      ...(turbopack
        ? {
            turbopackRustReactCompiler: true,
            turbopackGc: true,
            turbopackLazyDynamicImports: true,
          }
        : {}),
    },
  };
}
