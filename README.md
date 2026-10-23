# liveworkspace

The monorepo for liveworkspace and its products, livediagram, liveplanner, livedocuments and
livedesign, plus what they share.

```
packages/        shared by every product (@liveworkspace/*)
liveworkspace/   the platform's own apps: the liveworkspace.app site, accounts (sign-in), telemetry and Community
livediagram/     livediagram.app
liveplanner/     liveplanner.app
livedocuments/   livedocuments.app: articles, slides and infographics
livedesign/      livedesign.app: logos, wireframes and photos
docs/            how this repo is laid out and where it's heading
```

Read [docs/structure.md](docs/structure.md) first: it covers what's shared, what isn't yet, and
the order things are moving in.

## Working in it

One pnpm workspace and one lockfile, at the root. Node 22+, pnpm via corepack.

```sh
corepack pnpm install
corepack pnpm dev:diagram        # livediagram's apps
corepack pnpm dev:planner        # liveplanner's apps
corepack pnpm dev:documents      # livedocuments' apps, on the 33xx ports
corepack pnpm dev:design         # livedesign's apps, on the 34xx ports
corepack pnpm dev:workspace      # liveworkspace.app on :3000, with its five APIs behind it
corepack pnpm dev:site           # liveworkspace.app's pages alone on :3000
corepack pnpm dev:accounts       # the accounts API alone on :8787
corepack pnpm dev:telemetry      # the telemetry API alone on :8790
corepack pnpm dev:community      # the Community API alone on :8791
corepack pnpm dev:media          # the media API alone on :8792
corepack pnpm dev:index          # the index API (One Explorer) alone on :8793
corepack pnpm typecheck          # everything; or inside a product folder, just that product
```

Each product folder keeps its own scripts (`cd livediagram && corepack pnpm test` runs only
livediagram's tests), its own docs, and its own AGENTS.md for product-specific rules.

## Deploys

Nothing deploys from here yet. livediagram still deploys from its own repo, and liveplanner from
its own, now to the liveworkspace Cloudflare account it shares with liveworkspace. livedocuments and livedesign have never been deployed and have no
Cloudflare resources yet. The switch is described in docs/structure.md.
