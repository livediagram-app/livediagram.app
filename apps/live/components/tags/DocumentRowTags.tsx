'use client';

// A document's tags on an Explorer row, card or Details row (docs/specs/013-workspace/tags.md "Where tags show"):
// chips that open their tag's page, and on a phone's list row the narrow panel dots instead, so the name keeps its
// room.

import { useOptionalExplorer } from '@/app/explorer/ExplorerContext';
import { useDocumentTags } from './DocumentTagsProvider';
import { DocumentTagChips, DocumentTagDots } from './TagChip';

export function DocumentRowTags({
  documentId,
  compactOnPhone = false,
  line = false,
}: {
  documentId: string;
  // A card: the chips on a line of their own.
  line?: boolean;
  // A list row: dots below `sm`, chips above.
  compactOnPhone?: boolean;
}) {
  const { tagsFor } = useDocumentTags();
  const explorer = useOptionalExplorer();
  const tags = tagsFor(documentId);
  if (tags.length === 0) return null;
  const chips = (
    <DocumentTagChips
      tags={tags}
      onOpenTag={explorer ? (id) => explorer.go({ kind: 'tags', id }) : undefined}
    />
  );
  if (line) return <div className="flex min-w-0">{chips}</div>;
  if (!compactOnPhone) return chips;
  return (
    <>
      <span className="inline-flex sm:hidden">
        <DocumentTagDots tags={tags} />
      </span>
      <span className="hidden min-w-0 sm:inline-flex">{chips}</span>
    </>
  );
}
