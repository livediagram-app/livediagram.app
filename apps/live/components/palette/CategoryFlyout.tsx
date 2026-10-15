'use client';

import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@livediagram/ui';
import type { PendingDraw } from '@/lib/draw-mode';
import { setPaletteDragPreview } from '@/lib/palette-drag-preview';
import { usePlanCardTileDisabled } from '@/hooks/plan/card-types-taken';
import { tileDisplayName, type PaletteTileDef } from './palette-tile-defs';
import { tileActive, tileHandler, visibleTiles, type PaletteTileActions } from './PaletteTileGrid';
import { tileDragStart } from './palette-tile-drag';
import { useTileGlyph } from './PaletteIconButton';
import {
  flyoutColumns,
  flyoutGroups,
  flyoutKeyTarget,
  flyoutLayout,
  flyoutTagline,
} from './category-flyout-groups';

// The category bar's flyout (docs/specs/007-editor/toolbar-layout.md "Diagram's category bar"): one category's
// tiles under its name, in its named groups, as a grid of pictures (Shapes) or cards with a blurb (Build). A footer
// says what the pointed-at tile does and its key. A tile with presets, or an opener (Popular's AWS), drills in
// within the flyout, with a back button, rather than opening a second popover. A catalogue (Icons, Technology,
// My shapes) shows its own browse instead, under the same header.

export type FlyoutCategory = {
  id: string;
  label: string;
  description: string;
  icon: ReactNode;
  // Null for a catalogue, whose body is `content`.
  tiles: readonly PaletteTileDef[] | null;
  content: ReactNode;
};

// What a tile drilled into: its presets, or a category (or catalogue group) an opener stands for.
type Drill =
  | { kind: 'variants'; label: string; hint: string; tiles: readonly PaletteTileDef[] }
  | { kind: 'open'; label: string; body: ReactNode };

const PRESETS_HINT = 'Start from a preset, then change any of it.';
const DEFAULT_HINT = 'Click to add one, or drag it onto the canvas.';

export function CategoryFlyout({
  category,
  actions,
  pendingDraw,
  focusFirst,
  openBody,
}: {
  category: FlyoutCategory;
  actions: PaletteTileActions;
  pendingDraw: PendingDraw | null;
  // Opened from the keyboard: the first tile takes focus, so the arrows carry on from there.
  focusFirst: boolean;
  // The body an opener tile stands for (its category's browse, at its group).
  openBody: (categoryId: string, group: string | null) => ReactNode;
}) {
  const [drill, setDrill] = useState<Drill | null>(null);
  // The tile under the pointer or the focus, which the footer describes.
  const [hovered, setHovered] = useState<PaletteTileDef | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const tiles = category.tiles ? visibleTiles([...category.tiles], actions.hasImage) : null;
  const drillTo = (next: Drill | null) => {
    setDrill(next);
    setHovered(null);
  };

  // Keyboard entry focuses the first tile; a drill in or out does too, so the arrows never lose their place.
  useLayoutEffect(() => {
    if (!focusFirst && drill === null) return;
    bodyRef.current?.querySelector<HTMLElement>('[data-flyout-item]')?.focus();
  }, [focusFirst, drill]);

  // Arrow keys walk the tiles by position (category-flyout-groups), across the groups.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Backspace' && drill) {
      e.preventDefault();
      drillTo(null);
      return;
    }
    const items = [...(bodyRef.current?.querySelectorAll<HTMLElement>('[data-flyout-item]') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (index < 0) return;
    const points = items.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    const next = flyoutKeyTarget(e.key, index, points);
    if (next === null) return;
    e.preventDefault();
    items[next]?.focus();
  };

  const pressTile = (def: PaletteTileDef) => {
    if (def.variants && def.variants.length > 0) {
      drillTo({
        kind: 'variants',
        label: tileDisplayName(def),
        hint: def.variantsHint ?? PRESETS_HINT,
        tiles: def.variants,
      });
      return;
    }
    const a = def.action;
    if (a.type === 'open') {
      drillTo({ kind: 'open', label: def.label, body: openBody(a.category, a.group ?? null) });
      return;
    }
    tileHandler(def, actions, pendingDraw)();
  };

  const title = drill ? drill.label : category.label;
  const tagline = drill
    ? drill.kind === 'variants'
      ? drill.hint
      : `From ${category.label}.`
    : flyoutTagline(category.id, category.description);
  const count = drill?.kind === 'variants' ? drill.tiles.length : drill ? null : tiles?.length;

  return (
    <div data-tour-id="palette-category-menu" className="flex flex-col">
      <header className="flex items-center gap-3 border-b border-slate-100 px-3.5 pb-3 pt-3.5 dark:border-slate-800">
        {drill ? (
          <button
            type="button"
            aria-label={`Back to ${category.label}`}
            onClick={() => drillTo(null)}
            className="-ml-1 flex h-9 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
        ) : null}
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700 ring-1 ring-brand-200/70 dark:from-brand-500/20 dark:to-brand-500/10 dark:text-brand-200 dark:ring-brand-500/30 [&_svg]:h-[18px] [&_svg]:w-[18px]"
        >
          {category.icon}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="truncate text-[14px] font-semibold leading-tight text-slate-900 dark:text-slate-50">
            {drill ? (
              <>
                <span className="font-normal text-slate-400 dark:text-slate-500">
                  {category.label} /{' '}
                </span>
                {title}
              </>
            ) : (
              title
            )}
          </h3>
          <p className="truncate text-[12px] leading-snug text-slate-500 dark:text-slate-400">
            {tagline}
          </p>
        </div>
        {count ? (
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {count}
          </span>
        ) : null}
      </header>

      {/* Keyed on what it shows, so a switch or a drill fades the new body in and replays the tiles' cascade. */}
      <div
        key={`${category.id}/${drill?.label ?? ''}`}
        ref={bodyRef}
        onKeyDown={onKeyDown}
        className="animate-fade-in"
      >
        {drill?.kind === 'open' ? (
          <div className="px-2 py-2.5">{drill.body}</div>
        ) : drill?.kind === 'variants' ? (
          <div className="p-3">
            <CardList
              tiles={visibleTiles([...drill.tiles], actions.hasImage)}
              actions={actions}
              pendingDraw={pendingDraw}
              onPress={pressTile}
              onHover={setHovered}
            />
          </div>
        ) : tiles ? (
          <div className="flex flex-col gap-3 p-3">
            {flyoutGroups(category.id, tiles).map((group, gi) => (
              <section key={group.id} aria-label={group.title ?? category.label}>
                {group.title ? (
                  <h4 className="mb-1.5 flex items-center gap-2 px-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {group.title}
                    <span aria-hidden className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                  </h4>
                ) : null}
                {flyoutLayout(category.id) === 'grid' ? (
                  <TileGrid
                    tiles={group.tiles}
                    offset={gi * 4}
                    columns={flyoutColumns(category.id)}
                    actions={actions}
                    pendingDraw={pendingDraw}
                    onPress={pressTile}
                    onHover={setHovered}
                  />
                ) : (
                  <CardList
                    tiles={group.tiles}
                    actions={actions}
                    pendingDraw={pendingDraw}
                    onPress={pressTile}
                    onHover={setHovered}
                  />
                )}
              </section>
            ))}
          </div>
        ) : (
          <div className="px-2 py-2.5">{category.content}</div>
        )}
      </div>

      {/* What the pointed-at tile does, and its key: the hover card's job, without the wait. Tiles only. */}
      {tiles || drill?.kind === 'variants' ? <InfoFooter def={hovered} /> : null}
    </div>
  );
}

function InfoFooter({ def }: { def: PaletteTileDef | null }) {
  const presets = !!def?.variants?.length;
  const opener = def?.action.type === 'open';
  return (
    <footer
      aria-live="polite"
      className="flex min-h-[52px] items-center gap-3 rounded-b-xl border-t border-slate-100 bg-slate-50/80 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-950/40"
    >
      {def ? (
        <>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[12px] font-semibold text-slate-800 dark:text-slate-100">
              {tileDisplayName(def)}
            </span>
            <span className="line-clamp-2 text-[11.5px] leading-snug text-slate-500 dark:text-slate-400">
              {presets
                ? 'Choose a preset to start from.'
                : opener
                  ? `Browse ${def.label}.`
                  : def.description}
            </span>
          </div>
          {def.shortcut ? (
            <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-slate-400">
              Press
              <Kbd>{def.shortcut}</Kbd>
            </span>
          ) : null}
        </>
      ) : (
        <span className="text-[11.5px] text-slate-500 dark:text-slate-400">{DEFAULT_HINT}</span>
      )}
    </footer>
  );
}

function Kbd({ children, small }: { children: ReactNode; small?: boolean }) {
  return (
    <kbd
      className={`inline-flex items-center justify-center rounded border border-slate-200 bg-white font-sans font-semibold uppercase leading-none text-slate-600 shadow-[0_1px_0_0] shadow-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:shadow-slate-700 ${
        small ? 'h-4 min-w-4 px-1 text-[9px]' : 'h-5 min-w-5 px-1.5 text-[10.5px]'
      }`}
    >
      {children}
    </kbd>
  );
}

type ItemProps = {
  def: PaletteTileDef;
  actions: PaletteTileActions;
  pendingDraw: PendingDraw | null;
  onPress: (def: PaletteTileDef) => void;
  onHover: (def: PaletteTileDef | null) => void;
};

/** A flyout tile's shared wiring: its press, its drag onto the canvas (with the canvas ghost), its armed and
 *  refused states, and its glyph's theme tint, all as the strip's own tile has them. */
function useFlyoutItem({ def, pendingDraw, onPress, onHover }: ItemProps) {
  const a = def.action;
  const refusal = usePlanCardTileDisabled(a);
  const disabledReason = (def.disabled ?? refusal)?.reason;
  const active = tileActive(def, pendingDraw);
  const drills = !!def.variants?.length || a.type === 'open';
  const drag = disabledReason || drills ? undefined : tileDragStart(a);
  const glyph = useTileGlyph({
    dragKind: a.type === 'shape' ? a.kind : undefined,
    filled: def.filled,
    noTint: def.noTint,
    plain: active || !!disabledReason,
    finishAction: a,
  });
  const props = {
    type: 'button' as const,
    'data-flyout-item': '',
    'aria-label': def.label,
    'aria-pressed': active || undefined,
    'aria-disabled': disabledReason ? true : undefined,
    title: disabledReason,
    onClick: disabledReason ? undefined : () => onPress(def),
    draggable: drag !== undefined || undefined,
    onDragStart: drag,
    // The drag's canvas preview goes with the drag, dropped or not.
    onDragEnd: () => setPaletteDragPreview(null),
    onPointerEnter: () => onHover(def),
    onFocus: () => onHover(def),
  };
  return { props, glyph, active, disabled: !!disabledReason, drills };
}

function TileGrid({
  tiles,
  offset,
  columns,
  ...rest
}: Omit<ItemProps, 'def'> & { tiles: readonly PaletteTileDef[]; offset: number; columns: number }) {
  return (
    <ul
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      className="grid gap-1.5"
    >
      {tiles.map((def, i) => (
        <li
          key={def.id}
          className="stagger-enter flex animate-pop-in"
          style={{ '--stagger-i': offset + i } as React.CSSProperties}
        >
          <GridTile def={def} {...rest} />
        </li>
      ))}
    </ul>
  );
}

function GridTile(item: ItemProps) {
  const { def } = item;
  const { props, glyph, active, disabled, drills } = useFlyoutItem(item);
  return (
    <button
      {...props}
      className={`group relative flex h-[72px] w-full flex-col items-center justify-center gap-1.5 rounded-xl px-1 ring-1 transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 ${
        disabled
          ? 'cursor-not-allowed opacity-50 ring-transparent'
          : active
            ? 'bg-brand-50 text-brand-700 ring-brand-300 dark:bg-brand-500/20 dark:text-brand-100 dark:ring-brand-500/50'
            : 'text-slate-600 ring-transparent hover:bg-slate-50 hover:text-slate-900 hover:ring-slate-200 hover:shadow-sm dark:text-slate-200 dark:hover:bg-slate-800/70 dark:hover:text-white dark:hover:ring-slate-700'
      }`}
    >
      <span
        aria-hidden
        style={glyph.glyphStyle}
        className={`${glyph.glyphClass}flex h-7 items-center justify-center transition-transform duration-micro group-hover:-translate-y-0.5 [&>svg]:h-6 [&>svg]:w-6`}
      >
        {def.icon}
      </span>
      <span className="w-full truncate text-center text-[11px] leading-none">
        {tileDisplayName(def)}
      </span>
      {def.shortcut && !disabled ? (
        <span className="pointer-events-none absolute right-1.5 top-1.5 pointer-coarse:hidden">
          <Kbd small>{def.shortcut}</Kbd>
        </span>
      ) : null}
      {drills ? (
        <ChevronRightIcon className="pointer-events-none absolute right-1 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
      ) : null}
    </button>
  );
}

function CardList({
  tiles,
  ...rest
}: Omit<ItemProps, 'def'> & { tiles: readonly PaletteTileDef[] }) {
  return (
    <ul className="grid grid-cols-2 gap-1">
      {tiles.map((def, i) => (
        <li
          key={def.id}
          className="stagger-enter flex animate-fade-in"
          style={{ '--stagger-i': i } as React.CSSProperties}
        >
          <Card def={def} {...rest} />
        </li>
      ))}
    </ul>
  );
}

function Card(item: ItemProps) {
  const { def } = item;
  const { props, glyph, active, disabled, drills } = useFlyoutItem(item);
  return (
    <button
      {...props}
      className={`group flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left ring-1 transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 ${
        disabled
          ? 'cursor-not-allowed opacity-50 ring-transparent'
          : active
            ? 'bg-brand-50 ring-brand-300 dark:bg-brand-500/20 dark:ring-brand-500/50'
            : 'ring-transparent hover:bg-slate-50 hover:ring-slate-200 dark:hover:bg-slate-800/70 dark:hover:ring-slate-700'
      }`}
    >
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-700 ring-1 ring-slate-200/80 transition group-hover:bg-white group-hover:shadow-sm dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700 dark:group-hover:bg-slate-900"
      >
        <span
          style={glyph.glyphStyle}
          className={`${glyph.glyphClass}flex items-center justify-center transition-transform duration-micro group-hover:scale-110 [&>svg]:h-5 [&>svg]:w-5`}
        >
          {def.icon}
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold leading-tight text-slate-800 dark:text-slate-100">
          <span className="truncate">{tileDisplayName(def)}</span>
          {def.shortcut && !disabled ? <Kbd small>{def.shortcut}</Kbd> : null}
        </span>
        <span className="line-clamp-2 text-[11.5px] leading-snug text-slate-500 dark:text-slate-400">
          {drills && def.variants?.length
            ? `${def.variants.length} presets`
            : (def.blurb ?? def.description)}
        </span>
      </span>
      {drills ? (
        <ChevronRightIcon className="h-3.5 w-3.5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-600" />
      ) : null}
    </button>
  );
}
