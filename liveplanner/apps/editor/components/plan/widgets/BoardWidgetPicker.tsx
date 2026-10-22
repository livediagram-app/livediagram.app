'use client';

// The widget zone's + (docs/specs/026-plan/board-widgets.md "The widget gallery"): a gallery under it of every widget,
// grouped by what it is for (Focus the Board, Track Progress, Keep It Healthy). Each card shows the widget live,
// drawn from this board's own cards as it would sit in the header, over its name and line; a widget already on the
// board is left out (a section left with none goes too). A search narrows the gallery as it is typed. Picking a card adds the widget
// at the end of the header; the gallery closes. The cards are a grid the arrow keys move through.
import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { BOARD_WIDGET_KINDS, type BoardWidgetKind } from '@liveplanner/items';
import { CheckIcon, CompactEmptyState, NoMatches, lucideGlyph } from '@liveplanner/ui';
import { lucideSearch } from '@liveplanner/icons/lucide';
import { AnchoredPopover } from '@/components/primitives/AnchoredPopover';
import { BOARD_WIDGET_INFO } from '@liveplanner/plan-art';
import { BoardWidgetArt } from '../plan-tile-art';
import type { PlanPalette } from '../plan-palette';

const SearchGlyph = lucideGlyph(lucideSearch, 14);

// What each widget is for: the gallery's sections, in order. Every widget kind is in exactly one.
export const WIDGET_GROUPS: readonly {
  title: string;
  line: string;
  kinds: readonly BoardWidgetKind[];
}[] = [
  {
    title: 'Focus the Board',
    line: 'Narrow the cards to the ones that matter right now.',
    kinds: ['filter', 'mine', 'people', 'priorities', 'types', 'unassigned'],
  },
  {
    title: 'Track Progress',
    line: 'See how the work is going at a glance.',
    kinds: ['count', 'progress', 'points', 'due', 'top-voted'],
  },
  {
    title: 'Keep It Healthy',
    line: 'Catch what is stuck, overloaded or off the board.',
    kinds: ['wip', 'stale', 'unplaced'],
  },
];

// The widgets a search matches, by name or line (case and spacing ignored).
function widgetsMatching(query: string): ReadonlySet<BoardWidgetKind> {
  const q = query.trim().toLowerCase();
  return new Set(
    BOARD_WIDGET_KINDS.filter((k) => {
      if (!q) return true;
      const info = BOARD_WIDGET_INFO[k];
      return `${info.label} ${info.description}`.toLowerCase().includes(q);
    }),
  );
}

export function BoardWidgetPicker({
  anchor,
  widgets,
  onPick,
  onClose,
  render,
  palette,
}: {
  anchor: HTMLElement;
  // The board's widgets: left out of the gallery.
  widgets: readonly BoardWidgetKind[];
  onPick: (kind: BoardWidgetKind) => void;
  onClose: () => void;
  // The widget as the board draws it (its live preview), and the board's colours to draw it on.
  render?: ((kind: BoardWidgetKind) => ReactNode) | undefined;
  palette?: PlanPalette | undefined;
}) {
  const [query, setQuery] = useState('');
  const matching = useMemo(() => widgetsMatching(query), [query]);
  const grid = useRef<HTMLDivElement>(null);
  const groups = WIDGET_GROUPS.map((g) => ({
    ...g,
    kinds: g.kinds.filter((k) => matching.has(k) && !widgets.includes(k)),
  })).filter((g) => g.kinds.length > 0);
  const allOn = BOARD_WIDGET_KINDS.every((k) => widgets.includes(k));
  // The arrow keys move between the cards that can be picked, in reading order.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'];
    if (!keys.includes(e.key) || !grid.current) return;
    const cards = [...grid.current.querySelectorAll<HTMLButtonElement>('button[data-widget-card]')];
    const at = cards.indexOf(document.activeElement as HTMLButtonElement);
    const step =
      e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' ? 2 : -2;
    const next = cards[Math.min(cards.length - 1, Math.max(0, at < 0 ? 0 : at + step))];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };
  return (
    <AnchoredPopover anchor={anchor} name="Add a Widget" width={560} onClose={onClose}>
      <div className="flex max-h-[min(72vh,36rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 pb-3 pt-3.5 dark:border-slate-800">
          <div className="min-w-0 flex-1">
            <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">
              Add a Widget
            </h3>
            <p className="text-[12px] text-slate-500 dark:text-slate-400">
              Widgets sit in the board’s header, live as its cards change.
            </p>
          </div>
          <label className="flex w-44 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-slate-400 focus-within:border-brand-400 dark:border-slate-700">
            <SearchGlyph />
            <input
              autoFocus
              aria-label="Find a widget"
              placeholder="Find a widget"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[12px] text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
            />
          </label>
        </div>
        <div
          ref={grid}
          className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-4"
          onKeyDown={onKeyDown}
        >
          {allOn ? (
            <CompactEmptyState
              className="py-6"
              icon={<CheckIcon />}
              title="No widgets left to add"
              description="Every widget is on this board."
            />
          ) : groups.length === 0 ? (
            <NoMatches size="regular" className="py-6" things="widgets" query={query} />
          ) : (
            groups.map((g) => (
              <section key={g.title} aria-label={g.title} className="pt-3.5">
                <div className="mb-2 flex items-baseline gap-2">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {g.title}
                  </h4>
                  {/* slate-500 on the white gallery is 4.8:1, slate-400 on its dark one 6.9:1 (WCAG AA 4.5:1). */}
                  <span
                    data-group-line
                    className="truncate text-[11px] text-slate-500 dark:text-slate-400"
                  >
                    {g.line}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {g.kinds.map((kind) => (
                    <WidgetCard
                      key={kind}
                      kind={kind}
                      preview={render?.(kind)}
                      palette={palette}
                      onPick={() => onPick(kind)}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </AnchoredPopover>
  );
}

function WidgetCard({
  kind,
  preview,
  palette,
  onPick,
}: {
  kind: BoardWidgetKind;
  preview: ReactNode;
  palette?: PlanPalette | undefined;
  onPick: () => void;
}) {
  const info = BOARD_WIDGET_INFO[kind];
  // A container, not a button: the live preview holds buttons of its own. One button covers the card for the pick.
  return (
    <div
      className={`group relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 transition duration-micro motion-reduce:transition-none dark:border-slate-700 hover:-translate-y-px hover:border-brand-300 hover:shadow-md motion-reduce:hover:translate-y-0 dark:hover:border-brand-500/60`}
    >
      {/* The widget live, as it would sit in this board's header. */}
      <span
        aria-hidden
        inert
        className="pointer-events-none flex h-14 w-full items-center overflow-hidden px-3"
        style={
          palette
            ? {
                backgroundColor: palette.surface,
                color: palette.text,
                borderBottom: `1px solid ${palette.border}`,
              }
            : undefined
        }
      >
        {preview ?? (
          <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <BoardWidgetArt kind={kind} size={18} />
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5 px-3 py-2.5 text-left">
        <span className="flex items-center gap-1.5 text-[13px] font-medium text-slate-800 dark:text-slate-100">
          <span aria-hidden className="flex shrink-0 text-slate-400 group-hover:text-brand-700">
            <BoardWidgetArt kind={kind} size={14} />
          </span>
          <span className="truncate">{info.label}</span>
        </span>
        <span className="line-clamp-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          {info.description}
        </span>
      </span>
      <button
        type="button"
        data-widget-card=""
        aria-label={`Add ${info.label}`}
        onClick={onPick}
        className="absolute inset-0 cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
      />
    </div>
  );
}
