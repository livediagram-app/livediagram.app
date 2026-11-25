'use client';

// Saved designs in the Page Design panel (docs/specs/011-theme/page-designs.md "Saved designs"): the Saved group at
// the top of the picker, each tile a design saved to My Work or a team, drawn in this document's theme and applied in
// one click; Rename and Delete on a tile for whoever may tidy it; and Save This Design, at the foot of Fine Tune.
// Each reads the editor's Library (workbench LibraryProvider), which keeps saved designs out of the palette.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useClickOutside, useEscape } from '@liveworkspace/ui';
import { Button } from '@livedocuments/ui';
import type { PageDesign } from '@livedocuments/document';
import { ConfirmDialog } from '@liveworkspace/workbench/components/dialogs/ConfirmDialog';
import { useLibrary } from '@liveworkspace/workbench/components/library/LibraryProvider';
import {
  LibraryDeleteIcon,
  LibraryMoreIcon,
  LibraryRenameIcon,
  SaveToLibraryIcon,
} from '@liveworkspace/workbench/components/library/library-icons';
import { DesignTileImage } from './DesignTile';
import type { TileLook } from './DesignGrid';
import { saveDraftOf, savedDesignsOf, wearsSaved, type SavedDesign } from './saved-designs';

const TILE =
  'group relative flex w-full cursor-pointer flex-col gap-0.5 rounded-lg p-1 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-500';
const FRAME =
  'relative block aspect-[16/10] w-full overflow-hidden rounded-md ring-1 ring-slate-200 transition-shadow group-hover:ring-slate-300 dark:ring-slate-700 dark:group-hover:ring-slate-500';
// The catalogue tiles' selected ring (DesignGrid's SELECTED).
const SELECTED = 'ring-2 ring-brand-500 group-hover:ring-brand-500 dark:ring-brand-400';
const MENU_ROW =
  'flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800';

/** The saved designs this person can see, loaded the first time the panel needs them; null without a Library. */
export function useSavedDesigns(): SavedDesign[] | null {
  const library = useLibrary();
  useEffect(() => library?.ensureLoaded(), [library]);
  const apart = library?.state.apart;
  const teams = library?.state.teams;
  return useMemo(
    () => (library && apart && teams ? savedDesignsOf(apart, teams) : null),
    // oxlint-disable-next-line react/exhaustive-deps -- on the list it reads, not the context object
    [apart, teams, !!library],
  );
}

export function SavedDesignGrid({
  saved,
  look,
  worn,
  onPage,
  onApply,
}: {
  saved: readonly SavedDesign[];
  look: TileLook;
  // The design the tab (or, on This Page, the page) wears: the tile it matches shows selected.
  worn: PageDesign | undefined;
  onPage: boolean;
  onApply: (design: PageDesign) => void;
}) {
  const library = useLibrary();
  const [deleting, setDeleting] = useState<SavedDesign | null>(null);
  if (!library || saved.length === 0) return null;
  return (
    <section aria-label="Saved" data-page-design-saved="">
      <h4 className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Saved
      </h4>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {saved.map((s) => (
          <SavedTile
            key={s.item.id}
            saved={s}
            look={look}
            selected={wearsSaved(worn, s.design, onPage)}
            onApply={() => onApply(s.design)}
            onRename={(title) => void library.rename(s.item, title)}
            onDelete={() => setDeleting(s)}
          />
        ))}
      </div>
      <ConfirmDialog
        open={deleting !== null}
        title="Delete Saved Design?"
        message={
          deleting?.item.scope === 'team'
            ? `“${deleting.item.title}” leaves ${deleting.whose}’s library for everyone. Decks already wearing it keep it.`
            : `“${deleting?.item.title ?? ''}” leaves your library. Decks already wearing it keep it.`
        }
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const target = deleting;
          setDeleting(null);
          if (target) void library.remove(target.item);
        }}
      />
    </section>
  );
}

function SavedTile({
  saved,
  look,
  selected,
  onApply,
  onRename,
  onDelete,
}: {
  saved: SavedDesign;
  look: TileLook;
  selected: boolean;
  onApply: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const { item, design, whose, tidy } = saved;
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(item.title);
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(menuRef, () => setMenu(false), menu);
  useEscape(() => setMenu(false), { enabled: menu, stopPropagation: true });
  const input = useMemo(
    () => ({
      design,
      theme: look.theme,
      paperDark: look.paperDark,
      background: look.background,
      font: look.font,
      idPrefix: `pds-${item.id}-`.replace(/[^a-zA-Z0-9-]/g, ''),
    }),
    [design, look, item.id],
  );
  const commit = () => {
    const next = draft.trim();
    setRenaming(false);
    if (next && next !== item.title) onRename(next);
  };
  return (
    <div className="relative">
      <button
        type="button"
        className={TILE}
        aria-label={`${item.title}, saved to ${whose}`}
        aria-pressed={selected}
        onClick={onApply}
        data-page-design-saved-tile={item.id}
      >
        <span className={`${FRAME} ${selected ? SELECTED : ''}`}>
          <DesignTileImage input={input} />
        </span>
        {renaming ? null : (
          <span className="flex min-w-0 flex-col px-0.5">
            <span className="truncate text-[11px] font-medium text-slate-700 dark:text-slate-200">
              {item.title}
            </span>
            <span className="truncate text-[10px] text-slate-500 dark:text-slate-400">{whose}</span>
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
          className="mx-1 mb-1 w-[calc(100%-0.5rem)] rounded border border-brand-400 bg-white px-1 py-0.5 text-[11px] text-slate-800 focus:outline-none dark:bg-slate-800 dark:text-slate-100"
        />
      ) : null}
      {tidy && !renaming ? (
        <div ref={menuRef} className="absolute right-2 top-2">
          <button
            type="button"
            aria-label={`More for ${item.title}`}
            aria-haspopup="menu"
            aria-expanded={menu}
            onClick={() => setMenu((open) => !open)}
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md bg-white/90 text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:bg-slate-900/90 dark:text-slate-300 dark:ring-slate-700 dark:hover:text-white"
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

/** Save This Design, at the foot of Fine Tune: the design as tuned now, to My Work or a team. */
export function SaveThisDesign({ design }: { design: PageDesign }) {
  const library = useLibrary();
  if (!library) return null;
  return (
    <div>
      <Button
        variant="secondary"
        size="sm"
        className="w-full"
        onClick={() => library.requestSave(saveDraftOf(design))}
        data-page-design-save=""
      >
        <SaveToLibraryIcon /> Save This Design
      </Button>
    </div>
  );
}
