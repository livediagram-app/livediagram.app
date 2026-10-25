// The editor's two calls for the move from the old livediagram.app (repo docs/migration.md, step 6), made as the
// person, like every other call: a returning old guest's claim (docs/specs/014-identity/auth-and-guest-access.md
// "Returning guests from the old site") and a document's retired parts from This Browser
// (docs/specs/006-document/offline-mode.md "Moving retired parts to the other apps"). The wire shapes are the
// migration contract's (@liveworkspace/migration).
import type {
  LegacyGuestClaim,
  LegacyGuestClaimAnswer,
  LocalPartsAnswer,
  LocalPartsRequest,
} from '@liveworkspace/migration';
import { API_BASE, apiFetch, apiHeaders, expectOk } from './core';

// The whole raw record: its id, name and tabs, and the rest of what the old editor kept on it (its Plan cards and
// sheets, dates, deck), under the splitter's own names (LocalDocumentInput).
export type LocalPartsBody = LocalPartsRequest;

export async function apiClaimLegacyGuest(
  ownerId: string,
  claim: LegacyGuestClaim,
): Promise<LegacyGuestClaimAnswer> {
  const res = await apiFetch(`${API_BASE}/legacy-guest/claim`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify(claim),
  });
  return expectOk<LegacyGuestClaimAnswer>(res, 'claim legacy guest');
}

export async function apiMoveLocalParts(
  ownerId: string,
  request: LocalPartsBody,
): Promise<LocalPartsAnswer> {
  const res = await apiFetch(`${API_BASE}/migration/local-parts`, {
    method: 'POST',
    headers: await apiHeaders(ownerId, { body: true }),
    body: JSON.stringify(request),
  });
  return expectOk<LocalPartsAnswer>(res, 'move local parts');
}
