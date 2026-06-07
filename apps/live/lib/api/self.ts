// Participant / account calls: load self, save self, account self-
// deletion, and guest -> authed data migration.
import { dedupeInFlight } from '../dedupe';
import type { Participant } from '../identity';
import {
  API_BASE,
  apiHeaders,
  expectOkOrNull,
  expectOkVoid,
  type ParticipantResponse,
} from './core';

// Deduped by id: the editor's hydration effect AND /live/new's
// initial fetch both call this on first paint; React Strict Mode
// in dev doubles each. With dedup, all four collapse to one fetch
// when they land in the same tick.
async function _apiLoadSelf(id: string): Promise<Participant | null> {
  const res = await fetch(`${API_BASE}/participants/${id}`);
  const body = await expectOkOrNull<ParticipantResponse>(res, 'load self');
  if (!body) return null;
  const { participant } = body;
  return {
    id: participant.id,
    name: participant.name,
    color: participant.color,
    status: 'online',
  };
}
export const apiLoadSelf = dedupeInFlight(_apiLoadSelf, (id) => id);

// Account self-deletion (Clerk-only). Wipes the caller's diagrams,
// folders, and participant row server-side; the caller is expected
// to follow up with Clerk's `user.delete()` to drop the Clerk
// account itself. Order matters — backend first, then Clerk — so a
// Clerk-side failure doesn't leave the user without an account but
// with orphaned data. Returns the change counts on success or null
// on any non-2xx so the caller can decide whether to proceed with
// the Clerk delete.
export async function apiDeleteAccount(): Promise<{
  diagrams: number;
  folders: number;
} | null> {
  // ownerId arg is unused server-side for this endpoint (the
  // resolved Clerk id wins), but apiHeaders' signature wants
  // something — pass an empty string. The registered token
  // provider attaches the Bearer; the endpoint refuses if absent.
  const res = await fetch(`${API_BASE}/account`, {
    method: 'DELETE',
    headers: await apiHeaders(''),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { deleted: { diagrams: number; folders: number } };
  return body.deleted;
}

// Guest → authed ownership migration. Called once on first sign-in
// from editor-page.tsx + new/page.tsx when both conditions hold:
//   - the Clerk session is active (a Bearer token will be sent)
//   - `livediagram:v2:self-id` is still in localStorage
// On success the caller clears the localStorage id so subsequent
// loads use only the Clerk userId.
//
// The api worker (`POST /api/migrate` in `apps/api/src/index.ts`)
// requires a verified Bearer token: there is no `X-Owner-Id`
// fallback, because the whole point is to bind orphan guest data
// to a Clerk account. Returns
// `{ migrated: { diagrams, folders, shared, images } }`.
export async function apiMigrateGuestData(
  guestOwnerId: string,
): Promise<{ diagrams: number; folders: number; shared: number; images: number } | null> {
  const res = await fetch(`${API_BASE}/migrate`, {
    method: 'POST',
    // `apiHeaders` reads the registered token provider; the Clerk
    // Bearer will be on every call from the editor / new-diagram
    // pages after they've set the provider. ownerId is unused
    // server-side for this endpoint but the helper still expects
    // it; pass the guest id to keep signatures uniform.
    headers: await apiHeaders(guestOwnerId, { body: true }),
    body: JSON.stringify({ guestOwnerId }),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as {
    migrated: { diagrams: number; folders: number; shared: number; images: number };
  };
  return body.migrated;
}

export async function apiSaveSelf(p: Participant): Promise<void> {
  // Owner-gated server-side as of the participants-PUT security fix.
  // The api worker requires the caller's resolved owner to match the
  // participant id being mutated — for both modes that's the same
  // value as `p.id` (a guest's localStorage UUID is also their
  // X-Owner-Id; a signed-in user's Clerk userId is also their
  // participant id, see editor-page.tsx identity bootstrap).
  const res = await fetch(`${API_BASE}/participants/${p.id}`, {
    method: 'PUT',
    headers: await apiHeaders(p.id, { body: true }),
    body: JSON.stringify({ name: p.name, color: p.color }),
  });
  await expectOkVoid(res, 'save self');
}
