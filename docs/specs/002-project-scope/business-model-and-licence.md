# Business model + licence

liveplanner is **proprietary software** run as one hosted service at [liveplanner.app](https://liveplanner.app) (not deployed yet). It is **free to use**: there is no paid tier and no plan to introduce one. Its source is not public.

## Licence

The codebase is **all rights reserved** (see `LICENSE` at the repo root). It is not open source: the source code is private, not published and not licensed for anyone to copy, modify, redistribute or deploy. Every `package.json` declares `"license": "UNLICENSED"`, including the packages published for people to run (the `liveplanner` CLI and the MCP server's registry entry, `server.json`), which are free to install and use but stay proprietary.

Third-party components keep their own licences. The MIT, Apache and other permissively licensed work the apps bundle requires attribution, so it is credited on the generated `/licences` page and in `THIRD_PARTY_NOTICES.md` ([Third-party licences](third-party-licences.md)).

## Distribution model

- **One hosted service.** liveplanner.app (with `mcp.liveplanner.app` for AI tools) is the only way people use liveplanner. It is free for everyone, with no tiers.
- **Published tools.** The CLI on npm and the MCP server listing are free to use against the hosted service; their published metadata carries no repository or homepage link to source code.

## What we promise people

These are the claims the product makes about itself, and each holds without anyone reading the code:

- **Free.** Every feature is available to every user, at no cost.
- **No trackers and no ads.** No third-party analytics, advertising or tracking scripts; product telemetry is anonymous and published on the public dashboard ([Telemetry](../017-telemetry/telemetry.md)).
- **Real-time collaboration** for everyone, signed in or not ([Auth + guest access](../014-identity/auth-and-guest-access.md)).
- **Your data is yours to take.** Projects export in open formats, and the Privacy Policy says what is stored and why.

## Implications for how we build

- **No paid-tier shims.** The codebase contains no "Pro features" feature-flag, no billing integration (no Stripe), no "upgrade" CTAs. If we ship it, every user gets it.
- **Optional integrations degrade, never break.** Each SaaS integration is gated on its own key: Clerk for auth ([Auth + guest access](../014-identity/auth-and-guest-access.md)), Resend for email ([Transactional & lifecycle email (Resend)](../014-identity/transactional-email.md)), and a model provider for the AI assistant ([AI Assistance](../007-editor/ai-assistance.md)). When `CLERK_JWKS_URL` / `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` aren't set (local development, previews), the api worker and live frontend degrade to pure-guest mode and the editor is fully usable.
- **Secrets stay out of source** even though the repository is private ([Secrets policy](secrets-policy.md)).

## Non-goals

- No paid tier, subscription, bounty or upsell.
- No public source, public issue tracker or outside contributions.
- This spec does not yet cover trademark or the "liveplanner" name (to be decided).
