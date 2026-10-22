# AGENTS.md

The liveworkspace monorepo. Read README.md and docs/structure.md first.

- Each product folder (`livediagram/`, `liveplanner/`) has its own AGENTS.md with that
  product's rules. They still apply, but read their `apps/…` and `packages/…` paths as relative
  to the product folder.
- One pnpm workspace and lockfile at the root. Add dependencies with
  `corepack pnpm --filter <package> add …`, never with a nested install.
- Never push without the owner's explicit say-so, and never deploy liveplanner or create
  Cloudflare resources for it (it lives on a separate account).
- Code both products need goes in `packages/` as `@liveworkspace/*`. Don't copy it into a
  product, and don't add a third copy of something that already exists in both. Follow the
  order in docs/structure.md.
- The product folders came in with `git subtree add`. Until the switch-over, refresh them with
  `git subtree pull` rather than editing both sides by hand.
