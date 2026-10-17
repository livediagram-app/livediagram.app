'use client';

// The sidebar's Tags row (docs/specs/013-workspace/tags.md "The sidebar"): it opens the Tags page and expands to one
// row per tag (a dot of its colour, its name, its document count, and its menu on hover), each opening that tag's page.

import type { Tag } from '@livediagram/api-schema';
import { TagIcon } from '@/components/primitives/explorer-icons';
import { useDocumentTags } from '@/components/tags/DocumentTagsProvider';
import { useTagActionsMenu } from '@/components/tags/TagActionsMenu';
import { TagDot } from '@/components/tags/TagChip';
import { useExplorer } from '../ExplorerContext';
import { SIDEBAR_LABELS, TAGS_EXPAND_KEY } from './sidebar-structure';
import { trackSidebar } from './sidebar-telemetry';
import { SidebarRow } from './SidebarRow';

/** `depth`: Tags sits inside Library (tags.md "The sidebar"), one level down; its tag rows one below it. */
export function TagsSidebarRow({ depth = 1 }: { depth?: number }) {
  const { selected, go, expanded, toggleExpand } = useExplorer();
  const { tags } = useDocumentTags();
  const toggle = () => toggleExpand(TAGS_EXPAND_KEY);
  return (
    <SidebarRow
      icon={<TagIcon />}
      label={SIDEBAR_LABELS.tags}
      textLabel={SIDEBAR_LABELS.tags}
      selected={selected.kind === 'tags' && !selected.id}
      onActivate={() => {
        trackSidebar('Tags');
        go({ kind: 'tags' });
      }}
      depth={depth}
      expandable={tags.length > 0}
      expanded={expanded.has(TAGS_EXPAND_KEY)}
      onToggleExpand={toggle}
    >
      {tags.map((tag) => (
        <TagSidebarRow
          key={tag.id}
          tag={tag}
          depth={depth + 1}
          selected={selected.kind === 'tags' && selected.id === tag.id}
          onOpen={() => {
            trackSidebar('Tag');
            go({ kind: 'tags', id: tag.id });
          }}
        />
      ))}
    </SidebarRow>
  );
}

function TagSidebarRow({
  tag,
  depth,
  selected,
  onOpen,
}: {
  tag: Tag;
  depth: number;
  selected: boolean;
  onOpen: () => void;
}) {
  const { documentsFor } = useDocumentTags();
  const { go, selected: current } = useExplorer();
  const menu = useTagActionsMenu(tag, {
    size: 'md',
    reveal: true,
    // Deleting the tag whose page is open goes back to the Tags page.
    onDeleted: () => {
      if (current.kind === 'tags' && current.id === tag.id) go({ kind: 'tags' });
    },
  });
  return (
    <SidebarRow
      icon={
        <span className="flex h-[13px] w-[13px] items-center justify-center">
          <TagDot colour={tag.colour} />
        </span>
      }
      label={tag.name}
      textLabel={tag.name}
      selected={selected}
      onActivate={onOpen}
      depth={depth}
      badge={documentsFor(tag.id).size || undefined}
      onContextMenu={menu.onContextMenu}
      trailing={
        <>
          {menu.trigger}
          {menu.layers}
        </>
      }
    />
  );
}
