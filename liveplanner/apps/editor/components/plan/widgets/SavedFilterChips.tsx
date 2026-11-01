'use client';

// A board's saved filters (docs/specs/026-plan/board-widgets.md "Saved filters"), after the Filter field: a chip per
// saved filter, pressed while the board shows it; Save Filter and each chip's menu for an Editor. Applying is this
// viewer's own: Only Mine and a Due Soon window resolve for them, today.
import { useMemo, useState } from 'react';
import {
  SAVED_FILTERS_MAX,
  addSavedFilter,
  finishedStatuses,
  newItemId,
  quickNarrows,
  removeSavedFilter,
  renameSavedFilter,
  resolveSavedFilter,
  savedFilterFrom,
  todayNumber,
  updateSavedFilter,
  type PlanBoardSetup,
  type QuickFilter,
  type SavedBoardFilter,
} from '@liveplanner/items';
import { DUE_SOON_DAYS } from '@liveplanner/plan-art';
import { ChevronDownIcon, PencilIcon, TrashIcon, Tooltip, lucideGlyph } from '@liveplanner/ui';
import { lucideBookmark, lucideBookmarkPlus, lucideRefreshCw } from '@liveworkspace/icons/lucide';
import { ContextMenu } from '@liveworkspace/workbench/components/palette/ContextMenu';
import { MenuActionRow } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { track } from '@/lib/telemetry';
import type { PlanPalette } from '../plan-palette';
import { SavedFilterNamePopover } from './SavedFilterNamePopover';

const BookmarkIcon = lucideGlyph(lucideBookmark, 12);
const SaveIcon = lucideGlyph(lucideBookmarkPlus, 14);
const UpdateIcon = lucideGlyph(lucideRefreshCw, 16);

// A quick filter as a comparable string: empty words and absent keys left out, keys in one order.
export function quickKey(q: QuickFilter): string {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(q).sort()) {
    const v = q[k as keyof QuickFilter];
    if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) continue;
    out[k] = v;
  }
  return JSON.stringify(out);
}

type Naming = { at: HTMLElement; id?: string; initial?: string };

export function SavedFilterChips({
  setup,
  palette,
  quick,
  onQuick,
  mine,
  now,
  canEdit,
  onSetup,
}: {
  setup: PlanBoardSetup;
  palette: PlanPalette;
  quick: QuickFilter;
  onQuick: (q: QuickFilter) => void;
  // The viewer's person id (Only Mine), or null.
  mine: string | null;
  now: Date;
  // An Editor's: Save Filter and each chip's menu.
  canEdit: boolean;
  onSetup: (next: PlanBoardSetup, part: string) => void;
}) {
  const saved = setup.savedFilters;
  const [naming, setNaming] = useState<Naming | null>(null);
  const [menu, setMenu] = useState<{
    id: string;
    at: { x: number; y: number };
    el: HTMLElement;
  } | null>(null);
  const today = todayNumber(now);
  // Each saved filter as it means for this viewer today, and the one the board shows now.
  const resolved = useMemo(() => {
    const finished = finishedStatuses(setup);
    return (saved ?? []).map((f) => ({
      filter: f,
      quick: resolveSavedFilter(f, { mine, today, soonDays: DUE_SOON_DAYS, finished }),
    }));
  }, [saved, setup, mine, today]);
  const nowKey = quickKey(quick);
  const active = resolved.find((r) => quickKey(r.quick) === nowKey)?.filter.id ?? null;
  const narrows = quickNarrows(quick);
  if (!saved?.length && !(canEdit && narrows)) return null;

  const write = (next: SavedBoardFilter[]) =>
    onSetup({ ...setup, savedFilters: next.length ? next : undefined }, 'SavedFilters');

  const save = (name: string) => {
    const filter = savedFilterFrom(quick, name, newItemId());
    write(addSavedFilter(saved, filter));
    track('Plan', 'Added', 'SavedFilter');
    setNaming(null);
  };
  const opened = menu ? saved?.find((f) => f.id === menu.id) : undefined;

  return (
    <span className="flex shrink-0 items-center gap-1" role="group" aria-label="Saved filters">
      {resolved.map(({ filter, quick: q }) => {
        const on = filter.id === active;
        return (
          <span
            key={filter.id}
            className="inline-flex h-7 shrink-0 items-center overflow-hidden rounded-md border text-[12px] font-medium"
            style={{
              borderColor: on ? palette.focus : palette.border,
              color: on ? palette.focus : palette.muted,
              backgroundColor: on ? `${palette.focus}1f` : undefined,
            }}
          >
            <button
              type="button"
              aria-pressed={on}
              className="flex h-full max-w-40 cursor-pointer items-center gap-1 px-2 transition hover:bg-black/5 dark:hover:bg-white/10"
              onClick={() => {
                if (on) onQuick({});
                else {
                  onQuick(q);
                  track('Plan', 'Used', 'SavedFilter');
                }
              }}
            >
              <span aria-hidden className="flex shrink-0">
                <BookmarkIcon />
              </span>
              <span className="truncate">{filter.name}</span>
            </button>
            {canEdit ? (
              <Tooltip label="Saved Filter Options">
                <button
                  type="button"
                  aria-label={`Saved Filter Options: ${filter.name}`}
                  aria-haspopup="menu"
                  className="flex h-full w-5 cursor-pointer items-center justify-center border-l transition hover:bg-black/5 dark:hover:bg-white/10"
                  style={{ borderColor: on ? `${palette.focus}55` : palette.border }}
                  onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    setMenu({
                      id: filter.id,
                      at: { x: r.left, y: r.bottom + 4 },
                      el: e.currentTarget,
                    });
                  }}
                >
                  <ChevronDownIcon size={12} />
                </button>
              </Tooltip>
            ) : null}
          </span>
        );
      })}
      {canEdit && narrows && !active && (saved?.length ?? 0) < SAVED_FILTERS_MAX ? (
        <Tooltip label="Save Filter">
          <button
            type="button"
            aria-label="Save Filter"
            aria-haspopup="dialog"
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-dashed transition hover:bg-black/5 dark:hover:bg-white/10"
            style={{ borderColor: palette.border, color: palette.muted }}
            onClick={(e) => setNaming({ at: e.currentTarget })}
          >
            <SaveIcon />
          </button>
        </Tooltip>
      ) : null}
      {menu && opened ? (
        <ContextMenu position={menu.at} label="Saved filter menu" onClose={() => setMenu(null)}>
          <MenuActionRow
            plain
            label="Rename"
            icon={<PencilIcon />}
            onClick={() => {
              setNaming({ at: menu.el, id: opened.id, initial: opened.name });
              setMenu(null);
            }}
          />
          {narrows && active !== opened.id ? (
            <MenuActionRow
              plain
              label="Update to Current Filters"
              icon={<UpdateIcon />}
              onClick={() => {
                write(updateSavedFilter(saved!, opened.id, quick));
                track('Plan', 'Changed', 'SavedFilter');
                setMenu(null);
              }}
            />
          ) : null}
          <MenuActionRow
            plain
            label="Delete"
            icon={<TrashIcon />}
            onClick={() => {
              write(removeSavedFilter(saved!, opened.id));
              track('Plan', 'Removed', 'SavedFilter');
              setMenu(null);
            }}
          />
        </ContextMenu>
      ) : null}
      {naming ? (
        <SavedFilterNamePopover
          anchor={naming.at}
          title={naming.id ? 'Rename Filter' : 'Save Filter'}
          initial={naming.initial ?? ''}
          saved={saved}
          {...(naming.id ? { exceptId: naming.id } : {})}
          onClose={() => setNaming(null)}
          onSave={(name) => {
            if (!naming.id) return save(name);
            write(renameSavedFilter(saved!, naming.id, name));
            track('Plan', 'Renamed', 'SavedFilter');
            setNaming(null);
          }}
        />
      ) : null}
    </span>
  );
}
