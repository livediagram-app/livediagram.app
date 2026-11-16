'use client';

// The Share dialog's Suggestions section (liveworkspace/docs/specs/015-suggestions/canvas-suggestions.md "Suggest
// Only"), for an Editor: the shared section (@liveworkspace/suggestions), with each Participant link and each person
// who has joined through one, each with a Suggest Only switch. Assistants Suggest is the article editor's alone.
import type { ShareLink } from '@liveworkspace/index-client';
import { SuggestOnlySection } from '@liveworkspace/suggestions/react/SuggestOnlySection';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { apiReadReview, apiSetReview } from '@/lib/api/review';
import { track } from '@/lib/telemetry';

export function SuggestionsSection({
  itemId,
  ownerId,
  shareCode,
  linksRev = 0,
  tabs,
  onError,
}: {
  itemId: string;
  ownerId: string;
  shareCode: string | null;
  // Bumped when the Share dialog makes, rescopes or removes a pass: the links are listed again.
  linksRev?: number;
  // The design's tabs, to name a link that opens one.
  tabs: readonly { id: string; name: string }[];
  onError: (text: string) => void;
}) {
  return (
    <SuggestOnlySection
      itemId={itemId}
      readReview={() => apiReadReview(ownerId, itemId, shareCode)}
      saveReview={(next) => apiSetReview(ownerId, itemId, next, shareCode)}
      listLinks={() =>
        indexClient
          .listShareLinks(itemId)
          .then((l) => l.links)
          .catch(() => [] as ShareLink[])
      }
      linksRev={linksRev}
      tabs={tabs}
      wholeItem="Whole Design"
      track={(type) => track('Document', 'Shared', type)}
      onError={onError}
    />
  );
}
