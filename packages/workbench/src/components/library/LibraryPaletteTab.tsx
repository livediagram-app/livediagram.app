'use client';

// The palette's Library (liveworkspace/docs/specs/006-media/libraries.md): Personal, then each of the person's teams,
// each holding its folders and their items, with a search over them all. A click places a copy at the middle of the
// view. Its owner tidies Personal and a team's admins tidy the team's: rename an item or a folder in place, or delete
// an item. Items using kinds this app can't draw were left out by the door, and a line says how many.

import { useEffect, useState, type ReactNode } from 'react';
import { Button, CompactEmptyState, HoverCard, NoMatches } from '@liveworkspace/ui';
import type { LibraryItemSummary } from '@liveworkspace/media';
import { ConfirmDialog } from '../dialogs/ConfirmDialog';
import { SearchInput } from '../primitives/SearchInput';
import type { LibraryInsertItem } from '../../hooks/canvas/useLibraryItemInsert';
import { canTidy, libraryGroups, type LibraryGroup } from '../../lib/library/library-groups';
import { useLibrary } from './LibraryProvider';
import {
  LibraryFolderIcon,
  LibraryIcon,
  LibraryRenameIcon,
  PersonalScopeIcon,
  TeamScopeIcon,
} from './library-icons';
import { LibraryTile, type LibraryTileDrag } from './LibraryTile';

const HEADING =
  'flex items-center gap-1.5 px-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200';

function FolderHeading({
  name,
  count,
  tidy,
  onRename,
}: {
  name: string;
  count: number;
  tidy: boolean;
  onRename: (to: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const commit = () => {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== name) onRename(next);
  };
  return (
    <div className="group/folder mb-1 flex h-6 items-center gap-1.5 px-1 text-[11px] text-slate-600 dark:text-slate-300">
      <LibraryFolderIcon />
      {editing ? (
        <input
          aria-label={`Rename folder ${name}`}
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              e.stopPropagation();
              setDraft(name);
              setEditing(false);
            }
          }}
          className="min-w-0 flex-1 rounded border border-brand-400 bg-white px-1 py-0.5 text-[11px] text-slate-800 focus:outline-none dark:bg-slate-800 dark:text-slate-100"
        />
      ) : (
        <>
          <span className="min-w-0 truncate font-medium">{name}</span>
          <span className="text-slate-500 dark:text-slate-400">{count}</span>
          {tidy ? (
            <HoverCard title="Rename Folder" description="Rename it for everything in it.">
              <button
                type="button"
                aria-label={`Rename folder ${name}`}
                onClick={() => {
                  setDraft(name);
                  setEditing(true);
                }}
                className="ml-auto flex h-6 w-6 items-center justify-center rounded text-slate-500 opacity-0 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 group-hover/folder:opacity-100 [@media(hover:none)]:opacity-100 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <LibraryRenameIcon />
              </button>
            </HoverCard>
          ) : null}
        </>
      )}
    </div>
  );
}

function SkeletonTiles() {
  return (
    <ul aria-hidden className="grid grid-cols-3 gap-1">
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex flex-col items-center gap-1 p-1">
          <span className="h-12 w-full animate-pulse rounded bg-slate-100 motion-reduce:animate-none dark:bg-slate-800" />
          <span className="h-2 w-2/3 animate-pulse rounded bg-slate-100 motion-reduce:animate-none dark:bg-slate-800" />
        </li>
      ))}
    </ul>
  );
}

export function LibraryPaletteTab({
  onInsert,
  thumbnailFor,
  dragFor,
}: {
  // Places what an item holds; the editor's own insert (its paste rules).
  onInsert: (item: LibraryInsertItem<unknown>) => void;
  // The editor's own drawing of an item with no stored preview.
  thumbnailFor?: (item: LibraryItemSummary) => ReactNode;
  // A tile's drag payload, where the editor's canvas takes one.
  dragFor?: (item: LibraryItemSummary) => LibraryTileDrag | null;
}) {
  const library = useLibrary();
  const [query, setQuery] = useState('');
  const [deleting, setDeleting] = useState<{
    item: LibraryItemSummary;
    group: LibraryGroup;
  } | null>(null);
  // The list loads when the Library first opens.
  const ensureLoaded = library?.ensureLoaded;
  useEffect(() => ensureLoaded?.(), [ensureLoaded]);
  if (!library) return null;
  const { state, notice } = library;
  const groups = libraryGroups(state.items, state.teams, query);
  const place = async (item: LibraryItemSummary) => {
    const held = await library.place(item);
    if (held) onInsert(held);
  };

  let body: ReactNode;
  if ((state.status === 'idle' || state.status === 'loading') && state.items.length === 0) {
    body = <SkeletonTiles />;
  } else if (state.status === 'error' && state.items.length === 0) {
    body = (
      <CompactEmptyState
        size="small"
        icon={<LibraryIcon />}
        title="Couldn’t load your library."
        action={
          <Button type="button" variant="secondary" size="xs" onClick={library.reload}>
            Try Again
          </Button>
        }
      />
    );
  } else if (state.items.length === 0) {
    body = (
      <CompactEmptyState
        size="small"
        icon={<LibraryIcon />}
        title="Nothing saved yet"
        description="Select shapes on the canvas and choose Save to Library on its toolbar."
      />
    );
  } else if (groups.length === 0) {
    body = <NoMatches things="items" query={query} onClear={() => setQuery('')} />;
  } else {
    body = (
      <div className="flex max-h-80 flex-col gap-3 overflow-y-auto overflow-x-hidden">
        {groups.map((group) => {
          const headingId = `library-group-${group.key}`;
          return (
            <section key={group.key} aria-labelledby={headingId}>
              <h3 id={headingId} className={`${HEADING} mb-1`}>
                <span aria-hidden className="text-slate-500 dark:text-slate-400">
                  {group.scope === 'personal' ? (
                    <PersonalScopeIcon size={12} />
                  ) : (
                    <TeamScopeIcon size={12} />
                  )}
                </span>
                <span className="truncate">{group.label}</span>
                {group.role === 'admin' ? (
                  <span className="rounded bg-slate-100 px-1 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    Admin
                  </span>
                ) : null}
              </h3>
              <div className="flex flex-col gap-2">
                {group.folders.map((folder) => (
                  <div key={folder.name || '(top)'}>
                    {folder.name ? (
                      <FolderHeading
                        name={folder.name}
                        count={folder.items.length}
                        tidy={canTidy(group, folder.items[0], state.legacyWritable)}
                        onRename={(to) => void library.renameFolder(group, folder.name, to)}
                      />
                    ) : null}
                    <ul className="grid grid-cols-3 gap-1">
                      {folder.items.map((item) => (
                        <li key={item.id}>
                          <LibraryTile
                            item={item}
                            groupLabel={group.label}
                            tidy={canTidy(group, item, state.legacyWritable)}
                            thumbnail={thumbnailFor?.(item)}
                            drag={dragFor?.(item)}
                            onInsert={() => void place(item)}
                            onRename={(title) => void library.rename(item, title)}
                            onDelete={() => setDeleting({ item, group })}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="mb-2 flex items-center">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search the library"
          ariaLabel="Search the library"
          clearAriaLabel="Clear the library search"
          clearDescription="Clear the search over your library."
        />
      </div>
      {notice ? (
        <p role="alert" className="mb-2 px-1 text-[11px] text-red-700 dark:text-red-300">
          {notice}
        </p>
      ) : null}
      {body}
      {state.hidden > 0 ? (
        <p className="mt-2 px-1 text-[11px] text-slate-600 dark:text-slate-400">
          {state.hidden === 1
            ? '1 item from another app can’t be placed here.'
            : `${state.hidden} items from other apps can’t be placed here.`}
        </p>
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        title={
          deleting?.group.scope === 'team' ? 'Delete From Team Library?' : 'Delete From Library?'
        }
        message={
          deleting?.group.scope === 'team'
            ? `“${deleting.item.title}” leaves ${deleting.group.label}’s library for everyone. Anything already placed keeps it.`
            : `“${deleting?.item.title ?? ''}” leaves your library. Anything already placed keeps it.`
        }
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const target = deleting;
          setDeleting(null);
          if (target) void library.remove(target.item);
        }}
      />
    </div>
  );
}
