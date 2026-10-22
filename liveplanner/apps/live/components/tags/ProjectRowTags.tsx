'use client';

// A project's tags on an Explorer row, card or Details row (docs/specs/013-workspace/tags.md "Where tags show"):
// chips that open their tag's page, and on a phone's list row the narrow panel dots instead, so the name keeps its
// room.

import { useOptionalExplorer } from '@/app/explorer/ExplorerContext';
import { useProjectTags } from './ProjectTagsProvider';
import { ProjectTagChips, ProjectTagDots } from './TagChip';

export function ProjectRowTags({
  projectId,
  compactOnPhone = false,
  line = false,
}: {
  projectId: string;
  // A card: the chips on a line of their own.
  line?: boolean;
  // A list row: dots below `sm`, chips above.
  compactOnPhone?: boolean;
}) {
  const { tagsFor } = useProjectTags();
  const explorer = useOptionalExplorer();
  const tags = tagsFor(projectId);
  if (tags.length === 0) return null;
  const onOpenTag = explorer ? (id: string) => explorer.go({ kind: 'tags', id }) : undefined;
  if (line) {
    return (
      <div className="flex min-w-0">
        <ProjectTagChips tags={tags} onOpenTag={onOpenTag} />
      </div>
    );
  }
  // The chips are the row's own flex item (no wrapper), so their floor holds against the name beside them.
  if (!compactOnPhone) return <ProjectTagChips tags={tags} onOpenTag={onOpenTag} />;
  return (
    <>
      <span className="inline-flex sm:hidden">
        <ProjectTagDots tags={tags} />
      </span>
      <ProjectTagChips tags={tags} onOpenTag={onOpenTag} hiddenOnPhone />
    </>
  );
}
