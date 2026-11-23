import type { ComponentType } from 'react';

export type IconComponent = ComponentType<{ 'aria-hidden'?: boolean; className?: string }>;

// An item's row. Its colours are the control's palette (palette.ts), so no later stylesheet can repaint a hovered row.
// Hovered or focused, the row darkens the hints inside it (--account-hint-hover), which keep AA on the hover fill.
export const ITEM =
  'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm text-(--account-text) outline-none transition-colors hover:bg-(--account-hover) hover:[--account-hint:var(--account-hint-hover)] focus-visible:bg-(--account-hover) focus-visible:[--account-hint:var(--account-hint-hover)] disabled:cursor-not-allowed disabled:opacity-50';

// An item's name over its hint, its icon in a soft square.
export function ItemBody({
  icon: Icon,
  label,
  hint,
}: {
  icon: IconComponent;
  label: string;
  hint: string;
}) {
  return (
    <>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-(--account-tile) text-(--account-tile-ink)">
        <Icon aria-hidden className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block font-medium text-(--account-ink)">{label}</span>
        <span className="block text-xs text-(--account-hint)">{hint}</span>
      </span>
    </>
  );
}
