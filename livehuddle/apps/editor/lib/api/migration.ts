// The editor's call for the move from the old livehuddle.app (repo docs/migration.md, step 6), made as the
// person, like every other call: a returning old guest's claim (docs/specs/014-identity/auth-and-guest-access.md
// "Returning guests from the old site"). The wire shapes are the migration contract's (@liveworkspace/migration).
import type { LegacyGuestClaim, LegacyGuestClaimAnswer } from '@liveworkspace/migration';
import { API_BASE, apiFetch, apiHeaders, expectOk } from './core';

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
