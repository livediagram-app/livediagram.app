'use client';

// The Tags page without a tag: every tag as a card that opens its list. It asks the index for no items
// (one list per tag would be a request per tag); a tag's items load when it is opened.

import { useState } from 'react';
import { LIST_CARD } from '../ui/classes';
import { InlineRenameInput } from '../ui/InlineRenameInput';
import { MenuActionRow, PortalMenu } from '../ui/Menu';
import { EllipsisTriggerButton, useRowMenu } from '../ui/RowMenu';
import { PencilIcon, TrashIcon } from '../ui/icons';
import type { Tag } from '@liveworkspace/index-client';
import { TagChip } from './badges';
import { useExplorer } from './context';
import { EmptyPane, SkeletonRows } from './EmptyPane';
import { PaneHeader } from './PaneHeader';

export function TagsPane({ onOpenNav }: { onOpenNav?: () => void }) {
  const { tags, words } = useExplorer();
  return (
    <div data-explorer-view="tags">
      <PaneHeader title="Tags" onOpenNav={onOpenNav} showFilter={false} />
      {tags.loading ? (
        <SkeletonRows count={3} />
      ) : tags.tags.length === 0 ? (
        <EmptyPane view={{ kind: 'tags' }} words={words} />
      ) : (
        <ul className={`${LIST_CARD} divide-y divide-slate-100 dark:divide-slate-700/60`}>
          {tags.tags.map((t) => (
            <TagRow key={t.id} tag={t} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TagRow({ tag }: { tag: Tag }) {
  const { navigate, tags } = useExplorer();
  const [renaming, setRenaming] = useState(false);
  const menu = useRowMenu({ disabled: renaming });
  return (
    <li
      className="group flex h-12 items-center gap-2 px-4 hover:bg-slate-50 dark:hover:bg-slate-700"
      onContextMenu={menu.onContextMenu}
    >
      {renaming ? (
        <InlineRenameInput
          initial={tag.name}
          ariaLabel={`Rename ${tag.name}`}
          onCommit={(name) => {
            setRenaming(false);
            const next = name.trim();
            if (next && next !== tag.name) void tags.rename(tag.id, next);
          }}
          onCancel={() => setRenaming(false)}
          className="rounded border border-brand-300 bg-white px-1 text-sm dark:bg-slate-900"
        />
      ) : (
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center text-left"
          onClick={() => navigate({ kind: 'tags', id: tag.id })}
        >
          <TagChip tag={tag} size="md" />
        </button>
      )}
      <span className="flex-1" />
      <EllipsisTriggerButton {...menu.triggerProps} label={`Menu for ${tag.name}`} />
      {menu.open ? (
        <PortalMenu
          anchor={menu.triggerRef.current}
          onClose={menu.close}
          label={`Actions for ${tag.name}`}
        >
          <MenuActionRow
            label="Rename"
            icon={<PencilIcon />}
            onClick={() => {
              menu.close();
              setRenaming(true);
            }}
          />
          <MenuActionRow
            label="Delete Tag"
            icon={<TrashIcon />}
            onClick={() => {
              menu.close();
              void tags.remove(tag.id);
            }}
          />
        </PortalMenu>
      ) : null}
    </li>
  );
}
