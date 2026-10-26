# Open source + distribution

livedocuments is **open source software** with one official hosted deployment at livedocuments.app. There is no paid tier and no plan to introduce one.

## License

The codebase is licensed under **MIT** (see `LICENSE` at the repo root). Permissive on purpose: anyone may fork, modify, embed, or build derivative works, commercial or not. No copyleft.

The third-party work the apps ship is credited on the generated `/licences` page ([Third-party licences](third-party-licences.md)).

## Distribution model

People use livedocuments at the official deployment, [livedocuments.app](https://www.livedocuments.app). It is free for everyone, with no tiers, and it is not a commercial product. We don't publish guidance for running other copies of it.

## Implications for how we build

- **No license checks.** Don't gate any feature behind a server call, license string, or runtime telemetry that a feature depends on.
- **No paid-tier shims.** The codebase contains no "Pro features" feature-flag, no billing integration (no Stripe), no "upgrade" CTAs. If we ship it, every user gets it.
- **Optional SaaS, not required SaaS.** The OSS core never calls home. Its SaaS integrations are all optional, each gated on its own setting: the liveworkspace accounts Worker for sign-in ([Auth + guest access](../014-identity/auth-and-guest-access.md)) and Cloudflare Email Service for email, switched on by the api's `EMAIL` binding ([Transactional email](../014-identity/transactional-email.md)). When the api's sign-in settings (`ACCOUNTS_URL` / `API_RESOURCE`) aren't set, the api worker degrades to pure-guest mode and the editor is fully usable; the editor always offers sign-in, which then answers that it isn't configured.
- All design decisions assume the codebase is visible to the public, which constrains how we handle [secrets](secrets-policy.md).

## What this means for contributors

- External contributors can use, modify, and ship livedocuments however they want.
- Contributions back to the project are welcome under the same MIT license.
- This spec does not yet cover trademark, the "livedocuments" name, or hosted-service branding (to be decided).
