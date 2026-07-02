import {
  SHAPE_DEFAULT_SIZE,
  type ShapeKind,
  type TextAlignX,
  type TextAlignY,
} from '@livediagram/diagram';
import { PALETTE_DND_MIME } from '@/lib/icons';
import { setPaletteDragPreview, suppressNativeDragImage } from '@/lib/palette-drag-preview';
import { AlignIcon } from '@/components/palette/palette-icons';
import { Tooltip } from '@/components/primitives/Tooltip';
import { onMouseHover } from '@/components/primitives/hover-preview';
import { useModKeyHeld } from '@/hooks/ui/useModKeyHeld';
import { createContext, useContext } from 'react';

// The active tab theme's element colours, made available to every palette
// tile so the palette previews the theme rather than a fixed slate. `stroke`
// tints line-art glyphs (all the `stroke="currentColor"` SVGs); `fill` is the
// shape interior used by the filled tiles (shapes / devices / annotation),
// applied via the `palette-tile-filled` rule in globals.css. Both are
// undefined for the Basic theme, where the palette keeps its default look.
//
// `shapeColors` carries a per-shape-kind override (spec/42 Formal / UML +
// spec/44 custom themes): a tile whose `dragKind` has an entry previews
// THAT kind's colour instead of the base — so a UML diamond tile shows
// amber, a cylinder purple, etc., matching what the shape becomes when
// added. Kinds without an entry fall back to stroke/fill.
export type PaletteTint = {
  stroke?: string;
  fill?: string;
  shapeColors?: Partial<Record<ShapeKind, { fill?: string; stroke?: string }>>;
};

const PaletteTintContext = createContext<PaletteTint | undefined>(undefined);

export function PaletteTintProvider({
  tint,
  children,
}: {
  tint?: PaletteTint;
  children: React.ReactNode;
}) {
  return <PaletteTintContext.Provider value={tint}>{children}</PaletteTintContext.Provider>;
}

export function SizeButton({
  active,
  onClick,
  onPointerEnter,
  onPointerLeave,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  // Optional hover handlers — used by the style-preset tiles (spec/48) to
  // preview a preset live on the canvas while the pointer is over the tile.
  onPointerEnter?: (e: React.PointerEvent) => void;
  onPointerLeave?: (e: React.PointerEvent) => void;
  // Accessible name (+ native tooltip) for tiles whose children are purely
  // visual (a colour swatch, an icon) and so carry no readable text.
  title?: string;
  children: React.ReactNode;
}) {
  // Stretches to fill its parent grid cell so the row reads as four
  // equal-width controls rather than four shrink-to-fit pills floating
  // at the start of the row.
  const base =
    'flex w-full cursor-pointer items-center justify-center rounded-md px-1.5 py-1 text-xs font-medium transition';
  const styled = active
    ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200'
    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white';
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      aria-pressed={active}
      aria-label={title}
      title={title}
      className={`${base} ${styled}`}
    >
      {children}
    </button>
  );
}

export function PatternButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  // w-full so every button fills its grid cell — the active/hover box
  // is then a uniform width regardless of how long the label is.
  const base =
    'flex w-full cursor-pointer flex-col items-center gap-1 rounded-md px-1 py-2 transition';
  const styled = active
    ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200'
    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={`${base} ${styled}`}
    >
      {children}
      <span className="w-full truncate text-center text-[10px] font-medium">{label}</span>
    </button>
  );
}

// The background-pattern catalogue lives in its own data module;
// re-exported here so existing import sites stay unchanged.
export { PATTERNS, type PatternEntry } from './palette-patterns';

const ALIGN_GRID: { x: TextAlignX; y: TextAlignY }[] = [
  { y: 'top', x: 'left' },
  { y: 'top', x: 'center' },
  { y: 'top', x: 'right' },
  { y: 'middle', x: 'left' },
  { y: 'middle', x: 'center' },
  { y: 'middle', x: 'right' },
  { y: 'bottom', x: 'left' },
  { y: 'bottom', x: 'center' },
  { y: 'bottom', x: 'right' },
];

function alignLabel(x: TextAlignX, y: TextAlignY): string {
  const yLabel = y === 'top' ? 'Top' : y === 'bottom' ? 'Bottom' : 'Middle';
  const xLabel = x === 'left' ? 'left' : x === 'right' ? 'right' : 'centre';
  return `${yLabel} ${xLabel}`;
}

export function AlignmentGrid({
  alignX,
  alignY,
  onChange,
  onPreview,
  onPreviewEnd,
}: {
  alignX: TextAlignX;
  alignY: TextAlignY;
  onChange: (x: TextAlignX, y: TextAlignY) => void;
  // Optional hover-preview pair (spec/48 flow), used by the context menus:
  // hovering a cell aligns the text live, leaving reverts. The text toolbar
  // omits them (its grid sits over the element being edited).
  onPreview?: (x: TextAlignX, y: TextAlignY) => void;
  onPreviewEnd?: () => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {ALIGN_GRID.map(({ x, y }) => {
        const active = alignX === x && alignY === y;
        return (
          <Tooltip
            key={`${y}-${x}`}
            title={alignLabel(x, y)}
            description="Align text to this corner of the element."
          >
            <button
              type="button"
              onClick={() => onChange(x, y)}
              onPointerEnter={onPreview ? onMouseHover(() => onPreview(x, y)) : undefined}
              onPointerLeave={onPreviewEnd ? onMouseHover(onPreviewEnd) : undefined}
              aria-label={alignLabel(x, y)}
              aria-pressed={active}
              className={
                active
                  ? 'flex h-7 w-full items-center justify-center rounded-md bg-brand-100 text-brand-700'
                  : 'flex h-7 w-full items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
              }
            >
              <AlignIcon x={x} y={y} />
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}

export function ColorSwatch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <label className="relative flex flex-1 cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
      <span
        aria-hidden
        className="h-4 w-4 rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800"
        style={{ backgroundColor: value }}
      />
      <span className="flex-1">{label}</span>
      <input
        type="color"
        value={hexish(value)}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${label} color`}
        className="absolute h-0 w-0 opacity-0"
      />
    </label>
  );
}

// Coerce a colour to a 6-digit hex, or fall back to white, for the native
// colour <input> (it can't take 'transparent' or named colours). Shared with
// EditorContextMenu's colour rows.
export function hexish(color: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  return '#ffffff';
}

type IconButtonProps = {
  label: string;
  description: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  // Pressed-state styling. Used by the shape buttons during draw-to-
  // size mode so the user sees which shape is queued for the next
  // canvas drag (the cursor + the banner already say it, but a
  // highlighted palette button closes the loop for the
  // "where did I click?" question).
  active?: boolean;
  // Single-key shortcut letter (e.g. "R"). Renders a corner badge
  // whenever the user is holding Cmd/Ctrl, so the palette becomes a
  // self-documenting cheat sheet without permanent visual clutter.
  // The shortcut itself is bound centrally in useEditorKeyboardShortcuts;
  // this prop is purely the visual reveal.
  shortcut?: string;
  // Optional HTML5 drag source. Used by the icon tiles so an icon can be
  // dragged onto a shape (the drop sets the shape's inline icon). When
  // unset the button isn't draggable.
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  // Suppress the hover/focus tooltip. The icon-picker grid sets this:
  // its tiles already read as a labelled gallery and a tooltip on every
  // one of ~60 glyphs is noise. `label` is still applied as the button's
  // aria-label so the control stays accessible.
  hideTooltip?: boolean;
  // Suppress the caption under the icon. The icon-picker grid sets this:
  // its glyphs are a dense gallery where per-tile names would be noise (and
  // it stays a 6-up grid), unlike the shape / tool / device grids.
  hideCaption?: boolean;
  // Override the caption text (default is derived from `label`). Used where
  // the derived name is too long for the tile, e.g. "Bubble".
  caption?: string;
  // Makes the tile draggable to place this shape kind on the canvas (drag
  // alternative to click-to-add). Wires the palette DnD payload.
  dragKind?: ShapeKind;
  // Render the glyph as a filled mini-preview of a themed element: the
  // theme's element fill paints the shape interior on top of the stroke
  // tint, so the tile previews what gets dropped. Set on the boxed-shape
  // tiles (shapes / devices / annotation); line-art tools + icons leave it
  // off and just take the stroke tint. No-op under the Basic theme.
  filled?: boolean;
  // Opt out of the theme tint entirely — for tiles whose colours are fixed
  // regardless of theme: the sticky note (always amber), the image
  // placeholder + link card (neutral chrome), and Technology brand icons.
  noTint?: boolean;
};

export function IconButton({
  label,
  description,
  onClick,
  children,
  disabled,
  active,
  shortcut,
  draggable,
  onDragStart,
  hideTooltip,
  hideCaption,
  caption: captionOverride,
  dragKind,
  filled,
  noTint,
}: IconButtonProps) {
  // A dragKind tile is draggable and carries the palette DnD payload; an
  // explicit draggable/onDragStart (the icon grid) is used otherwise.
  const effectiveDraggable = dragKind ? true : draggable;
  const effectiveDragStart = dragKind
    ? (e: React.DragEvent) => {
        e.dataTransfer.setData(PALETTE_DND_MIME, dragKind);
        e.dataTransfer.effectAllowed = 'copy';
        // Publish the footprint so the canvas ghost (spec/58) can preview
        // where this shape will land.
        const { width, height } = SHAPE_DEFAULT_SIZE[dragKind];
        setPaletteDragPreview({ kind: dragKind, width, height });
      }
    : onDragStart;
  const modHeld = useModKeyHeld();
  const showBadge = !disabled && !!shortcut && modHeld;
  const tone = active
    ? 'bg-brand-100 text-brand-700 ring-1 ring-brand-300 dark:bg-brand-500/20 dark:text-brand-200 dark:ring-brand-500/50'
    : 'text-slate-600 enabled:hover:bg-slate-100 enabled:hover:text-slate-900 dark:text-slate-100 dark:enabled:hover:bg-slate-800 dark:enabled:hover:text-white';
  // Theme tint for the glyph. The active (queued) tile keeps the brand
  // pressed treatment so it still reads as "selected"; disabled + opted-out
  // tiles render plain. The stroke colour drives every `currentColor` glyph;
  // the filled tiles additionally expose the fill as a CSS var consumed by
  // the `palette-tile-filled` rule. Caption text stays on the slate `tone`
  // (the style only lands on the glyph wrapper), so labels keep their
  // contrast.
  const themeTint = useContext(PaletteTintContext);
  // Per-shape themes (UML / custom) colour a tile by its own kind; fall
  // back to the theme's single element stroke / fill for kinds without an
  // override (and for non-shape tiles, which carry no dragKind).
  const shapeOverride = dragKind ? themeTint?.shapeColors?.[dragKind] : undefined;
  const baseStroke = shapeOverride?.stroke ?? themeTint?.stroke;
  const baseFill = shapeOverride?.fill ?? themeTint?.fill;
  const tintStroke = !active && !disabled && !noTint ? baseStroke : undefined;
  const tintFill = tintStroke && filled ? baseFill : undefined;
  const glyphStyle: React.CSSProperties | undefined = tintStroke
    ? ({
        color: tintStroke,
        ...(tintFill ? { '--tile-fill': tintFill } : {}),
      } as React.CSSProperties)
    : undefined;
  const glyphClass = tintFill ? 'palette-tile-filled ' : '';
  // Short caption under the icon, derived from the action label: drop a
  // leading "Add " and any parenthetical, then sentence-case. "Add web
  // browser" → "Web browser", "Pencil (freehand)" → "Pencil". An explicit
  // `caption` prop overrides this where the derived name is too long.
  const captionBase = label
    .replace(/^add\s+/i, '')
    .replace(/\s*\([^)]*\)/g, '')
    .trim();
  const caption = captionOverride ?? captionBase.charAt(0).toUpperCase() + captionBase.slice(1);
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      draggable={effectiveDraggable}
      onDragStart={(e) => {
        // Hide the browser's tile-snapshot drag image for shape tiles so the
        // canvas ghost is the only preview (icons keep the native image until
        // they're wired to the ghost too).
        if (dragKind) suppressNativeDragImage(e);
        effectiveDragStart?.(e);
      }}
      onDragEnd={() => setPaletteDragPreview(null)}
      className={
        hideCaption
          ? `relative flex h-9 w-9 items-center justify-center rounded-md transition disabled:cursor-not-allowed disabled:opacity-50 ${tone}`
          : `relative flex w-full flex-col items-center justify-start gap-0.5 rounded-md px-0.5 py-1 transition disabled:cursor-not-allowed disabled:opacity-50 ${tone}`
      }
    >
      {hideCaption ? (
        <span style={glyphStyle} className={`${glyphClass}flex items-center justify-center`}>
          {children}
        </span>
      ) : (
        <>
          <span style={glyphStyle} className={`${glyphClass}flex h-6 items-center justify-center`}>
            {children}
          </span>
          <span className="w-full truncate text-center text-[9px] leading-none">{caption}</span>
        </>
      )}
      {showBadge ? (
        <kbd
          aria-hidden
          className="pointer-events-none absolute right-0.5 top-0.5 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-[3px] border border-slate-300 bg-white px-0.5 text-[8px] font-semibold uppercase leading-none text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
        >
          {shortcut}
        </kbd>
      ) : null}
    </button>
  );
  // A visible caption already names the action, so skip the tooltip there;
  // only the caption-less tiles (the icon-picker grid) keep it.
  if (disabled || hideTooltip || !hideCaption) return button;
  return (
    <Tooltip title={label} description={description}>
      {button}
    </Tooltip>
  );
}

// iOS-style toggle switch. Used by the Shape accordion's Lock-aspect
// row but generic enough for any future boolean preference that
// belongs alongside its label rather than as an icon button.
export function ToggleSwitch({
  checked,
  onChange,
  label,
  presentational = false,
}: {
  checked: boolean;
  onChange?: () => void;
  label: string;
  // Render a non-interactive <span> instead of a <button> — for when an
  // enclosing row already owns the click (so the whole row toggles without
  // nesting a button inside a button).
  presentational?: boolean;
}) {
  const trackClass = checked
    ? 'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-brand-500 transition'
    : 'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-slate-300 transition dark:bg-slate-600';
  if (presentational) {
    return (
      <span role="switch" aria-checked={checked} aria-label={label} className={trackClass}>
        <span
          aria-hidden
          className={
            checked
              ? 'inline-block h-3.5 w-3.5 translate-x-[18px] rounded-full bg-white shadow-sm transition'
              : 'inline-block h-3.5 w-3.5 translate-x-[3px] rounded-full bg-white shadow-sm transition'
          }
        />
      </span>
    );
  }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={trackClass}
    >
      <span
        aria-hidden
        className={
          checked
            ? 'inline-block h-3.5 w-3.5 translate-x-[18px] rounded-full bg-white shadow-sm transition'
            : 'inline-block h-3.5 w-3.5 translate-x-[3px] rounded-full bg-white shadow-sm transition'
        }
      />
    </button>
  );
}
