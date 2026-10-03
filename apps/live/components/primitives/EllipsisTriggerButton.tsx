import { EllipsisIcon } from '@livediagram/ui';
import { forwardRef, type MouseEvent, type PointerEvent } from 'react';

// The three-dot glyph every ⋯ trigger draws. Exported for the few menus
// whose trigger is not this button (a toolbar chip, a tab) but should
// still show the same dots.
export function EllipsisGlyph({ size = 14 }: { size?: number }) {
  return <EllipsisIcon size={size} />;
}

// Each a 44px tap area on a touch screen (`touch-target`), whatever its drawn size.
const SIZE_CLASS = {
  // The panel's dense rows (Explorer tree, slide deck, panel header).
  sm: 'h-5 w-5 relative touch-target',
  // The Explorer page's sidebar tree and the panel's document rows.
  md: 'h-6 w-6 relative touch-target',
  // The Explorer page's list rows and cards.
  lg: 'h-7 w-7 relative touch-target',
} as const;

// The row / card ⋯ menu trigger, one button for every Explorer surface
// (page rows and cards, sidebar tree, the floating panel's tree and
// header, the slide deck), which had each hand-rolled their own. It
// forwards its ref because every caller anchors its portal menu to it.
//
// - `size`: the square it occupies; the glyph stays 14px.
// - `reveal`: hidden on desktop until the row (a `group`) is hovered or
//   the button has keyboard focus. Always visible on touch, where there
//   is no hover. An open menu (`expanded`) pins it visible, so the
//   anchor doesn't vanish from under its own menu.
// - `tuck`: the card variant's corner-tuck margins (DocumentCard /
//   FolderCard headers).
// - `onPointerDown`: for triggers inside draggable / pressable rows,
//   which stop the press from starting a drag.
export const EllipsisTriggerButton = forwardRef<
  HTMLButtonElement,
  {
    label: string;
    onClick: (e: MouseEvent<HTMLButtonElement>) => void;
    expanded?: boolean;
    size?: keyof typeof SIZE_CLASS;
    reveal?: boolean;
    tuck?: boolean;
    onPointerDown?: (e: PointerEvent<HTMLButtonElement>) => void;
    className?: string;
    // -1 inside a composite widget (the sidebar tree) that owns the tab stop.
    tabIndex?: number;
  }
>(function EllipsisTriggerButton(
  {
    label,
    onClick,
    expanded,
    size = 'lg',
    reveal = false,
    tuck = false,
    onPointerDown,
    className,
    tabIndex,
  },
  ref,
) {
  const revealClass = reveal
    ? expanded
      ? 'opacity-100'
      : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100'
    : '';
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      onPointerDown={onPointerDown}
      tabIndex={tabIndex}
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={expanded}
      className={[
        'inline-flex shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200',
        SIZE_CLASS[size],
        revealClass,
        tuck ? '-mr-1 -mt-0.5' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <EllipsisGlyph />
    </button>
  );
});
