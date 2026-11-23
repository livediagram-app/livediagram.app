# Business model + licence

liveplanner is **MIT-licensed software** run as one hosted service at [liveplanner.app](https://www.liveplanner.app) It is **free to use**. The hosted service can also sell **Pro**, a subscription that raises limits, when a deployment turns it on ([Subscription](../../../../liveworkspace/docs/specs/019-subscription/subscription.md)). It is off by default: a self-hosted copy has no tiers. It is **open source**, like every liveworkspace app (owner, 2026-11-10): the source is public in the liveworkspace monorepo, and the site footer links it.

## Licence

The codebase is **MIT licensed** (see `LICENSE` at the repo root), like the other liveworkspace apps; the site footer says "MIT licensed." Every `package.json` declares `"license": "MIT"`, including the packages published for people to run (the `liveplanner` CLI and the MCP server's registry entry, `server.json`). The repository (the liveworkspace monorepo) is public.

Third-party components keep their own licences. The MIT, Apache and other permissively licensed work the apps bundle requires attribution, so it is credited on the generated `/licences` page and in `THIRD_PARTY_NOTICES.md` ([Third-party licences](third-party-licences.md)).

## Distribution model

- **One hosted service.** liveplanner.app (with `mcp.liveplanner.app` for AI tools) is the only way people use liveplanner. It is free for everyone to use; Pro, where it is on, raises limits for those who subscribe.
- **Published tools.** The CLI on npm and the MCP server listing are free to use against the hosted service; their published metadata carries no repository or homepage link to source code.

## What we promise people

These are the claims the product makes about itself, and each holds without anyone reading the code:

- **Free to use.** Every feature works on Free, with smaller limits on a few ([Subscription](../../../../liveworkspace/docs/specs/019-subscription/subscription.md) "Tiers and limits"). Pro raises limits; it never takes a feature away from someone who had it.
- **No trackers and no ads.** No third-party analytics, advertising or tracking scripts; product telemetry is anonymous and published on the public dashboard ([Telemetry](../017-telemetry/telemetry.md)).
- **Real-time collaboration** for everyone, signed in or not ([Auth + guest access](../014-identity/auth-and-guest-access.md)).
- **Your data is yours to take.** Projects export in open formats, and the Privacy Policy says what is stored and why.

## Implications for how we build

- **Pro is one flag, off by default, and the platform's.** Tiers, billing and upgrade prompts live in the subscription service and `@liveworkspace/subscription`, behind `PRO_ENABLED` ([Subscription](../../../../liveworkspace/docs/specs/019-subscription/subscription.md)). With it off the app shows no Pro UI and imposes no tier limit. The product keeps no billing code and no copy of who is subscribed, and every tier limit is checked on the server, against the item's owner.
- **Optional integrations degrade, never break.** Each integration is gated on its own key or binding: the liveworkspace accounts Worker for sign-in ([Auth + guest access](../014-identity/auth-and-guest-access.md)) and Cloudflare Email Service's `EMAIL` binding for email ([Transactional email](../014-identity/transactional-email.md)). The editor always offers sign-in; when the api's `ACCOUNTS_URL` / `API_RESOURCE` aren't set (local development, previews), every visitor settles as a guest and the editor is fully usable.
- **Secrets stay out of source**, and the repository is public, so its history is readable by anyone ([Secrets policy](secrets-policy.md)).

## Non-goals

- No bounty, no advertising, and no upsell beyond the one upgrade prompt an owner sees at a limit.
- No public source, public issue tracker or outside contributions.
- Trademark and the "liveplanner" name are outside this spec.
