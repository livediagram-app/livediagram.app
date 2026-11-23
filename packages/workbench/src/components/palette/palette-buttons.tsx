// The plain tiles of the context menu and palette (docs/specs/010-palette/style-presets.md): one copy for every
// editor's menus and palette.
import type { PointerEvent, ReactNode } from 'react';
import { Tooltip } from '@liveworkspace/ui';
import { TOOLBAR_CONTROL_REST } from '../chrome/toolbar-surface';

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
  // Optional hover handlers: used by the style-preset tiles (docs/specs/010-palette/style-presets.md) to
  // preview a preset live on the canvas while the pointer is over the tile.
  onPointerEnter?: (e: PointerEvent) => void;
  onPointerLeave?: (e: PointerEvent) => void;
  // Accessible name, repeated by a Tooltip, for tiles whose children are
  // purely visual (a colour swatch, an icon) and so carry no readable text.
  label?: string;
  children: ReactNode;
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
  children: ReactNode;
}) {
  // w-full so every button fills its grid cell: the active/hover box
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
