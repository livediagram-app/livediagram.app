# liveworkspace

The monorepo for liveworkspace and its products, livediagram, liveplanner and livepages, plus what
they share.

```
packages/        shared by every product (@liveworkspace/*)
liveworkspace/   the platform's own apps: accounts (sign-in for every product)
livediagram/     livediagram.app
liveplanner/     liveplanner.app
livepages/       livepages.app: articles, slides, infographics, logos and wireframes
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
corepack pnpm dev:pages          # livepages' apps, on the 32xx ports
corepack pnpm dev:accounts       # accounts.liveworkspace.app on :8787
corepack pnpm typecheck          # everything; or inside a product folder, just that product
```

Each product folder keeps its own scripts (`cd livediagram && corepack pnpm test` runs only
livediagram's tests), its own docs, and its own AGENTS.md for product-specific rules.

## Deploys

Nothing deploys from here yet. livediagram still deploys from its own repo, and liveplanner from
its own (to its own Cloudflare account). livepages has never been deployed and has no Cloudflare
resources yet. The switch is described in docs/structure.md.
