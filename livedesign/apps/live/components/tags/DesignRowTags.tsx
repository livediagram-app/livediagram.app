'use client';

// A design's tags on an Explorer row, card or Details row (docs/specs/013-workspace/tags.md "Where tags show"):
// chips that open their tag's page, and on a phone's list row the narrow panel dots instead, so the name keeps its
// room.

import { useOptionalExplorer } from '@/app/explorer/ExplorerContext';
import { useDesignTags } from './DesignTagsProvider';
import { DesignTagChips, DesignTagDots } from './TagChip';

export function DesignRowTags({
  designId,
  compactOnPhone = false,
  line = false,
}: {
  designId: string;
  // A card: the chips on a line of their own.
  line?: boolean;
  // A list row: dots below `sm`, chips above.
  compactOnPhone?: boolean;
}) {
  const { tagsFor } = useDesignTags();
  const explorer = useOptionalExplorer();
  const tags = tagsFor(designId);
  if (tags.length === 0) return null;
  const onOpenTag = explorer ? (id: string) => explorer.go({ kind: 'tags', id }) : undefined;
  if (line) {
    return (
      <div className="flex min-w-0">
        <DesignTagChips tags={tags} onOpenTag={onOpenTag} />
      </div>
    );
  }
  // The chips are the row's own flex item (no wrapper), so their floor holds against the name beside them.
  if (!compactOnPhone) return <DesignTagChips tags={tags} onOpenTag={onOpenTag} />;
  return (
    <>
      <span className="inline-flex sm:hidden">
        <DesignTagDots tags={tags} />
      </span>
      <DesignTagChips tags={tags} onOpenTag={onOpenTag} hiddenOnPhone />
    </>
  );
}
