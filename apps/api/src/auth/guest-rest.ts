// Guest REST signature gate (spec/61 §4).
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
// Rollout is gated so legacy unsigned guests aren't locked out (spec/61 §4
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
]);
