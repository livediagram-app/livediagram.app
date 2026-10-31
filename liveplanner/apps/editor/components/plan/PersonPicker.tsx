'use client';

// The card panel's Assignee picker (docs/specs/026-plan/items.md "Who may do what"): No one, the plan's people,
// then + Custom Assignee, which opens a small popover to name someone outside the plan's team and assigns the card
// to them at once. Offered only to someone who may edit the card (an Editor or a Participant); a Viewer's picker is
// disabled and has no custom row. A list of its own rather than a native select, so each row can carry the
// liveworkspace account mark left of a real person's name ("Accounts are marked"); the closed field shows none.
// Keys: Enter, Space or the arrows open it, the arrows move, Enter picks, Escape closes.
import { Button, ChevronDownIcon, TextInput, useClickOutside, useEscape } from '@liveplanner/ui';
import { AnchoredPopover } from '@liveworkspace/workbench/components/primitives/AnchoredPopover';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
  CUSTOM_ASSIGNEE_NAME_MAX,
  isItemPerson,
  personNamed,
  type ItemFieldValue,
  type ItemPerson,
} from '@liveplanner/items';
import { track } from '@/lib/telemetry';
import { ACCOUNT_MARK_LABEL, AccountMark, hasAccountMark } from './AccountMark';

// The custom row's key: never a person id (those are hashes or `n-` slugs).
export const CUSTOM_ASSIGNEE_OPTION = '__custom__';

type Save = (value: ItemFieldValue | undefined) => void | boolean | Promise<boolean>;

// A row of the list: No one (null), a person, or the custom row.
type Row = ItemPerson | null | typeof CUSTOM_ASSIGNEE_OPTION;

const sameId = (row: Row, person: ItemPerson | null): boolean =>
  row !== CUSTOM_ASSIGNEE_OPTION && (row?.id ?? null) === (person?.id ?? null);

export function PersonPicker({
  id,
  value,
  people,
  disabled,
  onSave,
  label = 'Assignee',
}: {
  id: string;
  value: ItemFieldValue | undefined;
  people: readonly ItemPerson[];
  disabled: boolean;
  onSave: Save;
  // The field's name: the Assignee, or a Person field of the type's own (docs/specs/026-plan/item-types.md
  // "Custom field kinds").
  label?: string;
}) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // The field the Custom Assignee popover is open under, or null when it is shut.
  const [naming, setNaming] = useState<HTMLElement | null>(null);
  const current = isItemPerson(value) ? value : null;
  const options =
    current && !people.some((p) => p.id === current.id) ? [current, ...people] : people;
  const rows: Row[] = disabled ? [null, ...options] : [null, ...options, CUSTOM_ASSIGNEE_OPTION];
  const name = current?.name ?? 'No one';

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };
  const pick = (row: Row | undefined) => {
    if (row === undefined) return;
    close();
    if (row === CUSTOM_ASSIGNEE_OPTION) {
      // The field keeps showing who it is on until a name is added.
      setNaming(triggerRef.current);
      return;
    }
    if (!sameId(row, current)) void onSave(row ? { ...row } : undefined);
  };
  // Opened on the current choice.
  const openList = () => {
    const at = rows.findIndex((r) => sameId(r, current));
    setActive(at < 0 ? 0 : at);
    setOpen(true);
  };
  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);
  // Escape closes the list only, before the panel's own Escape (which would close the card).
  useEscape(() => close(), { enabled: open, capture: true, stopPropagation: true });
  useClickOutside(boxRef, () => close(false), open);

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((a) => Math.min(rows.length - 1, Math.max(0, a + step)));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pick(rows[active]);
    } else if (e.key === 'Tab') close(false);
  };

  return (
    <div ref={boxRef} className="relative w-full">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={`${label}: ${name}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close() : openList())}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            openList();
          }
        }}
        // 16px on a phone, as the card's selects are there (globals.css: iOS zooms a field under 16px on focus).
        className={`flex min-h-[34px] w-full items-center gap-1.5 rounded-md border bg-white px-2 py-1 text-left text-[13px] outline-none transition max-sm:text-[16px] enabled:cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-60 dark:bg-slate-900 ${
          open
            ? 'border-brand-500 ring-2 ring-brand-500/20'
            : 'border-slate-200 dark:border-slate-700'
        }`}
      >
        <span
          className={`min-w-0 flex-1 truncate ${
            current ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {name}
        </span>
        <span aria-hidden className="shrink-0 text-slate-400">
          <ChevronDownIcon size={12} />
        </span>
      </button>
      {open ? (
        // In place, under the field, so the panel's focus trap keeps it.
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={label}
          tabIndex={-1}
          aria-activedescendant={`${listId}-${active}`}
          onKeyDown={onListKey}
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg outline-none dark:border-slate-700 dark:bg-slate-900"
        >
          {rows.map((row, i) => {
            const custom = row === CUSTOM_ASSIGNEE_OPTION;
            const person = custom ? null : row;
            const selected = sameId(row, current);
            const marked = !!person && hasAccountMark(person);
            const text = custom ? `+ Custom ${label}` : (person?.name ?? 'No one');
            return (
              <li
                key={custom ? CUSTOM_ASSIGNEE_OPTION : (person?.id ?? 'none')}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={selected}
                // The name first, then what the mark says ("Sam, liveworkspace account").
                aria-label={marked ? `${text}, ${ACCOUNT_MARK_LABEL}` : text}
                onPointerMove={() => setActive(i)}
                onClick={() => pick(row)}
                className={`flex cursor-pointer items-center gap-1.5 px-2 py-1.5 text-[13px] leading-snug max-sm:text-[16px] ${
                  i === active ? 'bg-slate-100 dark:bg-slate-800' : ''
                } ${selected ? 'font-semibold' : ''} ${
                  person
                    ? 'text-slate-800 dark:text-slate-100'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {/* A real person's account mark, left of the name; a custom assignee keeps the same room empty so
                    the names line up. No one and the custom row have neither. */}
                {marked ? (
                  <AccountMark />
                ) : person ? (
                  <span aria-hidden className="size-3 shrink-0" />
                ) : null}
                <span className="min-w-0 flex-1 truncate">{text}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {naming ? (
        <CustomAssigneePopover
          anchor={naming}
          onClose={() => setNaming(null)}
          onAdd={(added) => {
            setNaming(null);
            track('Plan', 'Added', 'CustomAssignee');
            void onSave({ ...personNamed(added, options) });
          }}
        />
      ) : null}
    </div>
  );
}

// Custom Assignee: a name, then Add. Enter adds; Escape, Cancel or a press outside close it unsaved.
export function CustomAssigneePopover({
  anchor,
  onClose,
  onAdd,
}: {
  anchor: HTMLElement;
  onClose: () => void;
  onAdd: (name: string) => void;
}) {
  const [name, setName] = useState('');
  const trimmed = name.trim();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed) return;
    onAdd(trimmed);
    anchor.focus();
  };
  return (
    <AnchoredPopover anchor={anchor} name="Custom Assignee" width={260} onClose={onClose}>
      <form
        onSubmit={submit}
        className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
      >
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Custom Assignee
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Someone outside your team. Anyone on this plan can then pick them.
          </p>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
            Name
          </span>
          <TextInput
            compact
            value={name}
            maxLength={CUSTOM_ASSIGNEE_NAME_MAX}
            placeholder="Their name"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            size="xs"
            onClick={() => {
              onClose();
              anchor.focus();
            }}
          >
            Cancel
          </Button>
          <Button type="submit" size="xs" disabled={!trimmed}>
            Add
          </Button>
        </div>
      </form>
    </AnchoredPopover>
  );
}
