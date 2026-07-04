import { type TextAlignX, type TextAlignY } from '@livediagram/diagram';
import { AlignIcon } from '@/components/palette/palette-icons';
import { Tooltip } from '@/components/primitives/Tooltip';
import { onMouseHover } from '@/components/primitives/hover-preview';

// The theme-tinted palette tile + its tint context moved to
// PaletteIconButton.tsx; re-exported so existing imports keep working.
export { IconButton, PaletteTintProvider, type PaletteTint } from './PaletteIconButton';

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
