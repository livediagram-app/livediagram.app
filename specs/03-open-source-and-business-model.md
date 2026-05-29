# Open source + business model

livediagram is **open source software** and also operates as a **commercial hosted product**.

## License

The codebase is licensed under **MIT** (see `LICENSE` at the repo root). Permissive on purpose: anyone may self-host, fork, modify, embed, or build derivative works — commercial or not. No copyleft.

## Distribution model

There are two ways people use livediagram:

1. **Self-hosted.** Clone the repo, deploy it, run it on their own Cloudflare account (or anywhere the apps are runnable). Gets every feature in the OSS codebase. No subscription needed.
2. **Hosted by livediagram.** The official deployment at livediagram's domain. Free tier available. A **Pro subscription** unlocks additional benefits on the hosted version.

## Pro subscription

Pro is a feature of the **hosted** product, not the codebase.

- **Specific Pro benefits are not yet defined.** This spec will be updated as they're nailed down.
- Likely candidates (placeholders, not commitments): higher diagram counts, team workspaces beyond a free limit, advanced export formats, support, priority real-time infrastructure.
- Pro is paid via Stripe (see future spec).

## Implications for how we build

- **No OSS-killing hooks.** Don't gate the core editor experience behind a license check, server call, or telemetry that breaks self-hosting.
- **Pro features should be cleanly separable.** Either feature-flagged at build/runtime, or implemented as hosted-only infrastructure (e.g. shared cloud storage, billing). A self-host build should run cleanly without Pro code paths failing.
- **No proprietary "premium" code mixed in with OSS code.** If a feature isn't in the repo, it isn't in the OSS distribution. Don't push half-built Pro features to the public repo unless the OSS side stands on its own.
- All design decisions assume the codebase is visible to the public — this constrains how we handle [secrets](06-secrets-policy.md).

## What this means for contributors

- External contributors can use, modify, and ship livediagram however they want.
- Contributions back to the project are welcome under the same MIT license.
- This spec does not yet cover trademark, the "livediagram" name, or hosted-service branding — to be decided.
