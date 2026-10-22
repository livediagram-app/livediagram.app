'use client';

// What the Tags page adds to the Explorer pane (docs/specs/013-workspace/tags.md "The Tags page", "One tag's page"):
// a tag's name as the title with Tags › <name> as the breadcrumb, the header's New Tag (and one tag's menu), and the
// New Tag dialog. Inert on every other view, so the pane calls it unconditionally.

import { useCallback, useState, type ReactNode } from 'react';
import { Button } from '@livediagram/ui';
import type { Tag } from '@livediagram/api-schema';
import { PlusIcon } from '@/components/primitives/explorer-icons';
import { useDocumentTags } from '@/components/tags/DocumentTagsProvider';
import { useTagActionsMenu } from '@/components/tags/TagActionsMenu';
import { LazyTagDialog } from '@/components/tags/tag-lazy';
import { VIEW_TITLES } from '../view-titles';
import type { SelectedNode } from '../views';

type Crumb = { name: string; onClick?: () => void };

export function useTagsPage(selected: SelectedNode, go: (node: SelectedNode) => void) {
  const { tagById } = useDocumentTags();
  const [creating, setCreating] = useState(false);
  const onTags = selected.kind === 'tags';
  const tag = onTags && selected.id ? tagById.get(selected.id) : undefined;
  const openTag = useCallback(
    (id: string | null) => go(id ? { kind: 'tags', id } : { kind: 'tags' }),
    [go],
  );
  const newTag = useCallback(() => setCreating(true), []);

  const title = tag?.name;
  const crumbs: Crumb[] | undefined = tag
    ? [{ name: VIEW_TITLES.tags, onClick: () => openTag(null) }, { name: tag.name }]
    : undefined;
  const headerActions: ReactNode = onTags ? (
    <>
      {tag ? <OneTagMenu key={tag.id} tag={tag} onDeleted={() => openTag(null)} /> : null}
      {/* Like the pane's own New Document: the label folds to the icon on a phone. */}
      <Button size="xs" onClick={newTag} aria-label="New Tag" className="shadow-sm">
        <PlusIcon />
        <span className="hidden sm:inline">New Tag</span>
      </Button>
    </>
  ) : null;
  const dialog: ReactNode = creating ? <LazyTagDialog onClose={() => setCreating(false)} /> : null;
  return { title, crumbs, headerActions, dialog, openTag, newTag };
}

function OneTagMenu({ tag, onDeleted }: { tag: Tag; onDeleted: () => void }) {
  const menu = useTagActionsMenu(tag, { onDeleted });
  return (
    <>
      {menu.trigger}
      {menu.layers}
    </>
  );
}
