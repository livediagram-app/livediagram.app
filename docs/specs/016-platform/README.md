# Platform

Follow the references below only as needed; never upfront.

- ./router-app.md - when working on Router app: Path-based routing across apps (`/` → marketing; `/document`, `/explorer`, `/new`, ... → editor)
- ./deployment.md - when working on Deployment: GitHub Actions → Cloudflare Workers pipeline for all eight workers
- ./staging-environment.md - when working on Staging environment: A second complete copy of the platform at staging.livediagram.app, deployed automatically on every green CI run on `main` while production stays manual. Its own D1 / R2 / KV so a migration runs against a real remote database one deploy before it reaches the one holding people's documents. Wrangler `[env.staging]` blocks (bindings are NOT inherited, so each restates its app in full), noindex set once at the router rather than threaded through five static builds, and one reusable workflow body both environments call so the two deploys cannot drift
- ./pr-previews.md - when working on per-PR preview environments: pr-<N>.livediagram.app on every same-repo PR (frontends on staging's api), a full stack with its own api, D1 and R2 behind the `full-preview` label, config generated from `[env.staging]`, teardown on close plus a daily sweeper
- ./new-version-prompt.md - when working on the document format number or the "A new version of livediagram is ready" reload prompt an editor shows when the server serves a newer document format
- ./stale-builds.md - when working on a tab left on an older build after a deploy: never-stale HTML and immutable assets, a pre-boot guard for stale pages, the live build id on the server release signal, full page loads instead of client navigation while stale, and the chunk-load safety net with its loop guard
- ./web-performance.md - when adding to what a page loads up front (a static import, a provider, a stylesheet, a catalogue), a timer or a public read: first-load budgets per page, lazy surfaces, non-blocking fonts, query plans that start from the person's own rows
- ./nextjs.md - when upgrading Next.js or React, changing a `next.config.ts` or `@livediagram/next-config`, or weighing a Next.js feature: versions, the one shared configuration, the Turbopack cache, features used and declined
- ./secure-context.md - when an API is secure-context only (`crypto.randomUUID`, `crypto.subtle`, the clipboard) or the editor runs in an embed on an http page or a self-hosted http instance: the randomUUID boot shim, the SHA-256 fallback and what still needs HTTPS
- ./trusted-types.md - when adding `dangerouslySetInnerHTML`, an inline script, a third-party script or a response header: the enforced Trusted Types header, the two policies, third parties and violations
- ./blueprints/README.md - when implementing or changing a platform feature from its blueprint
