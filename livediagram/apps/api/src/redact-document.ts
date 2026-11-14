// What a reader who is not the document's owner is handed of it (@liveworkspace/api-kit redact-item.ts, where the
// rules are written): the owner's credentials stripped, and the Community's and a tab-scoped link's copies.
// See docs/specs/014-identity/auth-and-guest-access.md and docs/specs/015-api/public-api-and-tokens.md section 4.

import { redactItemForScope } from '@liveworkspace/api-kit/redact-item';
import type { DocumentDTO } from './types';

export {
  redactItemForCommunity as redactDocumentForCommunity,
  redactItemForReader as redactDocumentForReader,
} from '@liveworkspace/api-kit/redact-item';

// A tab-scoped visitor's copy; a tab outside the scope keeps its `documentId`.
export function redactDocumentForScope(liveDoc: DocumentDTO, tabScope: string | null): DocumentDTO {
  return redactItemForScope(liveDoc, tabScope, 'documentId');
}
