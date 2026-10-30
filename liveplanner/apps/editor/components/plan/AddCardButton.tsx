'use client';

// A cell's Add card (docs/specs/026-plan/plan-board.md "Working on a board"): a quiet button at the
// foot of the column that opens the Add a Card menu. The board's N key opens it for the focused
// card's cell (`open`). On a slot board (`compact`) it is a column head's + instead (docs/specs/026-plan/plan-tabs.md
// "A board in a slot is simplified").
import { useState } from 'react';
import type { ItemTypeDef } from '@liveplanner/items';
import { PlusIcon, Tooltip } from '@liveplanner/ui';
import { AddCardPopover, type NewCard } from './AddCardPopover';
import type { PlanPalette } from './plan-palette';

export function AddCardButton({
  palette,
  types,
  label = 'Add card',
  open: openNow = false,
  onClosed,
  onAdd,
  onCreateType,
  compact = false,
}: {
  palette: PlanPalette;
  types: readonly ItemTypeDef[];
  label?: string;
  // Asked to open from elsewhere (the N key); `onClosed` says it has closed.
  open?: boolean;
  onClosed?: () => void;
  onAdd: (card: NewCard) => void;
  // The menu's Add New Card Type row (AddCardPopover).
  onCreateType?: (() => void) | undefined;
  // A slot board's column head (SlotColumnHeader): a 24 px + named by `label` and its tooltip, with no words.
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // The button, as state: the menu hangs from it once it is mounted.
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  // Open by its own press, or asked by the N key until it closes.
  const shown = open || openNow;
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (shown) {
      setOpen(false);
      onClosed?.();
    } else setOpen(true);
  };
  const stop = (e: React.PointerEvent) => e.stopPropagation();
  return (
    <>
      {compact ? (
        <Tooltip label={label}>
          <button
            ref={setButton}
            type="button"
            data-add-card-trigger
            aria-label={label}
            aria-haspopup="menu"
            aria-expanded={shown}
            // touch-target: a 44px box to tap on a touch screen around the 24px glyph (touch-targets.md).
            className={`touch-target relative -mr-1 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md transition hover:bg-black/5 focus-visible:outline-2 dark:hover:bg-white/10 ${
              shown ? 'bg-black/5 dark:bg-white/10' : ''
            }`}
            style={{ color: palette.muted, outlineColor: palette.focus }}
            onPointerDown={stop}
            onClick={toggle}
          >
            <PlusIcon size={14} />
          </button>
        </Tooltip>
      ) : (
        <button
          ref={setButton}
          type="button"
          data-add-card-trigger
          aria-haspopup="menu"
          aria-expanded={shown}
          // A 44px-tall row to tap on a touch screen (touch-targets.md).
          className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[12px] font-medium transition pointer-coarse:min-h-11 enabled:cursor-pointer hover:bg-black/5 focus-visible:outline-2"
          style={{ color: palette.muted, outlineColor: palette.focus }}
          onPointerDown={stop}
          onClick={toggle}
        >
          <PlusIcon />
          {label}
        </button>
      )}
      {shown ? (
        <AddCardPopover
          anchor={button}
          types={types}
          onAdd={onAdd}
          {...(onCreateType ? { onCreateType } : {})}
          onClose={() => {
            setOpen(false);
            onClosed?.();
          }}
        />
      ) : null}
    </>
  );
}
