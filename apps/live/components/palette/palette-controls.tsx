import { type TextAlignX, type TextAlignY } from '@livediagram/document';
import { AlignIcon } from '@/components/palette/palette-icons';
import { onMouseHover } from '@/components/primitives/hover-preview';
import { useState } from 'react';
import { HoverCard, Tooltip } from '@livediagram/ui';
import type { StandardTone } from '@livediagram/document';
import { ColourPopover } from '@/components/colour/ColourPopover';
import { SwatchChip } from '@/components/colour/ColourSwatch';
import { standardGroup, standardOptions } from '@/components/colour/colour-options';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { useDocumentColours } from '@/hooks/ui/useDocumentColours';
import { TOOLBAR_CONTROL_REST } from '@/components/chrome/toolbar-surface';

// The theme-tinted palette tile + its tint context moved to
// PaletteIconButton.tsx; re-exported so existing imports keep working.
export { IconButton, PaletteTintProvider, type PaletteTint } from './PaletteIconButton';

export function SizeButton({
  active,
  onClick,
  onPointerEnter,
  onPointerLeave,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  // Optional hover handlers — used by the style-preset tiles (docs/specs/010-palette/style-presets.md) to
  // preview a preset live on the canvas while the pointer is over the tile.
  onPointerEnter?: (e: React.PointerEvent) => void;
  onPointerLeave?: (e: React.PointerEvent) => void;
  // Accessible name, repeated by a Tooltip, for tiles whose children are
  // purely visual (a colour swatch, an icon) and so carry no readable text.
  label?: string;
  children: React.ReactNode;
}) {
  // Stretches to fill its parent grid cell so the row reads as four
  // equal-width controls rather than four shrink-to-fit pills floating
  // at the start of the row.
  const base =
    'flex w-full cursor-pointer items-center justify-center rounded-md px-1.5 py-1 text-xs font-medium transition';
  const styled = active
    ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200'
    : TOOLBAR_CONTROL_REST;
  const button = (
    <button
      type="button"
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      aria-pressed={active}
      aria-label={label}
      className={`${base} ${styled}`}
    >
      {children}
    </button>
  );
  // The Tooltip wrapper is display: contents, so the tile still fills its
  // grid cell.
  return label ? <Tooltip label={label}>{button}</Tooltip> : button;
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
    : TOOLBAR_CONTROL_REST;
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
  // Optional hover-preview pair (docs/specs/010-palette/style-presets.md flow), used by the context menus:
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
          <HoverCard
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
                  ? 'flex h-7 w-full items-center justify-center rounded-md bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200'
                  : 'flex h-7 w-full items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
              }
            >
              <AlignIcon x={x} y={y} />
            </button>
          </HoverCard>
        );
      })}
    </div>
  );
}

// A colour well opening the one colour picker (docs/specs/004-interface-design/colour-picker.md)
// in a popover under its trigger: the canvas and pattern colours here, the custom theme builder's
// tiles and dots. Free colours, so it offers both tones of the standard colours (soft first, for
// backgrounds), by hex, for the canvas behind; Custom colours; and +. A pick closes it and hands focus
// back to the trigger.
export function useColourWell({
  label,
  value,
  onChange,
  tones = ['soft', 'strong'],
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
  tones?: readonly StandardTone[];
}) {
  const [open, setOpen] = useState(false);
  // The trigger, held in state (a callback ref) so the popover can anchor to it during render.
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const appearance = useCanvasSurface();
  const yours = useDocumentColours();
  const standard =
    tones.length === 1
      ? [standardGroup(tones[0]!, appearance, 'hex')]
      : tones.map((tone) => ({
          heading: TONE_HEADING[tone],
          options: standardOptions(tone, appearance, 'hex'),
        }));
  const popover =
    open && anchor ? (
      <ColourPopover
        anchor={anchor}
        label={label}
        value={value}
        standard={standard}
        yours={yours}
        onClose={() => setOpen(false)}
        onPick={(hex) => {
          onChange(hex);
          setOpen(false);
          anchor.focus();
        }}
      />
    ) : null;
  return { open, toggle: () => setOpen((o) => !o), setTrigger: setAnchor, popover };
}

const TONE_HEADING: Record<StandardTone, string> = {
  soft: 'Light',
  strong: 'Dark',
};

export function ColorSwatch({
  label,
  value,
  onChange,
  tones,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
  tones?: readonly StandardTone[];
}) {
  const { open, toggle, setTrigger, popover } = useColourWell({
    label: `${label} colour`,
    value,
    onChange,
    tones,
  });
  return (
    <>
      <button
        ref={setTrigger}
        type="button"
        aria-label={`${label} colour`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
        className="relative flex flex-1 cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <SwatchChip colour={value} small />
        <span className="flex-1">{label}</span>
      </button>
      {popover}
    </>
  );
}

// Coerce a colour to a 6-digit hex, or fall back to white, for a swatch that
// can't draw 'transparent' or a named colour. Shared with the element menu's
// colour rows.
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
  // nesting a button inside a button). Such a switch is PICTURE only: the
  // row around it already carries role="switch" + aria-checked + the name, so
  // repeating them here announced one control as two.
  presentational?: boolean;
}) {
  const trackClass = checked
    ? 'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-brand-500 transition'
    : 'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-slate-300 transition dark:bg-slate-600';
  if (presentational) {
    return (
      <span aria-hidden className={trackClass}>
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
