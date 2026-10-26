# liveworkspace

The platform every app stands on: the services under `apps/`, deployed as Workers on liveworkspace.app, and the
shared contracts in the root `packages/`. Read [README.md](README.md) first, and the root
[AGENTS.md](../AGENTS.md), whose rules apply here too.

## Specs first

- What the platform is and how it works lives in [docs/specs](docs/specs/README.md), in the products' format: numbered
  category folders, a README index in each, and a `blueprints/` folder holding the blueprint, `DEFAULTS.md` and
  `COMPLETENESS.md`. [livediagram/AGENTS.md](../livediagram/AGENTS.md) "Specs" and "Blueprints" define the format;
  follow it here.
- A platform change (anything under `liveworkspace/`, or a service's contract in `packages/`) updates the spec first,
  then its blueprint, then the code, in the same change.
- If a spec and the code disagree, that is a bug: usually the spec is right; if not, fix the spec first.
- Specs are in the present tense and describe the design as it is. Git keeps the history.

## Services

- Each service's paths, bindings, crons and secrets are in its category's blueprint; how they fit together is
  [002-architecture](docs/specs/002-architecture/README.md).
- CI deploys every Worker and applies its D1 migrations before its code. Never deploy or apply a remote migration
  by hand: migrations run locally only (`wrangler d1 migrations apply --local`).
- Locally, the site takes port 3000 and the services keep their own ports (8787 and up, 3010, 3011), as the root
  AGENTS.md's port blocks require.
