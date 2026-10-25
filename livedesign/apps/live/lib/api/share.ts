// Opening a design through a share link (liveworkspace/docs/one-explorer-contracts.md "Sharing and access"). The link
// is the index's: its grant on the design says what the link allows (the level, and the tab it is scoped to), and
// the design is then read with that grant. Managing links is the shared Explorer's Share dialog
// (@liveworkspace/explorer `ShareDialog`), straight to the index.
import { IndexError } from '@liveworkspace/index-client';
import { parseStoredLevel, type DesignResponse } from '@livedesign/api-schema';
import { dedupeInFlight } from '@liveworkspace/workbench/lib/dedupe';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import {
  API_BASE,
  apiHeaders,
  expectOkOrNull,
  getSessionSharePassword,
  type SharedDesignResolution,
  apiFetch,
} from './core';
import { designGrant, designGrantRefusal } from './design-grants';

// A refusal the password gate answers: none sent yet (401) or a wrong one (403).
function passwordRefusal(code: string | null): SharedDesignResolution | null {
  if (code === 'password_required') return { passwordRequired: true, invalid: false };
  if (code === 'password_invalid') return { passwordRequired: true, invalid: true };
  return null;
}

// Resolve a share code to the design it opens, the level it grants and its tab. With the design's id (the address
// `/design/<id>?s=<code>` carries it) this is the grant, which the page asked for while its code loaded, and the
// design's one read; without it, the index resolves the code first. Null for a code that opens nothing.
async function _apiLoadShared(
  code: string,
  ownerId: string,
  knownId: string | null = null,
): Promise<SharedDesignResolution | null> {
  const password = getSessionSharePassword();
  let designId = knownId;
  if (!designId) {
    try {
      designId = (await indexClient.resolveShare(code, password)).item.id;
    } catch (err) {
      if (err instanceof IndexError) return passwordRefusal(err.code);
      throw err;
    }
  }
  const share = { code, password };
  const grant = await designGrant(designId, share, { fresh: true });
  if (!grant) return passwordRefusal(designGrantRefusal(designId, share));
  const res = await apiFetch(`${API_BASE}/designs/${encodeURIComponent(designId)}`, {
    headers: await apiHeaders(ownerId, { share: code }),
  });
  const body = await expectOkOrNull<DesignResponse>(res, 'load shared');
  if (!body) return null;
  return { design: body.design, role: parseStoredLevel(grant.level), tabId: grant.tabId };
}

export const apiLoadShared = dedupeInFlight<
  [code: string, ownerId: string, designId?: string | null],
  SharedDesignResolution | null
>(_apiLoadShared, (code, ownerId, designId) => `${code}|${ownerId}|${designId ?? ''}`);
