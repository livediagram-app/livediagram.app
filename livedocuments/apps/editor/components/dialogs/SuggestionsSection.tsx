'use client';

// The Share dialog's Suggestions section (docs/specs/007-editor/suggestions.md "Suggest Only"), livedocuments' own
// below Password Protection, for an Editor: the shared section (@liveworkspace/suggestions), with Assistants Suggest
// first, then each Participant link and each person who has joined through one, each with a Suggest Only switch.
import type { ShareLink } from '@liveworkspace/index-client';
import { SuggestOnlySection } from '@liveworkspace/suggestions/react/SuggestOnlySection';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { apiReadReview, apiSetReview } from '@/lib/api/review';
import { track } from '@/lib/telemetry';

export function SuggestionsSection({
  documentId,
  ownerId,
  shareCode,
  linksRev = 0,
  tabs,
  onError,
}: {
  documentId: string;
  ownerId: string;
  shareCode: string | null;
  // Bumped when the Share dialog makes, rescopes or removes a pass: the links are listed again.
  linksRev?: number;
  // The document's tabs, to name a link that opens one.
  tabs: readonly { id: string; name: string }[];
  onError: (text: string) => void;
}) {
  return (
    <SuggestOnlySection
      itemId={documentId}
      readReview={() => apiReadReview(ownerId, documentId, shareCode)}
      saveReview={(next) => apiSetReview(ownerId, documentId, next, shareCode)}
      listLinks={() =>
        indexClient
          .listShareLinks(documentId)
          .then((l) => l.links)
          .catch(() => [] as ShareLink[])
      }
      linksRev={linksRev}
      tabs={tabs}
      wholeItem="Whole Document"
      assistants={{
        title: 'Assistants Suggest',
        detail: 'An assistant’s edits to articles arrive as suggestions to accept or reject.',
      }}
      track={(type) => track('Document', 'Shared', type)}
      onError={onError}
    />
  );
}
