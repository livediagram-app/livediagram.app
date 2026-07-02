import { type ReactNode } from 'react';

import { ArrowIcon, TrashIcon } from '@/components/canvas/table-icons';

// Edge-menu UI primitives for TableView: the compact "⋯" trigger that
// opens a column / row menu from the table's top / left edge, and the
// large tappable rows inside that menu. Split out of TableView so the
// big grid component isn't carrying these standalone presentational
// pieces; both are pure (props in, markup out) with no table state.

// Small "⋯" trigger that sits inside the table's top / left edge. Tapping
// it opens the column / row menu. Kept compact but with a 24px+ hit area
// (the padding) so it stays tappable on touch.
export function Trigger({
  open,
  vertical,
  onClick,
}: {
  open: boolean;
  vertical?: boolean;
  // Receives the click event so the caller can anchor the (portalled)
  // menu to this trigger's screen rect.
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      data-table-ui
      aria-label={vertical ? 'Row options' : 'Column options'}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      className={`pointer-events-auto flex items-center justify-center rounded-full border border-slate-200 shadow-sm transition dark:border-slate-700 ${
        open ? 'bg-brand-500 text-white' : 'bg-white text-brand-600 dark:bg-slate-800'
      } ${vertical ? 'h-7 w-5' : 'h-5 w-7'}`}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
        {vertical ? (
          <>
            <circle cx="7" cy="3.5" r="1.1" />
            <circle cx="7" cy="7" r="1.1" />
            <circle cx="7" cy="10.5" r="1.1" />
          </>
        ) : (
          <>
            <circle cx="3.5" cy="7" r="1.1" />
            <circle cx="7" cy="7" r="1.1" />
            <circle cx="10.5" cy="7" r="1.1" />
          </>
        )}
      </svg>
    </button>
  );
}

// Large, tappable menu row (icon + label). Min height 36px for touch.
function MenuButton({
  label,
  danger,
  disabled,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex h-9 w-full items-center gap-2 whitespace-nowrap rounded-md px-2.5 text-left text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
        danger
          ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950'
          : 'text-slate-700 hover:bg-brand-50 dark:text-slate-200 dark:hover:bg-slate-700'
      }`}
    >
      <span className="shrink-0">{children}</span>
      {label}
    </button>
  );
}

// One column-or-row header menu (Insert before / after, Move back / forward,
// Delete), parameterized by axis. The column and row header triggers render
// identical menus differing only by axis labels and icon directions, so they
// share this one implementation.
export function TableHeaderMenu({
  axis,
  index,
  count,
  onAdd,
  onMove,
  onDelete,
}: {
  axis: 'col' | 'row';
  index: number;
  count: number;
  onAdd: (at: number) => void;
  onMove: (from: number, to: number) => void;
  onDelete: (i: number) => void;
}) {
  const isCol = axis === 'col';
  const beforeDir = isCol ? 'left' : 'up';
  const afterDir = isCol ? 'right' : 'down';
  return (
    <>
      <MenuButton label={isCol ? 'Insert left' : 'Insert above'} onClick={() => onAdd(index)}>
        <ArrowIcon dir={beforeDir} />
      </MenuButton>
      <MenuButton label={isCol ? 'Insert right' : 'Insert below'} onClick={() => onAdd(index + 1)}>
        <ArrowIcon dir={afterDir} />
      </MenuButton>
      <MenuButton
        label={isCol ? 'Move left' : 'Move up'}
        disabled={index === 0}
        onClick={() => onMove(index, index - 1)}
      >
        <ArrowIcon dir={beforeDir} />
      </MenuButton>
      <MenuButton
        label={isCol ? 'Move right' : 'Move down'}
        disabled={index === count - 1}
        onClick={() => onMove(index, index + 1)}
      >
        <ArrowIcon dir={afterDir} />
      </MenuButton>
      <MenuButton
        label={isCol ? 'Delete column' : 'Delete row'}
        danger
        disabled={count <= 1}
        onClick={() => onDelete(index)}
      >
        <TrashIcon />
      </MenuButton>
    </>
  );
}
