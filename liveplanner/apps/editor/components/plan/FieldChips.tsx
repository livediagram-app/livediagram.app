'use client';

// The card panel's control for a field that holds several (docs/specs/026-plan/item-types.md "Holds Several"), one for
// Person and Card fields alike: one bordered field the width of its row, a chip per value (what each kind draws, a
// person's disc and name, a card's glyph, number and title), each with a remove button, then an Add button that opens
// the kind's own list (PersonPicker, LinkedCardField). Pressing the field's empty room opens it too, so a phone has a
// large target. A Viewer sees the chips alone. Full at FIELD_VALUES_MAX, Add is disabled and says why.
import { forwardRef, type ReactNode, type Ref } from 'react';
import { FIELD_VALUES_MAX } from '@liveplanner/items';
import { CloseIcon, PlusIcon, Tooltip } from '@liveplanner/ui';

export interface FieldChip {
  key: string;
  // What the chip says, for its remove button's name ("Remove Sam from Reviewers").
  name: string;
  content: ReactNode;
}

export const FieldChips = forwardRef(function FieldChips(
  {
    id,
    label,
    chips,
    emptyText,
    disabled,
    open,
    listId,
    onAdd,
    onRemove,
  }: {
    id: string;
    // The field's name ("Reviewers").
    label: string;
    chips: readonly FieldChip[];
    // What an empty field reads ("No one", "None").
    emptyText: string;
    disabled: boolean;
    // The kind's list is open under the field.
    open: boolean;
    listId: string;
    onAdd: () => void;
    onRemove: (key: string) => void;
  },
  addRef: Ref<HTMLButtonElement>,
) {
  const full = chips.length >= FIELD_VALUES_MAX;
  const addLabel = full ? `${label} holds up to ${FIELD_VALUES_MAX}` : `Add to ${label}`;
  return (
    <div
      role="group"
      aria-label={label}
      // The empty room opens the list, as the Add button does; a chip's own buttons keep their presses.
      onClick={(e) => {
        if (!disabled && !full && e.target === e.currentTarget) onAdd();
      }}
      className={`flex min-h-[34px] w-full flex-wrap items-center gap-1 rounded-md border bg-white px-1 py-1 transition dark:bg-slate-900 ${
        open
          ? 'border-brand-500 ring-2 ring-brand-500/20'
          : 'border-slate-200 dark:border-slate-700'
      } ${disabled ? 'opacity-60' : full ? '' : 'cursor-pointer'}`}
    >
      {chips.length === 0 ? (
        <span className="pointer-events-none px-1 text-[13px] text-slate-500 max-sm:text-[16px] dark:text-slate-400">
          {emptyText}
        </span>
      ) : null}
      {chips.map((chip) => (
        <span
          key={chip.key}
          data-field-chip=""
          className="inline-flex h-6 min-w-0 max-w-full items-center gap-1 rounded-full bg-slate-100 pl-0.5 text-[12px] font-medium text-slate-800 max-sm:h-7 max-sm:text-[14px] dark:bg-slate-800 dark:text-slate-100"
        >
          {chip.content}
          {disabled ? (
            <span aria-hidden className="w-1.5" />
          ) : (
            <Tooltip label={`Remove ${chip.name}`}>
              <button
                type="button"
                aria-label={`Remove ${chip.name} from ${label}`}
                onClick={() => onRemove(chip.key)}
                className="mr-0.5 flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 max-sm:size-6 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
              >
                <CloseIcon size={11} />
              </button>
            </Tooltip>
          )}
        </span>
      ))}
      {disabled ? null : (
        <Tooltip label={addLabel}>
          <button
            ref={addRef}
            id={id}
            type="button"
            disabled={full}
            aria-label={addLabel}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            onClick={onAdd}
            className="ml-auto flex size-6 shrink-0 items-center justify-center rounded text-slate-500 transition enabled:cursor-pointer enabled:hover:bg-slate-100 enabled:hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-40 max-sm:size-7 dark:text-slate-400 dark:enabled:hover:bg-slate-800 dark:enabled:hover:text-white"
          >
            <PlusIcon size={13} />
          </button>
        </Tooltip>
      )}
    </div>
  );
});
