// Opening a document through a share link (liveworkspace/docs/one-explorer-contracts.md "Sharing and access"). The link
// is the index's: its grant on the document says what the link allows (the level, and the tab it is scoped to), and
// the document is then read with that grant. Managing links is the shared Explorer's Share dialog
// (@liveworkspace/explorer `ShareDialog`), straight to the index.
import { IndexError } from '@liveworkspace/index-client';
import { parseStoredLevel, type DocumentResponse } from '@livedocuments/api-schema';
import { dedupeInFlight } from '@liveworkspace/workbench/lib/dedupe';
import { indexClient } from '../index-client';
import {
  API_BASE,
  apiHeaders,
  expectOkOrNull,
  getSessionSharePassword,
  type SharedDocumentResolution,
  apiFetch,
} from './core';
import { documentGrant, documentGrantRefusal } from './document-grants';

// A refusal the password gate answers: none sent yet (401) or a wrong one (403).
function passwordRefusal(code: string | null): SharedDocumentResolution | null {
  if (code === 'password_required') return { passwordRequired: true, invalid: false };
  if (code === 'password_invalid') return { passwordRequired: true, invalid: true };
  return null;
}

// Resolve a share code to the document it opens, the level it grants and its tab. With the document's id (the address
// `/document/<id>?s=<code>` carries it) this is the grant, which the page asked for while its code loaded, and the
// document's one read; without it, the index resolves the code first. Null for a code that opens nothing.
async function _apiLoadShared(
  code: string,
  ownerId: string,
  documentId: string | null = null,
): Promise<SharedDocumentResolution | null> {
  const password = getSessionSharePassword();
  let id = documentId;
  if (!id) {
    try {
      id = (await indexClient.resolveShare(code, password)).item.id;
    } catch (err) {
      if (err instanceof IndexError) return passwordRefusal(err.code);
      throw err;
    }
  }
  const share = { code, password };
  const grant = await documentGrant(id, share, { fresh: true });
  if (!grant) return passwordRefusal(documentGrantRefusal(id, share));
  const res = await apiFetch(`${API_BASE}/documents/${encodeURIComponent(id)}`, {
    headers: await apiHeaders(ownerId, { share: code }),
  });
  const body = await expectOkOrNull<DocumentResponse>(res, 'load shared');
  if (!body) return null;
  return { document: body.document, role: parseStoredLevel(grant.level), tabId: grant.tabId };
}

export const apiLoadShared = dedupeInFlight<
  [code: string, ownerId: string, documentId?: string | null],
  SharedDocumentResolution | null
>(_apiLoadShared, (code, ownerId, documentId) => `${code}|${ownerId}|${documentId ?? ''}`);
