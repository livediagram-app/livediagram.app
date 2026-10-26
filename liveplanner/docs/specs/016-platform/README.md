# Platform

Follow the references below only as needed; never upfront.

- ./router-app.md - when working on the router: path-based routing across the apps (`/` to marketing; `/project`, `/new`, ... to the editor; `/api` to the api) and to liveworkspace's services
- ./deployment.md - when working on deployment: the root workflows that deploy liveplanner's six Workers, the deploy order, the hosted profile, hostnames
- ./staging-environment.md - when working on the staging environment: staging.liveplanner.app, deployed after every passing CI run on `main`; `[env.staging]` blocks that restate every binding, its own Durable Objects and KV, staging liveworkspace, noindex at the router
- ./new-version-prompt.md - when working on the project format number or the "A new version of liveplanner is ready" reload prompt an editor shows when the server serves a newer project format
- ./stale-builds.md - when working on a tab left on an older build after a deploy: never-stale HTML and immutable assets, a pre-boot guard for stale pages, the live build id on the server release signal, full page loads instead of client navigation while stale, and the chunk-load safety net with its loop guard
- ./web-performance.md - when adding to what a page loads up front (a static import, a provider, a stylesheet, a catalogue), a timer or a public read: first-load budgets per page, lazy surfaces, non-blocking fonts, query plans that start from the person's own rows
- ./nextjs.md - when upgrading Next.js or React, changing a `next.config.ts` or `@liveworkspace/next-config`, or weighing a Next.js feature: versions, the one shared configuration, the Turbopack cache, features used and declined
- ./secure-context.md - when an API is secure-context only (`crypto.randomUUID`, `crypto.subtle`, the clipboard) or the editor runs in an embed on an http page or a plain-http instance: the randomUUID boot shim, the SHA-256 fallback and what still needs HTTPS
- ./trusted-types.md - when adding `dangerouslySetInnerHTML`, an inline script, a third-party script or a response header: the enforced Trusted Types header, the two policies, third parties and violations
- ./blueprints/README.md - when implementing or changing a platform feature from its blueprint
