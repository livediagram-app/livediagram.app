# Open source + distribution

livedesign is **open source software** with one official hosted deployment at livedesign.app. There is no paid tier and no plan to introduce one.

## License

The codebase is licensed under **MIT** (see `LICENSE` at the repo root). Permissive on purpose: anyone may fork, modify, embed, or build derivative works, commercial or not. No copyleft.

The third-party work the apps ship is credited on the generated `/licences` page ([Third-party licences](third-party-licences.md)).

## Distribution model

People use livedesign at the official deployment, [livedesign.app](https://livedesign.app). It is free for everyone, with no tiers, and it is not a commercial product.

## Implications for how we build

- **No license checks.** Don't gate any feature behind a server call, license string, or runtime telemetry that a deployment cannot do without.
- **No paid-tier shims.** The codebase contains no "Pro features" feature-flag, no billing integration (no Stripe), no "upgrade" CTAs. If we ship it, every user gets it.
- **Optional SaaS, not required SaaS.** The OSS core never calls home. Its SaaS integrations are all optional, each gated on its own key: the liveworkspace accounts Worker for sign-in ([Auth + guest access](../014-identity/auth-and-guest-access.md)), Resend for email ([Transactional & lifecycle email (Resend)](../014-identity/transactional-email.md)), and a model provider for the AI assistant ([AI Assistance](../007-editor/ai-assistance.md)). When the sign-in settings (`ACCOUNTS_URL` / `API_RESOURCE` on the api, `NEXT_PUBLIC_SIGN_IN_ENABLED` on the live build) aren't set, the api worker and live frontend degrade to pure-guest mode and the editor is fully usable. With all three unset there is no server-side outbound traffic besides Cloudflare; the browser still fetches the editor's typefaces from Google Fonts ([Fonts](../004-interface-design/fonts.md)).
- All design decisions assume the codebase is visible to the public, which constrains how we handle [secrets](secrets-policy.md).

## What this means for contributors

- External contributors can use, modify, and ship livedesign however they want.
- Contributions back to the project are welcome under the same MIT license.
- This spec does not yet cover trademark, the "livedesign" name, or hosted-service branding (to be decided).
