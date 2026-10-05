'use client';

// A cell's Add card (docs/specs/026-plan/plan-board.md "Working on a board"): a quiet button at the
// foot of the column that opens the Add a Card popover. The board's N key opens it for the focused
// card's cell (`open`).
import { useCallback, useRef, useState } from 'react';
import type { ItemTypeDef } from '@livediagram/items';
import { PlusIcon } from '@livediagram/ui';
import { AddCardPopover, type NewCard } from './AddCardPopover';
import type { PlanPalette } from './plan-palette';

export function AddCardButton({
  palette,
  types,
  label = 'Add card',
  open: openNow = false,
  onClosed,
  onAdd,
}: {
  palette: PlanPalette;
  types: readonly ItemTypeDef[];
  label?: string;
  // Asked to open from elsewhere (the N key); `onClosed` says it has closed.
  open?: boolean;
  onClosed?: () => void;
  onAdd: (card: NewCard) => void;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const getAnchor = useCallback(() => button.current, []);
  // Open by its own press, or asked by the N key until it closes.
  const shown = open || openNow;
  return (
    <>
      <button
        ref={button}
        type="button"
        data-add-card-trigger
        aria-haspopup="dialog"
        aria-expanded={shown}
        className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[12px] font-medium transition enabled:cursor-pointer hover:bg-black/5 focus-visible:outline-2"
        style={{ color: palette.muted, outlineColor: palette.focus }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          if (shown) {
            setOpen(false);
            onClosed?.();
          } else setOpen(true);
        }}
      >
        <PlusIcon />
        {label}
      </button>
      {shown ? (
        <AddCardPopover
          getAnchor={getAnchor}
          types={types}
          onAdd={onAdd}
          onClose={(restoreFocus) => {
            setOpen(false);
            onClosed?.();
            if (restoreFocus) button.current?.focus();
          }}
        />
      ) : null}
    </>
  );
}
