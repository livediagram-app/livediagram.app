import { type ReactNode } from 'react';

import { ArrowIcon, TrashIcon } from '@/components/canvas/table-icons';
import {
  FLOATING_CONTROL_CLASS,
  FLOATING_CONTROL_HOVER_CLASS,
  FLOATING_CONTROL_SIZE,
} from '@/components/chrome/floating-controls';
import { SOLID_BRAND_DARK_CONTROL, Glyph } from '@livediagram/ui';

// Edge-menu UI primitives for TableView: the compact "⋯" trigger that
// opens a column / row menu from the table's top / left edge, and the
// large tappable rows inside that menu. Split out of TableView so the
// big grid component isn't carrying these standalone presentational
// pieces; both are pure (props in, markup out) with no table state.

// The "⋯" trigger that opens a column / row menu, sitting out beyond the
// table's top / left edge.
//
// It is one of the floating canvas controls, so it takes their size and
// their look: it lines up with the quick-connect plus on the same edge and
// reads as part of the same set. It used to be a smaller, flatter pill on
// its own line, which next to the plus looked like a stray.
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
      className={`pointer-events-auto flex items-center justify-center ${
        open
          ? `rounded-full border border-brand-400 bg-brand-500 text-white shadow-md ${SOLID_BRAND_DARK_CONTROL}`
          : `${FLOATING_CONTROL_CLASS} ${FLOATING_CONTROL_HOVER_CLASS}`
      }`}
      style={{ width: FLOATING_CONTROL_SIZE, height: FLOATING_CONTROL_SIZE }}
    >
      <Glyph size={14} units={14} filled>
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
      </Glyph>
    </button>
  );
}

// Large, tappable menu row (icon + label). Min height 36px for touch.
function MenuButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
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
      className={`flex h-9 w-full items-center gap-2 whitespace-nowrap rounded-md px-2.5 text-left text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 text-slate-700 hover:bg-brand-50 dark:text-slate-200 dark:hover:bg-slate-700`}
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
// Thin rule between the menu's action groups (insert · move · delete).
function MenuSeparator() {
  return (
    <div className="my-1 px-1.5" role="separator" aria-hidden>
      <div className="h-px bg-slate-200/90 dark:bg-slate-700/80" />
    </div>
  );
}

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
      <MenuButton label={isCol ? 'Insert Left' : 'Insert Above'} onClick={() => onAdd(index)}>
        <ArrowIcon dir={beforeDir} />
      </MenuButton>
      <MenuButton label={isCol ? 'Insert Right' : 'Insert Below'} onClick={() => onAdd(index + 1)}>
        <ArrowIcon dir={afterDir} />
      </MenuButton>
      <MenuSeparator />
      <MenuButton
        label={isCol ? 'Move Left' : 'Move Up'}
        disabled={index === 0}
        onClick={() => onMove(index, index - 1)}
      >
        <ArrowIcon dir={beforeDir} />
      </MenuButton>
      <MenuButton
        label={isCol ? 'Move Right' : 'Move Down'}
        disabled={index === count - 1}
        onClick={() => onMove(index, index + 1)}
      >
        <ArrowIcon dir={afterDir} />
      </MenuButton>
      <MenuSeparator />
      <MenuButton
        label={isCol ? 'Delete Column' : 'Delete Row'}
        disabled={count <= 1}
        onClick={() => onDelete(index)}
      >
        <TrashIcon />
      </MenuButton>
    </>
  );
}
