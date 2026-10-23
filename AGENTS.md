# AGENTS.md

The liveworkspace monorepo. Read README.md and docs/structure.md first.

- Each product folder (`livediagram/`, `liveplanner/`) has its own AGENTS.md with that
  product's rules. They still apply, but read their `apps/…` and `packages/…` paths as relative
  to the product folder.
- One pnpm workspace and lockfile at the root. Add dependencies with
  `corepack pnpm --filter <package> add …`, never with a nested install.
- Never push without the owner's explicit say-so. liveworkspace and liveplanner share the
  liveworkspace Cloudflare account (`851be7d244b76a6557bcbe6c4ded80f5`), which also holds
  liveplanner.app; each of their `wrangler.toml` files pins it as `account_id`.
- Code both products need goes in `packages/` as `@liveworkspace/*`. Don't copy it into a
  product, and don't add a third copy of something that already exists in both. Follow the
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

  Each product's router (or the liveworkspace site) takes the first port of its block, and its
  other apps the next ones. If a port is taken, find what holds it rather than shifting into
  another product's block.

- The product folders came in with `git subtree add`. Until the switch-over, refresh them with
  `git subtree pull` rather than editing both sides by hand.
