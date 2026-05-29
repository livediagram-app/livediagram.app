# Auth + guest access

## Principle

**The canvas always works without signing in.** A first-time visitor can land on `/live`, create a diagram, build something real, and only later be asked to sign up. This is intentional — friction-free engagement is the acquisition strategy.

We don't put auth in front of the core experience. We add auth where it _enables_ something the user wants (sharing, syncing, collaborating, paying).

## Auth provider

**Clerk** is the chosen provider. It is **not** part of the prototype (see [02-prototype-scope.md](02-prototype-scope.md)). Wiring it up comes after the prototype is solid.

## Two modes

### Guest mode (always available)

- No account required.
- Diagrams persist locally (prototype: `localStorage`; later: still locally on-device, even after auth lands).
- All core editing features work.
- No cloud sync, no sharing, no real-time collaboration — those need an account.

### Authenticated mode (post-Clerk)

Adds, on top of guest features:

- Cloud sync — diagrams travel across devices.
- Team workspaces and sharing.
- Real-time multiplayer collaboration.
- Profile / settings / billing (Pro — see [03-open-source-and-business-model.md](03-open-source-and-business-model.md)).

## Guest → account migration

When a guest signs up, the diagrams they built locally should **migrate into their account** rather than being lost. They've already invested effort — losing it on sign-up would be the opposite of friction-free.

- On first authenticated session, detect local diagrams.
- Offer to import them into the account.
- Don't auto-delete the local copies until the import is confirmed.

## Implications for how we build

- UI must never block the canvas behind a sign-in wall.
- Features that genuinely need an account (Share, Invite, Sync) are surfaced as opt-in prompts: "Sign in to share this diagram" — not modal walls.
- The store interface (`DiagramStore` per [02-prototype-scope.md](02-prototype-scope.md)) abstracts persistence so guest and authenticated modes use the same UI code, just different backing implementations.
- Public client code that uses Clerk uses only the **publishable key** (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`), never the secret key. See [06-secrets-policy.md](06-secrets-policy.md).
