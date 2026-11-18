'use client';

// One item in the palette's Library (liveworkspace/docs/specs/006-media/libraries.md): its preview over its title. A
// click (or Enter / Space) places it at the middle of the view; a drag carries it to where it is dropped. Someone who may tidy it (its owner for Personal, an
// admin for a team) gets a More button on the tile's corner: Rename in place, or Delete after a confirm.

import { useRef, useState, type ReactNode } from 'react';
import { useClickOutside, useEscape } from '@liveworkspace/ui';
import type { LibraryItemSummary } from '@liveworkspace/media';
import { previewSrc } from '../../lib/library/library-groups';
import { LibraryDeleteIcon, LibraryMoreIcon, LibraryRenameIcon } from './library-icons';

export type LibraryTileDrag = { mime: string; data: string };

const MENU_ROW =
  'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800';

export function LibraryTile({
  item,
  groupLabel,
  tidy,
  thumbnail,
  drag,
  onInsert,
  onRename,
  onDelete,
}: {
  item: LibraryItemSummary;
  groupLabel: string;
  // Whether the More button (Rename, Delete) shows.
  tidy: boolean;
  // The editor's own drawing, for an item with no stored preview (its own shape libraries).
  thumbnail?: ReactNode;
  // A drag payload the editor's canvas takes: the Library's (library-dnd.ts), or livediagram's own shape libraries'.
  drag?: LibraryTileDrag | null;
  onInsert: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(item.title);
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(menuRef, () => setMenu(false), menu);
  useEscape(() => setMenu(false), { enabled: menu, stopPropagation: true });

  const commit = () => {
    const next = draft.trim();
    setRenaming(false);
    if (next && next !== item.title) onRename(next);
  };

  return (
    <div className="group relative">
      <button
        type="button"
        aria-label={`Insert ${item.title} from ${groupLabel}`}
        onClick={onInsert}
        draggable={drag ? true : undefined}
        onDragStart={
          drag
            ? (e) => {
                e.dataTransfer.setData(drag.mime, drag.data);
                e.dataTransfer.effectAllowed = 'copy';
              }
            : undefined
        }
        className="flex w-full flex-col items-center gap-1 rounded-md p-1 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-slate-100 dark:hover:bg-slate-800 dark:hover:text-white"
      >
        <span className="relative flex h-12 w-full items-center justify-center overflow-hidden rounded bg-white ring-1 ring-slate-200 dark:ring-slate-700">
          {item.preview ? (
            // A data URL in a plain <img>: inert, the SVG never runs. Decorative: the button carries the name.
            // Absolutely placed, so a wide preview's own size never widens the palette's flyout.
            <img
              src={previewSrc(item.preview)}
              alt=""
              className="absolute inset-0 h-full w-full object-contain p-0.5"
            />
          ) : (
            (thumbnail ?? null)
          )}
        </span>
        {renaming ? null : (
          <span className="w-full truncate text-center text-[10px] leading-tight">
            {item.title}
          </span>
        )}
      </button>
      {renaming ? (
        <input
          aria-label={`Rename ${item.title}`}
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              e.stopPropagation();
              setDraft(item.title);
              setRenaming(false);
            }
          }}
          className="mt-0.5 w-full rounded border border-brand-400 bg-white px-1 py-0.5 text-center text-[10px] text-slate-800 focus:outline-none dark:bg-slate-800 dark:text-slate-100"
        />
      ) : null}
      {tidy && !renaming ? (
        <div ref={menuRef} className="absolute right-0.5 top-0.5">
          <button
            type="button"
            aria-label={`More for ${item.title}`}
            aria-haspopup="menu"
            aria-expanded={menu}
            onClick={() => setMenu((open) => !open)}
            className={`flex h-6 w-6 items-center justify-center rounded-md bg-white/90 text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:text-slate-900 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 group-hover:opacity-100 [@media(hover:none)]:opacity-100 dark:bg-slate-900/90 dark:text-slate-300 dark:ring-slate-700 dark:hover:text-white ${
              menu ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <LibraryMoreIcon />
          </button>
          {menu ? (
            <div
              role="menu"
              aria-label={`${item.title} actions`}
              className="absolute right-0 top-7 z-10 w-28 rounded-md border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
            >
              <button
                type="button"
                role="menuitem"
                className={MENU_ROW}
                onClick={() => {
                  setMenu(false);
                  setDraft(item.title);
                  setRenaming(true);
                }}
              >
                <LibraryRenameIcon /> Rename
              </button>
              <button
                type="button"
                role="menuitem"
                className={MENU_ROW}
                onClick={() => {
                  setMenu(false);
                  onDelete();
                }}
              >
                <LibraryDeleteIcon /> Delete
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
