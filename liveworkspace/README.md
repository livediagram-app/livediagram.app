# liveworkspace

The platform every liveworkspace app stands on: one account, one Explorer, and the services every app
shares, all on liveworkspace.app. The apps (livediagram, liveplanner, livedocuments, livedesign) keep only
thin, app-specific doors onto them.

**Specs first.** What the platform is and how it works lives in [docs/specs](docs/specs/README.md), one
category per service, each with blueprints that hold the implementation detail. A platform change updates the
spec first, then its blueprint, then the code ([AGENTS.md](AGENTS.md)).

```
apps/site              liveworkspace.app: every page, the Explorer, Settings, the telemetry dashboard, status (a Next static export)
apps/accounts          /api/auth and /api/account: sign-in, sessions, teams, API tokens, guests, settings, profiles, email
apps/index             /api/index: the One Explorer's index (items, folders, sharing, Inbox, Timeline, Trash, grants)
apps/drive             /api/drive: the Google Drive mirror, for every app
apps/media             /api/media and /api/previews: every app's images, and its previews and share cards
apps/community         /api/community: every app's Community listings
apps/telemetry         /api/telemetry: every app's anonymous events
apps/status            /api/status: hourly checks of every service, 90 days kept
apps/migrate           the one-off move from the historical livediagram.app, run from a laptop, never deployed
packages/status        @liveworkspace/status: the one list of services and how an answer is judged
docs/specs             the specs and blueprints
plans                  plans for work in progress
```

The services' contracts and clients that apps import are in the root `packages/` (`@liveworkspace/auth-client`,
`index-client`, `index-app`, `explorer`, `drive`, `media`, `community`, `telemetry`, `settings`, `sites` and the
rest; [docs/structure.md](../docs/structure.md) at the repository root lists them).

Every service is a Worker on a path route of liveworkspace.app (and `staging.liveworkspace.app`), on the
liveworkspace Cloudflare account, so the pages call them on their own origin. Each app's router forwards the
shared paths (`/explorer`, `/api/index`, `/api/previews`, `/api/workspace/…`) on its own address. CI deploys every
Worker ([docs/ci.md](../docs/ci.md#deploys) at the repository root).

## Local development

```sh
corepack pnpm install
cd apps/accounts
cp .dev.vars.example .dev.vars
corepack pnpm db:migrate:local
cd ../..
corepack pnpm dev:workspace           # http://localhost:3000/sign-in
```

`dev:workspace` runs the site on 3000 with its seven services behind it: accounts (8787), telemetry (8790),
Community (8791), media (8792), the index (8793), status (3010) and Drive (3011). The site's dev server forwards
each service's paths to it (`apps/site/next.config.ts`), so the pages and the APIs share one origin, as on
liveworkspace.app. That origin, `http://localhost:3000`, is the accounts Worker's `BASE_URL` and the issuer apps
check locally. Each service's first-time local setup (a `.dev.vars`, `db:migrate:local`) is in its spec.

A local D1 database built before a migration was added misses its tables: run `corepack pnpm db:migrate:local`
in the service's folder again. If a local database is past repair, remove its state
(`rm -rf apps/<service>/.wrangler/state/v3/d1`) and migrate again, which drops its local rows.

Locally, emails aren't sent. Each code email is printed in the accounts Worker's output. Turnstile
uses Cloudflare's always-pass test keys.

To run the whole sign-in flow (register a client, request and enter a code, swap it, verify, sign in again
without a code, refresh, start a Google sign-in, close an account) through the site's origin, with
the site's dev server running and the accounts Worker's output in a file:

```sh
corepack pnpm dev > dev.log 2>&1 &   # in apps/accounts
DEV_LOG=dev.log corepack pnpm e2e:local
```

Other checks, from the repo root: `corepack pnpm test`, `corepack pnpm typecheck`, `corepack pnpm lint`.

## Adding an app

Register its OAuth client and add its API resource
([docs/specs/003-accounts/sign-in.md](docs/specs/003-accounts/sign-in.md#registering-an-app)), then wire it to
every service ([docs/specs/002-architecture/integrating-an-app.md](docs/specs/002-architecture/integrating-an-app.md)).
