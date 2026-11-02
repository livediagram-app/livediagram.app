'use client';

// Save Filter and Rename Filter (docs/specs/026-plan/board-widgets.md "Saved filters"): a Name field, focused, and
// Save. Enter saves; Escape or a press outside closes it. A name another saved filter on the board has says so and
// saves nothing.
import { useState } from 'react';
import {
  SAVED_FILTER_NAME_MAX,
  savedFilterNameTaken,
  type SavedBoardFilter,
} from '@liveplanner/items';
import { Button, TextInput } from '@liveplanner/ui';
import { AnchoredPopover } from '@liveworkspace/workbench/components/primitives/AnchoredPopover';

const POPOVER_PX = 260;
export const NAME_TAKEN = 'A saved filter already has this name.';

export function SavedFilterNamePopover({
  anchor,
  title,
  initial = '',
  saved,
  exceptId,
  onSave,
  onClose,
}: {
  anchor: HTMLElement;
  title: string;
  initial?: string;
  // The board's saved filters, for a name already taken.
  saved: readonly SavedBoardFilter[] | undefined;
  // The filter being renamed, whose own name is not a clash.
  exceptId?: string;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial);
  const taken = !!name.trim() && savedFilterNameTaken(saved, name, exceptId);
  const ok = !!name.trim() && !taken;
  return (
    <AnchoredPopover anchor={anchor} name={title} width={POPOVER_PX} onClose={onClose}>
      <form
        className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) onSave(name.trim());
        }}
      >
        <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
          {title}
        </span>
        <label className="flex flex-col gap-1 text-[12px] font-medium text-slate-600 dark:text-slate-300">
          Name
          <TextInput
            compact
            autoFocus
            value={name}
            maxLength={SAVED_FILTER_NAME_MAX}
            invalid={taken}
            aria-describedby={taken ? 'saved-filter-name-taken' : undefined}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </label>
        {taken ? (
          <p
            id="saved-filter-name-taken"
            role="alert"
            className="text-[12px] text-red-600 dark:text-red-400"
          >
            {NAME_TAKEN}
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={!ok}>
            Save
          </Button>
        </div>
      </form>
    </AnchoredPopover>
  );
}
