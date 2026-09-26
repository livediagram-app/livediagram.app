// Guest REST signature gate (docs/specs/015-api/public-api-and-tokens.md §4).
//
// The guest `X-Owner-Id` header is a bearer value that leaks to collaborators
// (presence frames, the change-log), and the REST path trusted it with no
// proof — so a harvested id (a guest UUID, OR a signed-up user's Clerk `sub`
// presented via the header fallback) could be used to act as that owner. The
// fix: on owner-scoped routes, a presented `X-Owner-Id` must carry a valid
// HMAC signature (`X-Owner-Sig`, verified against `GUEST_ID_HMAC_SECRET` via
// auth/owner-signature.ts). The legitimate guest holds its signature; a
// harvester does not.
//
// Rollout is gated so legacy unsigned guests aren't locked out (docs/specs/015-api/public-api-and-tokens.md §4
// "Compatibility"): enforcement is OFF until the operator sets an explicit
// cutoff, giving active guests time to self-heal to a signed id first.

type SigEnv = { GUEST_ID_HMAC_SECRET?: string; GUEST_SIG_ENFORCE_AFTER?: string };

// Whether the signature is required yet. OFF when there's no secret (self-host
// opt-out, like the rest of the guest-signing model) OR no cutoff is set, OR
// the cutoff is still in the future (the grace window). The operator sets
// GUEST_SIG_ENFORCE_AFTER (epoch ms) to a past time to turn it on.
export function guestSignatureEnforced(env: SigEnv, now: number): boolean {
  if (!env.GUEST_ID_HMAC_SECRET) return false;
  if (!env.GUEST_SIG_ENFORCE_AFTER) return false;
  const cutoff = Number(env.GUEST_SIG_ENFORCE_AFTER);
  return Number.isFinite(cutoff) && now >= cutoff;
}

// A Clerk user id presented as a GUEST header, which is never legitimate.
//
// The guest credential is always a UUID: the server mints it at POST
// /api/guest-id with `crypto.randomUUID()`, and the editor's local-identity
// store only ever writes a UUID into `X-Owner-Id` (it sends `Authorization`
// instead, never both, once Clerk resolves a token). A Clerk `sub` therefore
// only reaches this header when someone is replaying an account id they
// harvested — and Clerk ids are harvestable by design: `GET /api/teams/<id>`
// lists `members[].userId` to every member of the team.
//
// Without this check, that replay is a credential for the victim's PERSONAL
// diagrams, whose ownership legitimately resolves through the hybrid header
// path (a personal owner id is normally an unguessable UUID, which is what
// makes that path safe — an account id is not). The team-diagram half of the
// same hole is closed structurally in routes/context.ts `ownsDiagram`.
//
// Unlike the signature gate below this is ALWAYS on: it rejects a shape that
// no real client sends, so there's no legacy caller to grandfather in and
// nothing for an operator to roll out.
export function isClerkIdShape(ownerId: string): boolean {
  return ownerId.startsWith('user_');
}

// Resource segments whose access is keyed on the resolved owner id, so a
// guest-path request to them must prove possession of that id once enforcement
// is on. Public / auth-bootstrap routes are deliberately excluded: `guest-id`
// (mints the id), `share` (share-code gated), `migrate` (verifies its own
// signature), `events` / `telemetry` / `capabilities` / `unfurl` (no owner),
// and the Clerk-only `account` / `teams` / `tokens`.
export const OWNER_SCOPED_SEGMENTS = new Set([
  'diagrams',
  'folders',
  'images',
  'custom-themes',
  'participants',
  'preferences',
  'shared',
  // The feed is keyed on the resolved owner id and returns diagram
  // names + comment text, so a harvested guest id must not read it.
  'timeline',
  // Same shape as the timeline: actions + comment threads (names, text)
  // keyed on the resolved owner, and the owner's starred diagrams.
  'activity',
  'favourites',
]);
