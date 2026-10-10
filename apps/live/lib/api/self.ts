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
  SessionTokenUnavailableError,
  apiFetch,
} from './core';

// Deduped by id: the editor's hydration effect AND /live/new's
// initial fetch both call this on first paint; React Strict Mode
// in dev doubles each. With dedup, all four collapse to one fetch
// when they land in the same tick.
//
// Asked as yourself, so a profile you have not saved yet comes back as `{ participant: null }`
// rather than a 404 the browser logs as an error (docs/specs/015-api/api.md). The 404 is still read
// as no profile, for an api from before that answer.
async function _apiLoadSelf(id: string): Promise<Participant | null> {
  const res = await apiFetch(`${API_BASE}/participants/${id}`, { headers: await selfHeaders(id) });
  const participant = (await expectOkOrNull<ParticipantResponse>(res, 'load self'))?.participant;
  if (!participant) return null;
  return {
    id: participant.id,
    name: participant.name,
    color: participant.color,
    status: 'online',
  };
}
// The GET is open, so a signed-in session whose token is momentarily unavailable (which apiHeaders
// reports) still loads its profile, anonymously, as it always could.
async function selfHeaders(id: string): Promise<HeadersInit> {
  try {
    return await apiHeaders(id);
  } catch (error) {
    if (error instanceof SessionTokenUnavailableError) return {};
    throw error;
  }
}

const loadSelfOnce = dedupeInFlight(_apiLoadSelf, (id) => id);

// The participant this page last loaded or saved, briefly. /new hands the new document to the
// editor IN PLACE (docs/specs/007-editor/new-document-route.md), so the editor's identity bootstrap
// asked again for the participant /new had just read and written: one wasted round trip on every
// new document. A reload is a new page and starts empty, and presence carries any live change.
const RECENT_SELF_MS = 30_000;
let recentSelf: { participant: Participant; at: number } | null = null;
function rememberSelf(participant: Participant) {
  recentSelf = { participant, at: Date.now() };
}

export async function apiLoadSelf(id: string): Promise<Participant | null> {
  if (recentSelf?.participant.id === id && Date.now() - recentSelf.at < RECENT_SELF_MS) {
    return { ...recentSelf.participant };
  }
  const loaded = await loadSelfOnce(id);
  if (loaded) rememberSelf(loaded);
  return loaded;
}

// Account self-deletion (Clerk-only). Wipes the caller's documents,
// folders, and participant row server-side; the caller is expected
// to follow up with Clerk's `user.delete()` to drop the Clerk
// account itself. Order matters — backend first, then Clerk — so a
// Clerk-side failure doesn't leave the user without an account but
// with orphaned data. Returns the change counts on success or null
// on any non-2xx so the caller can decide whether to proceed with
// the Clerk delete.
export async function apiDeleteAccount(): Promise<{
  documents: number;
  folders: number;
} | null> {
  // ownerId arg is unused server-side for this endpoint (the
  // resolved Clerk id wins), but apiHeaders' signature wants
  // something — pass an empty string. The registered token
  // provider attaches the Bearer; the endpoint refuses if absent.
  const res = await apiFetch(`${API_BASE}/account`, {
    method: 'DELETE',
    headers: await apiHeaders(''),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { deleted: { documents: number; folders: number } };
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
// `{ migrated: { documents, folders, shared, images } }`.
export async function apiMigrateGuestData(
  guestOwnerId: string,
  guestSignature: string | null,
): Promise<{ documents: number; folders: number; shared: number; images: number } | null> {
  const res = await apiFetch(`${API_BASE}/migrate`, {
    method: 'POST',
    // `apiHeaders` reads the registered token provider; the Clerk
    // Bearer will be on every call from the editor / new-document
    // pages after they've set the provider. ownerId is unused
    // server-side for this endpoint but the helper still expects
    // it; pass the guest id to keep signatures uniform.
    headers: await apiHeaders(guestOwnerId, { body: true }),
    // The signature proves the caller owns this guest id (docs/specs/014-identity/auth-and-guest-access.md). It's
    // null for a legacy guest that never got signed — the worker then
    // rejects when signing is enforced, which is why the bootstrap
    // upgrades legacy ids to signed ones before sign-up.
    body: JSON.stringify({ guestOwnerId, guestSignature }),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as {
    migrated: { documents: number; folders: number; shared: number; images: number };
  };
  return body.migrated;
}

// Mint a SERVER-signed guest identity (docs/specs/014-identity/auth-and-guest-access.md). The worker generates the
// id — so a caller can only ever hold a signature for an id it was handed,
// never for one observed in someone else's DTO / presence — and returns
// its HMAC signature (`ownerSig` is null when the worker has no
// GUEST_ID_HMAC_SECRET configured). Returns null on a network failure so
// the caller can fall back to a local unsigned id.
//
// The mint is rate-limited per network, so a busy shared address can be told
// to wait (429 with Retry-After). A first visit should not give up on that:
// it waits, at most MINT_RETRY_MAX_WAIT_MS, and tries again up to
// MINT_RETRIES times before falling back.
export const MINT_RETRIES = 2;
export const MINT_RETRY_MAX_WAIT_MS = 10_000;

function mintRetryWaitMs(res: Response): number {
  const seconds = Number(res.headers.get('Retry-After'));
  return Number.isFinite(seconds) && seconds > 0
    ? Math.min(seconds * 1000, MINT_RETRY_MAX_WAIT_MS)
    : MINT_RETRY_MAX_WAIT_MS;
}

export async function apiMintGuestId(): Promise<{
  ownerId: string;
  ownerSig: string | null;
} | null> {
  try {
    for (let attempt = 0; ; attempt++) {
      const res = await apiFetch(`${API_BASE}/guest-id`, {
        method: 'POST',
        headers: await apiHeaders('', { body: true }),
        body: '{}',
      });
      if (res.status === 429 && attempt < MINT_RETRIES) {
        console.warn('[guest-identity] mint rate-limited; retrying', { attempt });
        await new Promise((resolve) => setTimeout(resolve, mintRetryWaitMs(res)));
        continue;
      }
      if (!res.ok) return null;
      return (await res.json()) as { ownerId: string; ownerSig: string | null };
    }
  } catch {
    return null;
  }
}

// Legacy upgrade: move an existing unsigned guest's data onto a freshly
// minted signed id (docs/specs/014-identity/auth-and-guest-access.md migrate flow 2). Authenticated by the OLD id
// as X-Owner-Id (the guest bearer credential, present because no Clerk
// token is registered for a guest); the NEW id is proven by its
// signature. 'moved' on success; 'refused' when the worker says no for good (403: under enforcement
// only a pre-signing id may upgrade unsigned); 'failed' for anything worth trying again (network, 5xx).
export type GuestUpgradeResult = 'moved' | 'refused' | 'failed';
export async function apiUpgradeGuestId(
  fromOwnerId: string,
  toOwnerId: string,
  toSignature: string,
): Promise<GuestUpgradeResult> {
  try {
    const res = await apiFetch(`${API_BASE}/migrate`, {
      method: 'POST',
      headers: await apiHeaders(fromOwnerId, { body: true }),
      body: JSON.stringify({ toOwnerId, toSignature }),
    });
    if (res.ok) return 'moved';
    return res.status === 403 ? 'refused' : 'failed';
  } catch {
    return 'failed';
  }
}

export async function apiSaveSelf(p: Participant): Promise<void> {
  // Owner-gated server-side as of the participants-PUT security fix.
  // The api worker requires the caller's resolved owner to match the
  // participant id being mutated — for both modes that's the same
  // value as `p.id` (a guest's localStorage UUID is also their
  // X-Owner-Id; a signed-in user's Clerk userId is also their
  // participant id, see editor-page.tsx identity bootstrap).
  const res = await apiFetch(`${API_BASE}/participants/${p.id}`, {
    method: 'PUT',
    headers: await apiHeaders(p.id, { body: true }),
    body: JSON.stringify({ name: p.name, color: p.color }),
  });
  await expectOkVoid(res, 'save self');
  rememberSelf({ id: p.id, name: p.name, color: p.color, status: 'online' });
}

// Publish or clear this account's profile picture (docs/specs/014-identity/profile-picture.md §6).
// Clerk-only server-side. Returns the status so the caller can tell "no participant row yet" (404)
// from a real failure.
export async function apiSetProfilePicture(id: string, pictureUrl: string | null): Promise<number> {
  const res = await apiFetch(`${API_BASE}/participants/${id}/picture`, {
    method: 'PUT',
    headers: await apiHeaders(id, { body: true }),
    body: JSON.stringify({ pictureUrl }),
  });
  return res.status;
}
