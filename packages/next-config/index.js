/**
 * Shared Next.js settings for every Next app in the monorepo: each product's editor, help and marketing apps
 * (and livediagram's community app), and liveworkspace's site.
 * See a product's docs/specs/003-system-architecture/e2e-smoke.md "Cost controls".
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
 * adds only what is its own. The Turbopack flags come only under Turbopack. The React Compiler (Rust port, which
 * throws under webpack) runs only for an app that asks for it (`reactCompiler`): the editor, whose surfaces re-render
 * constantly; on mostly static pages it costs first-load JavaScript and buys little.
 *
 * @param {{ env?: NodeJS.ProcessEnv, exportInDev?: boolean, reactCompiler?: boolean, now?: Date }} [options]
 * @returns {import('next').NextConfig}
 */
// The hosts the routers forward as in local dev (each product's wrangler.toml routes), and their subdomains.
export const DEV_ORIGINS = [
  'livediagram.app',
  'liveplanner.app',
  'livedocuments.app',
  'livedesign.app',
  'livehuddle.app',
  'liveworkspace.app',
]
  .flatMap((host) => [host, `*.${host}`])
  .concat(['localhost', '127.0.0.1']);

export function liveworkspaceNextConfig({
  env = process.env,
  exportInDev = true,
  reactCompiler = false,
  now = new Date(),
} = {}) {
  const exporting = exportInDev || env.NODE_ENV === 'production';
  const turbopack = isTurbopack(env);
  const compiler = turbopack && reactCompiler;
  console.log(`[next-config] turbopack=${turbopack} export=${exporting} compiler=${compiler}`);
  return {
    ...(exporting ? { output: 'export' } : {}),
    // Dev builds into its own directory: `scripts/next-dev.mjs` sets NEXT_DISTDIR=.next-dev, so a `next build` running
    // anywhere in the checkout (repo-root `pnpm build`, a turbo task) cannot overwrite the dev server's
    // `_buildManifest.js.tmp.*` mid-flight (the ENOENT 500s that left the help centre unstyled). Build and CI leave it
    // unset and keep `.next`.
    distDir: env.NEXT_DISTDIR ?? '.next',
    typescript: typescriptConfig(env),
    images: { unoptimized: true },
    // Locally each product's router (wrangler dev, on the first port of its block) proxies the editor and forwards
    // the request as its production host, so `next dev` sees the hot-reload socket come from liveplanner.app and,
    // since Next 16, refuses it as cross-origin. The editor then never starts (a page stuck on "Creating your plan").
    // Dev only: production builds ignore it.
    allowedDevOrigins: DEV_ORIGINS,
    // The footer's year, inlined at build so the prerender and the browser render the same text.
    env: { NEXT_PUBLIC_BUILD_YEAR: String(now.getFullYear()) },
    // The repository's agent files are written by hand: `next dev` must not generate an AGENTS.md.
    agentRules: false,
    ...(compiler ? { reactCompiler: true } : {}),
    experimental: {
      agentUpgrade: 'latest',
      ...(compiler ? { turbopackRustReactCompiler: true } : {}),
      // No turbopackLazyDynamicImports: in dev it left dynamic imports without their chunk (a ChunkLoadError,
      // docs/specs/016-platform/nextjs.md).
      ...(turbopack ? { turbopackGc: true } : {}),
    },
  };
}
