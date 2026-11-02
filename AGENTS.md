# AGENTS.md

The liveworkspace monorepo. Read README.md and docs/structure.md first.

- Each product folder (`livediagram/`, `liveplanner/`, `livedocuments/`, `livedesign/`) and
  `liveworkspace/` has its own AGENTS.md with its rules. They apply, but read their `apps/…` and `packages/…` paths as relative
  to the product folder.
- One pnpm workspace and lockfile at the root. Add dependencies with
  `corepack pnpm --filter <package> add …`, never with a nested install.
- Never push without the owner's explicit say-so. Every Worker, the platform's and every product's,
  runs on the liveworkspace Cloudflare account (`851be7d244b76a6557bcbe6c4ded80f5`); each
  `wrangler.toml` pins it as `account_id`. Deploys, and the remote D1 migrations they apply, run only
  through CI (docs/ci.md "Deploys").
- Specs first, everywhere. A product change updates that product's `docs/specs/` first; a platform change
  (anything under `liveworkspace/` or a service's contract in `packages/`) updates
  [liveworkspace/docs/specs](liveworkspace/docs/specs/README.md) first, then its blueprint, then the code.
- Code two or more products need goes in `packages/` as `@liveworkspace/*`. Don't copy it into a
  product, and don't add another copy of something that already exists in two. Follow the
  order in docs/structure.md.
- When asked to run the apps locally, run each in its own port block, the same on every
  machine, so they never collide and their links to each other line up:

  | Product                       | Ports       |
  | ----------------------------- | ----------- |
  | liveworkspace                 | 3000 onward |
  | livediagram                   | 3100 onward |
  | liveplanner                   | 3200 onward |
  | livedocuments (was livepages) | 3300 onward |
  | livedesign                    | 3400 onward |
  | livehuddle                    | 3500 onward |

  Each product's router (or the liveworkspace site) takes the first port of its block, and its
  other apps the next ones. If a port is taken, find what holds it rather than shifting into
  another product's block.

- This monorepo is the one home of every product: their work, CI and deploys happen here. The product
  folders came in with `git subtree add` and keep their history; their own `.github/` folders are inert.
