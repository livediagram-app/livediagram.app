'use client';

// The widget zone's + (docs/specs/026-plan/board-widgets.md "The widget gallery"): Add a Widget, a gallery of every
// widget the board can hold, on the galleries' shared frame (GalleryFrame, shared with Add Field). A rail down its left
// names the sections (For You, Focus, Progress, People, Dates, Health, then each card type's fields) and scrolls to
// one; the list beside it draws each widget live from this board's own cards as a tile, two to a row. A tile adds its
// widget at the end of the header, or takes it off when the board has it, and the gallery stays open for the next. A
// search narrows every section as it is typed. The arrow keys move between tiles (gallery-keys.ts); previews are drawn
// only as their tiles come into view.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  FIELD_WIDGETS_MAX,
  fieldWidgetCount,
  type BoardField,
  type BoardWidgetId,
} from '@liveplanner/items';
import type { WidgetSuggestion } from '@liveplanner/plan-art';
import { CompactEmptyState, NoMatches } from '@liveplanner/ui';
import { AnchoredPopover } from '@liveworkspace/workbench/components/primitives/AnchoredPopover';
import { SparkArt, FieldWidgetArt } from '../plan-tile-art';
import type { PlanPalette } from '../plan-palette';
import {
  GALLERY_WIDTH,
  GalleryFrame,
  GalleryList,
  GallerySectionHeading,
} from '../gallery/GalleryFrame';
import { moveAmongTiles } from '../gallery/gallery-keys';
import { gallerySections, sectionSize, type GallerySection } from './widget-gallery-model';
import { WidgetGalleryTile } from './WidgetGalleryTile';
import { WidgetGalleryRail } from './WidgetGalleryRail';
import { SeenContext, useSeenRoot } from './use-seen';

const TILES = 'button[data-widget-card]';

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
  const searchRef = useRef<HTMLInputElement>(null);
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

  const tiles = () => [...(list.current?.querySelectorAll<HTMLElement>(TILES) ?? [])];
  const anyTiles = sections.some((s) => sectionSize(s) > 0);
  return (
    <AnchoredPopover anchor={anchor} name="Add a Widget" width={GALLERY_WIDTH} onClose={onClose}>
      <GalleryFrame
        title="Add a Widget"
        line="Live read-outs for this board’s header. Pick as many as you like."
        search={{
          label: 'Find a widget',
          placeholder: 'Find a widget',
          value: query,
          onChange: setQuery,
          autoFocus: true,
          onKeyDown: (e) => {
            const firstTile = tiles()[0];
            if (e.key !== 'ArrowDown' || !firstTile) return;
            e.preventDefault();
            firstTile.focus();
          },
        }}
        searchRef={searchRef}
        onClose={() => {
          onClose();
          anchor.focus();
        }}
        rail={
          anyTiles || !query ? (
            <WidgetGalleryRail sections={sections} current={current} onPick={goTo} />
          ) : null
        }
        said={said}
      >
        <SeenContext.Provider value={watch}>
          <GalleryList
            ref={list}
            onScroll={spy}
            onKeyDown={(e) => moveAmongTiles(e, tiles(), searchRef.current)}
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
          </GalleryList>
        </SeenContext.Provider>
      </GalleryFrame>
    </AnchoredPopover>
  );
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
      <GallerySectionHeading
        id={headingId}
        icon={section.key === 'for-you' ? <SparkArt size={13} /> : undefined}
        title={section.title}
        line={section.line}
      />
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
