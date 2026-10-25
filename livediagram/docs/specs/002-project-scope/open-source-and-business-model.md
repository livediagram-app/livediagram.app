# Open source + distribution

livediagram is **open source software** with one official deployment, livediagram.app. There is no paid tier and no plan to introduce one.

## License

The codebase is licensed under **MIT** (see `LICENSE` at the repo root). Permissive on purpose: anyone may fork, modify, embed, or build derivative works, commercial or not. No copyleft.

The third-party work the apps ship is credited on the generated `/licences` page ([Third-party licences](third-party-licences.md)).

## Distribution model

People use livediagram at [livediagram.app](https://livediagram.app), the official deployment. Free for everyone, no tiers. It is a place for the project to live publicly; it is not a commercial product. The code stays public so anyone can read and audit it.

## Implications for how we build

- **No license checks.** Don't gate any feature behind a server call, license string, or runtime telemetry check.
- **No paid-tier shims.** The codebase contains no "Pro features" feature-flag, no billing integration (no Stripe), no "upgrade" CTAs. If we ship it, every user gets it.
- **Optional SaaS, not required SaaS.** The OSS core never calls home. Its SaaS integrations are all optional, each gated on its own key or binding: the liveworkspace accounts Worker for sign-in ([Auth + guest access](../014-identity/auth-and-guest-access.md)), Cloudflare Email Service for email, gated on its `send_email` binding ([Transactional & lifecycle email](../014-identity/transactional-email.md)), and a model provider for the event-storming photo reader ([Note reader](../021-event-storming/note-reader.md)). The editor always offers sign-in; when the api's accounts settings (`ACCOUNTS_URL` / `API_RESOURCE`) aren't set, visitors have no identity and the editor still draws, keeping documents in This Browser ([Auth + guest access](../014-identity/auth-and-guest-access.md#sign-in-is-always-on)).
- All design decisions assume the codebase is visible to the public, which constrains how we handle [secrets](secrets-policy.md).

## What this means for contributors

- External contributors can use, modify, and ship livediagram however they want.
- Contributions back to the project are welcome under the same MIT license.
- This spec does not yet cover trademark, the "livediagram" name, or hosted-service branding (to be decided).
