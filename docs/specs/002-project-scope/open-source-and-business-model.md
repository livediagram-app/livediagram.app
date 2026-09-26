# Open source + distribution

livediagram is **open source software** with one official hosted deployment alongside the self-host path. There is no paid tier and no plan to introduce one.

## License

The codebase is licensed under **MIT** (see `LICENSE` at the repo root). Permissive on purpose: anyone may self-host, fork, modify, embed, or build derivative works, commercial or not. No copyleft.

## Distribution model

There are two ways people use livediagram:

1. **Self-hosted.** Clone the repo, deploy it, run it on their own Cloudflare account (or anywhere the apps are runnable). Gets every feature in the OSS codebase. No subscription, no license check, no SaaS dependency required (Clerk is optional, see [04](../014-identity/auth-and-guest-access.md)).
2. **Hosted by livediagram.** The official deployment at livediagram's domain. Free for everyone, no tiers.

Both paths get the same feature set. The hosted version is a convenience (and a place for the project to live publicly); it is not a commercial product.

## Implications for how we build

- **No license checks.** Don't gate any feature behind a server call, license string, or runtime telemetry that breaks self-hosting.
- **No paid-tier shims.** The codebase contains no "Pro features" feature-flag, no billing integration (no Stripe), no "upgrade" CTAs. If we ship it, every user gets it.
- **Optional SaaS, not required SaaS.** Clerk auth is optional: when `CLERK_JWKS_URL` / `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` aren't set, the api worker and live frontend degrade to pure-guest mode and the editor is fully usable. A self-hoster who wants zero outbound runtime traffic (besides Cloudflare) can run that configuration.
- All design decisions assume the codebase is visible to the public, which constrains how we handle [secrets](secrets-policy.md).

## What this means for contributors

- External contributors can use, modify, and ship livediagram however they want.
- Contributions back to the project are welcome under the same MIT license.
- This spec does not yet cover trademark, the "livediagram" name, or hosted-service branding (to be decided).
