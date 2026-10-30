// Participant / account calls: load self, save self, account self-
// deletion, and guest -> authed data migration.
import {
  accountDeletionOf,
  deletionCodeSentOf,
  type AccountDeletion,
  type DeletionCodeSent,
} from '@liveworkspace/workbench/lib/account-deletion';
import { dedupeInFlight } from '@liveworkspace/workbench/lib/dedupe';
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

// Account self-deletion (signed-in only; docs/specs/014-identity/auth-and-guest-access.md "Deleting an account").
// First the code: the api has the accounts Worker email a 6-digit code to the account.
export async function apiSendDeletionCode(): Promise<DeletionCodeSent> {
  // ownerId is unused server-side for these endpoints (the resolved account id wins), but apiHeaders' signature
  // wants something. The registered token provider attaches the Bearer; the endpoints refuse if it is absent.
  const res = await apiFetch(`${API_BASE}/account/deletion-code`, {
    method: 'POST',
    headers: await apiHeaders(''),
  });
  return deletionCodeSentOf(res);
}

// Then the delete, with that code: the api checks it before anything goes, deletes this app's data, then closes the
// liveworkspace account with it. `account_not_closed` means the data went but the account did not (asking again
// finishes it).
export async function apiDeleteAccount(code: string): Promise<AccountDeletion> {
  const res = await apiFetch(`${API_BASE}/account`, {
    method: 'DELETE',
    headers: await apiHeaders('', { body: true }),
    body: JSON.stringify({ code }),
  });
  return accountDeletionOf(res);
}

export async function apiSaveSelf(p: Participant): Promise<void> {
  // Owner-gated server-side as of the participants-PUT security fix.
  // The api worker requires the caller's resolved owner to match the
  // participant id being mutated — for both modes that's the same
  // value as `p.id` (a guest's id is its guest token's subject;
  // a signed-in user's account id is also their
  // participant id, see editor-page.tsx identity bootstrap).
  const res = await apiFetch(`${API_BASE}/participants/${p.id}`, {
    method: 'PUT',
    headers: await apiHeaders(p.id, { body: true }),
    body: JSON.stringify({ name: p.name, color: p.color }),
  });
  await expectOkVoid(res, 'save self');
  rememberSelf({ id: p.id, name: p.name, color: p.color, status: 'online' });
}
