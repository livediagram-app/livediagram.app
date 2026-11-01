'use client';

// The widget zone's + (docs/specs/026-plan/board-widgets.md "The widget gallery"): Add a Widget, a gallery of every
// widget the board can hold. A rail down its left names the sections (For You, Focus, Progress, People, Dates, Health,
// then each card type's fields) and scrolls to one; the list beside it draws each widget live from this board's own
// cards as a tile, two to a row. A tile adds its widget at the end of the header, or takes it off when the board has
// it, and the gallery stays open for the next. A search narrows every section as it is typed. The arrow keys move
// between tiles; previews are drawn only as their tiles come into view.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  FIELD_WIDGETS_MAX,
  fieldWidgetCount,
  type BoardField,
  type BoardWidgetId,
} from '@liveplanner/items';
import type { WidgetSuggestion } from '@liveplanner/plan-art';
import { CompactEmptyState, NoMatches, lucideGlyph } from '@liveplanner/ui';
import { lucideSearch } from '@liveworkspace/icons/lucide';
import { AnchoredPopover } from '@liveworkspace/workbench/components/primitives/AnchoredPopover';
import { SparkArt, FieldWidgetArt } from '../plan-tile-art';
import type { PlanPalette } from '../plan-palette';
import { gallerySections, sectionSize, type GallerySection } from './widget-gallery-model';
import { WidgetGalleryTile } from './WidgetGalleryTile';
import { WidgetGalleryRail } from './WidgetGalleryRail';
import { SeenContext, useSeenRoot } from './use-seen';

const SearchGlyph = lucideGlyph(lucideSearch, 14);

export const GALLERY_WIDTH = 720;

export function BoardWidgetPicker({
  anchor,
  widgets,
  fields = [],
  suggestions = [],
  onToggle,
  onClose,
  render,
  palette,
}: {
  anchor: HTMLElement;
  // The board's widgets: shown On Board.
  widgets: readonly BoardWidgetId[];
  // The fields the board's widgets can read, and For You's suggestions.
  fields?: readonly BoardField[];
  suggestions?: readonly WidgetSuggestion[];
  onToggle: (id: BoardWidgetId) => void;
  onClose: () => void;
  // The widget as the board draws it (its live preview), and the board's colours to draw it on.
  render?: ((id: BoardWidgetId) => ReactNode) | undefined;
  palette?: PlanPalette | undefined;
}) {
  const [query, setQuery] = useState('');
  // For You is worked out when the gallery opens, so adding one of its widgets marks it On Board rather than
  // reshuffling the section under the pointer.
  const [picked] = useState(suggestions);
  const sections = useMemo(
    () => gallerySections({ fields, suggestions: picked, query }),
    [fields, picked, query],
  );
  const list = useRef<HTMLDivElement>(null);
  const watch = useSeenRoot(list);
  const [current, setCurrent] = useState<string | null>(sections[0]?.key ?? null);
  const full = fieldWidgetCount(widgets) >= FIELD_WIDGETS_MAX;
  // Said to a screen reader after each press: what was added or taken off.
  const [said, setSaid] = useState('');

  // The section in view: the last whose top has reached the list's top.
  const spy = () => {
    const box = list.current;
    if (!box) return;
    let at: string | null = sections[0]?.key ?? null;
    for (const el of box.querySelectorAll<HTMLElement>('[data-gallery-section]'))
      if (el.offsetTop - box.offsetTop <= box.scrollTop + 8) at = el.dataset.gallerySection ?? at;
    setCurrent(at);
  };
  // A search may drop the current section: back to the first, at the top.
  const first = sections[0]?.key ?? null;
  useEffect(() => {
    setCurrent(first);
    list.current?.scrollTo?.({ top: 0 });
    // On a new search only, never as the board's widgets change under it.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [query]);

  const goTo = (key: string) => {
    const box = list.current;
    const el = box?.querySelector<HTMLElement>(`[data-gallery-section="${key}"]`);
    if (!box || !el) return;
    const top = el.offsetTop - box.offsetTop;
    const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (box.scrollTo) box.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
    else box.scrollTop = top;
    setCurrent(key);
  };

  const toggle = (id: BoardWidgetId, fullName: string) => {
    setSaid(widgets.includes(id) ? `${fullName} taken off the board` : `${fullName} added`);
    onToggle(id);
  };

  // The arrow keys move between tiles in reading order: left and right one, up and down a row (two to a row, one in
  // a narrow gallery: the tile straight above or below).
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'];
    if (!keys.includes(e.key) || !list.current) return;
    const cards = [...list.current.querySelectorAll<HTMLButtonElement>('button[data-widget-card]')];
    const at = cards.indexOf(document.activeElement as HTMLButtonElement);
    const next = at < 0 ? cards[0] : cards[stepFrom(cards, at, e.key)];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };

  const anyTiles = sections.some((s) => sectionSize(s) > 0);
  return (
    <AnchoredPopover anchor={anchor} name="Add a Widget" width={GALLERY_WIDTH} onClose={onClose}>
      <div className="@container flex max-h-[min(76vh,40rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-100 px-4 pb-3 pt-3.5 dark:border-slate-800">
          <div className="min-w-[12rem] flex-1">
            <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">
              Add a Widget
            </h3>
            <p className="text-[12px] text-slate-500 dark:text-slate-400">
              Live read-outs for this board’s header. Pick as many as you like.
            </p>
          </div>
          <label className="flex w-56 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-slate-400 focus-within:border-brand-400 @max-[600px]:w-full dark:border-slate-700">
            <SearchGlyph />
            <input
              autoFocus
              aria-label="Find a widget"
              placeholder="Find a widget"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowDown') return;
                const first = list.current?.querySelector<HTMLButtonElement>(
                  'button[data-widget-card]',
                );
                if (!first) return;
                e.preventDefault();
                first.focus();
              }}
              className="min-w-0 flex-1 bg-transparent text-[12px] text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
            />
          </label>
        </div>
        <div className="flex min-h-[18rem] flex-1 overflow-hidden @max-[600px]:flex-col">
          {anyTiles || !query ? (
            <WidgetGalleryRail sections={sections} current={current} onPick={goTo} />
          ) : null}
          <SeenContext.Provider value={watch}>
            <div
              ref={list}
              data-gallery-list=""
              className="relative min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4"
              onScroll={spy}
              onKeyDown={onKeyDown}
            >
              {query && !anyTiles ? (
                <NoMatches size="regular" className="py-10" things="widgets" query={query} />
              ) : (
                sections.map((s) => (
                  <Section
                    key={s.key}
                    section={s}
                    widgets={widgets}
                    full={full}
                    render={render}
                    palette={palette}
                    onToggle={toggle}
                  />
                ))
              )}
            </div>
          </SeenContext.Provider>
        </div>
        <span className="sr-only" aria-live="polite">
          {said}
        </span>
      </div>
    </AnchoredPopover>
  );
}

// The index the arrow key moves to from `at`: by where the tiles sit when laid out (the nearest in the row above or
// below, the next or previous in reading order), else two to a row.
function stepFrom(cards: readonly HTMLElement[], at: number, key: string): number {
  const clamp = (i: number) => Math.min(cards.length - 1, Math.max(0, i));
  if (key === 'ArrowRight') return clamp(at + 1);
  if (key === 'ArrowLeft') return clamp(at - 1);
  const here = cards[at]!.getBoundingClientRect();
  if (here.height === 0) return clamp(at + (key === 'ArrowDown' ? 2 : -2));
  const down = key === 'ArrowDown';
  let best = at;
  let bestScore = Infinity;
  cards.forEach((c, i) => {
    const r = c.getBoundingClientRect();
    const dy = down ? r.top - here.bottom : here.top - r.bottom;
    if (dy < -1) return;
    const score = dy * 1000 + Math.abs(r.left - here.left);
    if (score < bestScore) {
      best = i;
      bestScore = score;
    }
  });
  return best;
}

function Section({
  section,
  widgets,
  full,
  render,
  palette,
  onToggle,
}: {
  section: GallerySection;
  widgets: readonly BoardWidgetId[];
  full: boolean;
  render?: ((id: BoardWidgetId) => ReactNode) | undefined;
  palette?: PlanPalette | undefined;
  onToggle: (id: BoardWidgetId, fullName: string) => void;
}) {
  const tiles = (list: GallerySection['tiles']) => (
    <div className="grid grid-cols-2 gap-2 @max-[460px]:grid-cols-1">
      {list.map((t) => {
        const on = widgets.includes(t.id);
        return (
          <WidgetGalleryTile
            key={t.id}
            tile={t}
            on={on}
            capped={!on && !!t.field && full}
            preview={render}
            palette={palette}
            onToggle={() => onToggle(t.id, t.fullName)}
          />
        );
      })}
    </div>
  );
  const headingId = `gallery-${section.key}`;
  return (
    <section data-gallery-section={section.key} aria-labelledby={headingId} className="pt-4">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
        <h4
          id={headingId}
          className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-800 dark:text-slate-100"
        >
          {section.key === 'for-you' ? (
            <span aria-hidden className="flex text-brand-700 dark:text-brand-300">
              <SparkArt size={13} />
            </span>
          ) : null}
          {section.title}
        </h4>
        {/* slate-500 on the white gallery is 4.8:1, slate-400 on its dark one 6.9:1 (WCAG AA 4.5:1). */}
        <span data-group-line className="text-[11px] text-slate-500 dark:text-slate-400">
          {section.line}
        </span>
      </div>
      {sectionSize(section) === 0 ? (
        <CompactEmptyState
          className="rounded-xl border border-dashed border-slate-200 py-5 dark:border-slate-700"
          icon={
            section.key === 'for-you' ? <SparkArt size={18} /> : <FieldWidgetArt view="breakdown" />
          }
          title={section.empty.title}
          description={section.empty.description}
        />
      ) : section.fields.length ? (
        <div className="flex flex-col gap-3">
          {section.fields.map((g) => (
            <div key={g.field.def.id} data-gallery-field={g.field.def.id}>
              <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-[12px] font-medium text-slate-700 dark:text-slate-200">
                  {g.field.def.label}
                </span>
                <span className="rounded-full bg-slate-100 px-1.5 py-px text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {g.kindLabel}
                </span>
                {g.also ? (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">{g.also}</span>
                ) : null}
              </div>
              {tiles(g.tiles)}
            </div>
          ))}
        </div>
      ) : (
        tiles(section.tiles)
      )}
    </section>
  );
}
