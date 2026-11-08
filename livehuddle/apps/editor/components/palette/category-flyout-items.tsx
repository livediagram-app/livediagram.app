'use client';

import type { ReactNode } from 'react';
import { ChevronRightIcon } from '@livehuddle/ui';
import type { PendingDraw } from '@/lib/draw-mode';
import { setPaletteDragPreview } from '@/lib/palette-drag-preview';
import { tileDisplayName, type PaletteTileDef } from './palette-tile-defs';
import { tileActive, type PaletteTileActions } from './PaletteTileGrid';
import { tileCarryStart, tileDragStart } from './palette-tile-drag';
import { useTileGlyph } from './PaletteIconButton';
import { tileEnterAnimation } from './palette-tile-finish';
import { useTabFinish } from '@/components/canvas/CanvasFinishContext';
import { PointerWords } from '@liveworkspace/workbench/components/palette/PointerWords';

// The category flyout's tiles (CategoryFlyout, CategoryFlyoutSide): a picture tile for the grid categories, a card
// with its blurb for the rest, and the footer that describes the pointed-at one. Each places, drags and tints as the
// strip's own tile does; a tile with presets, or an opener, opens a side panel instead of placing.

// A touch screen taps, so its hint says so (docs/specs/008-canvas/canvas-and-palette.md); each shows on its own pointer.
const DEFAULT_HINT = 'Click to add one, or drag it onto the canvas.';
const TOUCH_HINT = 'Tap to add one, or drag it onto the canvas.';

/** Whether pressing this tile opens a side panel (its presets) rather than placing. */
export function opensSide(def: PaletteTileDef): boolean {
  return !!def.variants?.length;
}

type ItemProps = {
  def: PaletteTileDef;
  actions: PaletteTileActions;
  pendingDraw: PendingDraw | null;
  onPress: (def: PaletteTileDef, el: HTMLElement) => void;
  onHover: (def: PaletteTileDef | null, el: HTMLElement | null) => void;
  // The tile whose side panel is open, drawn as pressed.
  sideOpenId?: string | null;
};

/** A flyout tile's shared wiring: its press, its drag onto the canvas (with the canvas ghost), its armed and
 *  refused states, and its glyph's theme tint, all as the strip's own tile has them. */
function useFlyoutItem({ def, pendingDraw, onPress, onHover, sideOpenId }: ItemProps) {
  const a = def.action;
  const disabledReason = def.disabled?.reason;
  const side = opensSide(def);
  const active = tileActive(def, pendingDraw) || (side && sideOpenId === def.id);
  const drag = disabledReason || side ? undefined : tileDragStart(a);
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
    'aria-pressed': side ? undefined : active || undefined,
    'aria-expanded': side ? sideOpenId === def.id : undefined,
    'aria-disabled': disabledReason ? true : undefined,
    title: disabledReason,
    onClick: disabledReason
      ? undefined
      : (e: React.MouseEvent<HTMLButtonElement>) => onPress(def, e.currentTarget),
    draggable: drag !== undefined || undefined,
    onDragStart: drag,
    // A piece that turns is carried by the pointer, so Space turns it on its way.
    onPointerDown: drag ? tileCarryStart(a) : undefined,
    // The drag's canvas preview goes with the drag, dropped or not.
    onDragEnd: () => setPaletteDragPreview(null),
    onPointerEnter: (e: React.PointerEvent<HTMLButtonElement>) => onHover(def, e.currentTarget),
    onFocus: (e: React.FocusEvent<HTMLButtonElement>) => onHover(def, e.currentTarget),
  };
  return { props, glyph, active, disabled: !!disabledReason, side };
}

export function Kbd({ children, small }: { children: ReactNode; small?: boolean }) {
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

// The footer's one height (docs/specs/007-editor/toolbar-layout.md "The category bar"): the name's line and two of
// description (16 px each), 10 px above and below, and the 1 px top border. Fixed, so pointing along the tiles never
// grows or shrinks the flyout under the pointer; a longer description clamps to its two lines.
export const FLYOUT_FOOTER_HEIGHT = 16 * 3 + 10 * 2 + 1;

// A flyout's footer bar: a hairline over a quieter band at the card's foot. The tile describer below and the avatar
// palette's Say popover (its Cancel and Send) both stand in it.
export const FLYOUT_FOOTER_CLASS =
  'flex shrink-0 items-center gap-3 rounded-b-xl border-t border-slate-100 bg-slate-50/80 px-3.5 dark:border-slate-800 dark:bg-slate-950/40';

/** What the pointed-at tile does, and its key: the hover card's job, without the wait. */
export function InfoFooter({ def }: { def: PaletteTileDef | null }) {
  return (
    <footer
      aria-live="polite"
      data-flyout-footer
      style={{ height: FLYOUT_FOOTER_HEIGHT }}
      className={`${FLYOUT_FOOTER_CLASS} overflow-hidden`}
    >
      {def ? (
        <>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[12px] leading-4 font-semibold text-slate-800 dark:text-slate-100">
              {tileDisplayName(def)}
            </span>
            <span className="line-clamp-2 text-[11.5px] leading-4 text-slate-500 dark:text-slate-400">
              {def.variants?.length ? (
                'Choose a preset to start from.'
              ) : (
                <PointerWords text={def.description} />
              )}
            </span>
          </div>
          {def.shortcut ? (
            <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              Press
              <Kbd>{def.shortcut}</Kbd>
            </span>
          ) : null}
        </>
      ) : (
        <>
          <span className="text-[11.5px] text-slate-500 pointer-coarse:hidden dark:text-slate-400">
            {DEFAULT_HINT}
          </span>
          <span className="hidden text-[11.5px] text-slate-500 pointer-coarse:inline dark:text-slate-400">
            {TOUCH_HINT}
          </span>
        </>
      )}
    </footer>
  );
}

export function TileGrid({
  tiles,
  offset,
  columns,
  ...rest
}: Omit<ItemProps, 'def'> & { tiles: readonly PaletteTileDef[]; offset: number; columns: number }) {
  const enter = tileEnterAnimation(useTabFinish());
  return (
    <ul
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      className="grid gap-1.5"
    >
      {tiles.map((def, i) => (
        <li
          key={def.id}
          className={`stagger-enter flex ${enter}`}
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
  const { props, glyph, active, disabled, side } = useFlyoutItem(item);
  return (
    <PictureTile
      {...props}
      active={active}
      disabled={disabled}
      name={tileDisplayName(def)}
      shortcut={def.shortcut}
      side={side}
      picture={
        <span
          aria-hidden
          style={glyph.glyphStyle}
          className={`${glyph.glyphClass}flex h-7 items-center justify-center transition-transform duration-micro group-hover:-translate-y-0.5 [&>svg]:h-6 [&>svg]:w-6`}
        >
          {def.icon}
        </span>
      }
    />
  );
}

/** A flyout's picture tile: a picture over its name, pressed while `active`, a key cap in its corner. The category
 *  flyout's grid draws its tiles with it, and the avatar palette its outfits and hairstyles. */
export function PictureTile({
  picture,
  name,
  shortcut,
  active,
  disabled = false,
  side = false,
  height = 'h-[72px]',
  ...button
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'name'> & {
  picture: ReactNode;
  name: ReactNode;
  shortcut?: string | undefined;
  active: boolean;
  disabled?: boolean;
  // Opens a side panel: a chevron at its right.
  side?: boolean;
  // Its height class: 72 px for a glyph, taller for a bigger picture.
  height?: string;
}) {
  return (
    <button
      type="button"
      {...button}
      className={`group relative flex ${height} w-full flex-col items-center justify-center gap-1.5 rounded-xl px-1 ring-1 transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 ${
        disabled
          ? 'cursor-not-allowed opacity-50 ring-transparent'
          : active
            ? 'bg-brand-50 text-brand-700 ring-brand-300 dark:bg-brand-500/20 dark:text-brand-100 dark:ring-brand-500/50'
            : 'text-slate-600 ring-transparent hover:bg-slate-50 hover:text-slate-900 hover:ring-slate-200 hover:shadow-sm dark:text-slate-200 dark:hover:bg-slate-800/70 dark:hover:text-white dark:hover:ring-slate-700'
      }`}
    >
      {picture}
      <span className="w-full truncate text-center text-[11px] leading-tight">{name}</span>
      {shortcut && !disabled ? (
        <span className="pointer-events-none absolute right-1.5 top-1.5 pointer-coarse:hidden">
          <Kbd small>{shortcut}</Kbd>
        </span>
      ) : null}
      {side ? (
        <ChevronRightIcon className="pointer-events-none absolute right-1 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
      ) : null}
    </button>
  );
}

export function CardList({
  tiles,
  columns,
  ...rest
}: Omit<ItemProps, 'def'> & { tiles: readonly PaletteTileDef[]; columns: number }) {
  return (
    <ul className={`grid gap-1 ${columns === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
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
  const { props, glyph, active, disabled, side } = useFlyoutItem(item);
  return (
    <CardTile
      {...props}
      active={active}
      disabled={disabled}
      name={tileDisplayName(def)}
      shortcut={def.shortcut}
      blurb={
        def.variants?.length ? (
          `${def.variants.length} presets`
        ) : (
          <PointerWords text={def.blurb ?? def.description} />
        )
      }
      plate={
        <span
          style={glyph.glyphStyle}
          className={`${glyph.glyphClass}flex items-center justify-center transition-transform duration-micro group-hover:scale-110 [&>svg]:h-5 [&>svg]:w-5`}
        >
          {def.icon}
        </span>
      }
      trailing={
        side ? (
          <ChevronRightIcon
            className={`h-3.5 w-3.5 shrink-0 transition group-hover:translate-x-0.5 ${active ? 'text-brand-700 dark:text-brand-200' : 'text-slate-400 group-hover:text-slate-600'}`}
          />
        ) : null
      }
    />
  );
}

/** A flyout's card: a plate, the name with its key cap, and a line of blurb, pressed while `active`. The category
 *  flyout's cards draw with it, and the avatar palette its statuses, Behaviours and Reactions. */
export function CardTile({
  plate,
  name,
  shortcut,
  blurb,
  active,
  disabled = false,
  trailing,
  ...button
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'name'> & {
  plate: ReactNode;
  name: ReactNode;
  shortcut?: string | undefined;
  blurb?: ReactNode;
  active: boolean;
  disabled?: boolean;
  // After the words: a chevron for a side panel, a tick for the current choice.
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      {...button}
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
        className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-50 text-slate-700 ring-1 ring-slate-200/80 transition group-hover:bg-white group-hover:shadow-sm dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700 dark:group-hover:bg-slate-900"
      >
        {plate}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold leading-tight text-slate-800 dark:text-slate-100">
          <span className="truncate">{name}</span>
          {shortcut && !disabled ? <Kbd small>{shortcut}</Kbd> : null}
        </span>
        {blurb ? (
          <span className="line-clamp-2 text-[11.5px] leading-snug text-slate-500 dark:text-slate-400">
            {blurb}
          </span>
        ) : null}
      </span>
      {trailing}
    </button>
  );
}
