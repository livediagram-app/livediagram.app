# Open source + distribution

liveknowledge is **open source software** with one official hosted deployment at liveknowledge.app. The hosted service can also sell **Pro**, a subscription that raises limits, when a deployment turns it on ([Subscription](../../../../liveworkspace/docs/specs/019-subscription/subscription.md)). It is off by default: a self-hosted copy has no tiers.

## License

The codebase is licensed under **MIT** (see `LICENSE` at the repo root). Permissive on purpose: anyone may fork, modify, embed, or build derivative works, commercial or not. No copyleft.

The third-party work the apps ship is credited on the generated `/licences` page ([Third-party licences](third-party-licences.md)).

## Distribution model

People use liveknowledge at the official deployment, [liveknowledge.app](https://www.liveknowledge.app). It is free for everyone to use; Pro, where it is on, raises limits for those who subscribe. We don't publish guidance for running other copies of it.

## Implications for how we build

- **No license checks.** Don't gate any feature behind a license string or runtime telemetry that a feature depends on. The one server check a feature may make is its owner's tier limit, and only with Pro on.
- **Pro is one flag, off by default, and the platform's.** Tiers, billing and upgrade prompts live in the subscription service and `@liveworkspace/subscription`, behind `PRO_ENABLED` ([Subscription](../../../../liveworkspace/docs/specs/019-subscription/subscription.md)). With it off the app shows no Pro UI and imposes no tier limit. The product keeps no billing code, and no feature is Pro-only: if we ship it, it works on Free.
- **Optional SaaS, not required SaaS.** The OSS core never calls home. Its SaaS integrations are all optional, each gated on its own setting: the liveworkspace accounts Worker for sign-in ([Auth + guest access](../014-identity/auth-and-guest-access.md)) and Cloudflare Email Service for email, switched on by the api's `EMAIL` binding ([Transactional email](../014-identity/transactional-email.md)). When the api's sign-in settings (`ACCOUNTS_URL` / `API_RESOURCE`) aren't set, the api worker degrades to pure-guest mode and the editor is fully usable; the editor always offers sign-in, which then answers that it isn't configured.
- All design decisions assume the codebase is visible to the public, which constrains how we handle [secrets](secrets-policy.md).

## What this means for contributors

- External contributors can use, modify, and ship liveknowledge however they want.
- Contributions back to the project are welcome under the same MIT license.
- This spec does not yet cover trademark, the "liveknowledge" name, or hosted-service branding (to be decided).
