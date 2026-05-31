# Auth + guest access

## Principle

**The canvas always works without signing in.** A first-time visitor can land on `/live`, create a diagram, build something real, and only later be asked to sign up. This is intentional — friction-free engagement is the acquisition strategy.

We don't put auth in front of the core experience. We add auth where it _enables_ something the user wants (sharing, syncing, collaborating, paying).

## Auth provider

**Clerk** is the chosen provider. It is **not** wired up yet — the api worker today is open and carries owner identity via an `X-Owner-Id` header (see [02-prototype-scope.md](02-prototype-scope.md) for current build-phase scope). Clerk lands once we're ready to gate sync/sharing behind a real account.

## Two modes

### Today (pre-Clerk)

The api is open. Owner identity is carried by the participant id minted on first visit (`livediagram:v2:self-id` in `localStorage`). With auth not wired, every user is effectively a guest and gets the **whole** feature set:

- Diagrams persist via the api worker (D1).
- Share links (`/api/share/:code`) — anyone with the link can view / edit.
- Real-time multiplayer collab via the per-diagram Durable Object room (see [11-api.md](11-api.md)).

The participant id is per-browser, not per-user, so a user clearing storage or switching devices is treated as a different "owner" and won't see the diagrams they made before. That's the gap Clerk closes.

### Future (post-Clerk)

Once Clerk lands, the line between guest and authenticated tightens:

| Capability                  | Guest                         | Authenticated                                                       |
| --------------------------- | ----------------------------- | ------------------------------------------------------------------- |
| Editing the canvas          | ✓                             | ✓                                                                   |
| Persistence                 | ✓ (per-browser, not per-user) | ✓ (per-account, syncs across devices)                               |
| Open a share link as viewer | ✓                             | ✓                                                                   |
| Open a share link as editor | ✓                             | ✓                                                                   |
| Mint a new share link       | (TBD — likely auth-gated)     | ✓                                                                   |
| Real-time presence          | ✓ on shared sessions          | ✓                                                                   |
| Team workspaces             | —                             | ✓                                                                   |
| Pro features                | —                             | ✓ (when Pro lands — see [03](03-open-source-and-business-model.md)) |

The principle stays the same: the **canvas itself** is always usable without signing in. Auth unlocks per-account persistence, team scoping, and billing — never gates a feature that doesn't actually need them.

## Guest → account migration

When a guest signs up, the diagrams they built locally should **migrate into their account** rather than being lost. They've already invested effort — losing it on sign-up would be the opposite of friction-free.

- On first authenticated session, detect local diagrams.
- Offer to import them into the account.
- Don't auto-delete the local copies until the import is confirmed.

## Implications for how we build

- UI must never block the canvas behind a sign-in wall.
- Features that genuinely need an account (Share, Invite, Sync) are surfaced as opt-in prompts: "Sign in to share this diagram" — not modal walls.
- The single persistence boundary (`apps/live/lib/api-client.ts` against the api worker — see [11-api.md](11-api.md)) is the same in guest and authenticated mode. Only the owner-id header changes: a `localStorage`-minted UUID for guests, a Clerk-verified user id once auth lands.
- Public client code that uses Clerk uses only the **publishable key** (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`), never the secret key. See [06-secrets-policy.md](06-secrets-policy.md).
