# Platform

Follow the references below only as needed; never upfront.

- ./router-app.md - when working on Router app: Path-based routing across apps (`/` → marketing; `/document`, `/explorer`, `/new`, ... → editor)
- ./deployment.md - when working on Deployment: GitHub Actions → Cloudflare Workers pipeline for all seven workers
- ./staging-environment.md - when working on Staging environment: A second complete copy of the platform at staging.livediagram.app, deployed automatically on every green CI run on `main` while production stays manual. Its own D1 / R2 / KV so a migration runs against a real remote database one deploy before it reaches the one holding people's documents. Wrangler `[env.staging]` blocks (bindings are NOT inherited, so each restates its app in full), noindex set once at the router rather than threaded through four static builds, and one reusable workflow body both environments call so the two deploys cannot drift
- ./new-version-prompt.md - when working on the document format number or the "A new version of livediagram is ready" reload prompt an editor shows when the server serves a newer document format
- ./blueprints/README.md - when implementing or changing a platform feature from its blueprint
