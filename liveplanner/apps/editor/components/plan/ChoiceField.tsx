'use client';

// A Choice or Multiple Choice field in the card panel (docs/specs/026-plan/item-types.md "Choice and Multiple Choice in
// the card panel"): one control for both. A Multiple Choice draws its picks as option chips in one bordered field
// (FieldChips: a remove button each, + at the end), a Choice its one chip (or None) and a chevron. Either opens the
// option list under the field, drawn over the page (AnchoredPopover) so the side column never clips it: a row per
// option (a checkbox, or a tick at the end for Choice), a find field past CHOICE_FILTER_FROM options, None first for
// Choice, and for Multiple Choice a footer counting the picks with Clear. Multiple Choice toggles and stays open;
// Choice picks and closes. Escape or a press outside close it and focus goes back to the field. A Viewer sees the
// chips alone.
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { CustomFieldDef, ItemFieldValue } from '@liveplanner/items';
import {
  CheckIcon,
  ChevronDownIcon,
  CompactEmptyState,
  NoMatches,
  lucideGlyph,
} from '@liveplanner/ui';
import { lucideListChecks } from '@liveworkspace/icons/lucide';
import { AnchoredPopover } from '@liveworkspace/workbench/components/primitives/AnchoredPopover';
import { choiceColour, choicePicks, matchOptions, toggledChoice } from './choice-options';
import { FieldChips } from './FieldChips';
import { OptionChip, OptionChipBody } from './OptionChip';
import { usePlan } from './PlanContext';

type Save = (value: ItemFieldValue | undefined) => void | boolean | Promise<boolean>;

// More options than this and the list opens with a find field, as a Card field's list does past eight cards.
export const CHOICE_FILTER_FROM = 8;
// The list's least width: an option of a few words on a line beside its checkbox, however narrow the field.
export const CHOICE_LIST_MIN_PX = 260;

const ListIcon = lucideGlyph(lucideListChecks, 18);

// The None row of a Choice's list.
const NONE = null;

export function ChoiceField({
  id,
  field,
  value,
  disabled,
  onSave,
}: {
  id: string;
  field: CustomFieldDef;
  value: ItemFieldValue | undefined;
  disabled: boolean;
  onSave: Save;
}) {
  const multiple = field.kind === 'multichoice';
  const options = useMemo(() => field.options ?? [], [field.options]);
  const announce = usePlan()?.announce;
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const findRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState(CHOICE_LIST_MIN_PX);

  const picks = choicePicks(options, value);
  // A Choice holds one: a stored list reads as its first.
  const current = multiple ? undefined : picks[0];
  const filtering = options.length > CHOICE_FILTER_FROM;
  const shown = useMemo(() => matchOptions(options, query), [options, query]);
  // The rows: None first for a Choice (while nothing is typed), then the matching options.
  const rows: (string | null)[] = !multiple && !query.trim() ? [NONE, ...shown] : shown;

  const save = (next: readonly string[]) =>
    void onSave(multiple ? (next.length ? [...next] : undefined) : (next[0] ?? undefined));

  const close = (refocus = true) => {
    setOpen(false);
    setQuery('');
    if (refocus) triggerRef.current?.focus();
  };
  const pick = (row: string | null | undefined) => {
    if (row === undefined) return;
    if (multiple) {
      if (row !== NONE) save(toggledChoice(options, picks, row));
      return;
    }
    if ((row ?? undefined) !== current) save(row === NONE ? [] : [row]);
    close();
  };
  const openList = () => {
    const at = rows.findIndex((r) => (r === NONE ? !current : picks.includes(r)));
    setActive(at < 0 ? 0 : at);
    setWidth(Math.max(CHOICE_LIST_MIN_PX, boxRef.current?.offsetWidth ?? 0));
    setAnchor(boxRef.current);
    setOpen(true);
  };
  useEffect(() => {
    if (open) (findRef.current ?? listRef.current)?.focus();
  }, [open]);

  const onListKey = (e: KeyboardEvent<HTMLElement>) => {
    const last = rows.length - 1;
    const move = (to: number) => {
      e.preventDefault();
      setActive(Math.min(last, Math.max(0, to)));
    };
    if (e.key === 'ArrowDown') move(active + 1);
    else if (e.key === 'ArrowUp') move(active - 1);
    else if (e.key === 'Home' && e.currentTarget !== findRef.current) move(0);
    else if (e.key === 'End' && e.currentTarget !== findRef.current) move(last);
    else if (e.key === 'Enter' || (e.key === ' ' && e.currentTarget !== findRef.current)) {
      e.preventDefault();
      pick(rows[active]);
    } else if (e.key === 'Tab') close(false);
  };

  const trigger = multiple ? (
    <FieldChips
      ref={triggerRef}
      id={id}
      label={field.label}
      emptyText="None"
      disabled={disabled}
      open={open}
      listId={listId}
      onAdd={() => (open ? close() : openList())}
      onRemove={(option) => {
        save(picks.filter((p) => p !== option));
        announce?.(`Removed ${option}`);
      }}
      chips={picks.map((option) => {
        const colour = choiceColour(options, option);
        return {
          key: option,
          name: option,
          colour,
          wrap: true,
          content: <OptionChipBody option={option} colour={colour} />,
        };
      })}
    />
  ) : (
    <button
      ref={triggerRef}
      id={id}
      type="button"
      disabled={disabled}
      aria-label={`${field.label}: ${current ?? 'None'}`}
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
      className={`flex min-h-[34px] w-full items-center gap-1.5 rounded-md border bg-white px-1.5 py-1 text-left text-[13px] outline-none transition max-sm:text-[16px] enabled:cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-60 dark:bg-slate-900 ${
        open
          ? 'border-brand-500 ring-2 ring-brand-500/20'
          : 'border-slate-200 enabled:hover:border-slate-300 dark:border-slate-700 dark:enabled:hover:border-slate-600'
      }`}
    >
      <span className="flex min-w-0 flex-1">
        {current ? (
          <OptionChip option={current} colour={choiceColour(options, current)} />
        ) : (
          <span className="px-1 text-slate-500 dark:text-slate-400">None</span>
        )}
      </span>
      {disabled ? null : (
        <span aria-hidden className="shrink-0 px-0.5 text-slate-400">
          <ChevronDownIcon size={12} />
        </span>
      )}
    </button>
  );

  return (
    <div ref={boxRef} className="relative w-full">
      {trigger}
      {open && anchor && !disabled ? (
        <AnchoredPopover
          anchor={anchor}
          name={`Choose ${field.label}`}
          width={width}
          initialFocus="none"
          // A press outside leaves focus where it landed; Escape hands it back to the field (the anchor is the
          // field's box, which takes no focus itself).
          onClose={() => close(false)}
          onEscape={() => {
            close();
            return true;
          }}
        >
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            {filtering ? (
              <input
                ref={findRef}
                type="text"
                value={query}
                placeholder="Find an option"
                aria-label={`Find an option for ${field.label}`}
                aria-controls={listId}
                aria-activedescendant={rows.length ? `${listId}-${active}` : undefined}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onListKey}
                className="w-full border-b border-slate-200 bg-transparent px-2.5 py-2 text-[13px] text-slate-800 outline-none placeholder:text-slate-400 max-sm:text-[16px] dark:border-slate-700 dark:text-slate-100"
              />
            ) : null}
            {options.length === 0 ? (
              <CompactEmptyState
                size="small"
                icon={<ListIcon aria-hidden />}
                title="No Options Yet"
                description="Add options to this field in its card type."
              />
            ) : rows.length === 0 ? (
              <NoMatches things="options" query={query} onClear={() => setQuery('')} />
            ) : (
              <ul
                ref={listRef}
                id={listId}
                role="listbox"
                aria-label={field.label}
                tabIndex={-1}
                aria-multiselectable={multiple || undefined}
                aria-activedescendant={`${listId}-${active}`}
                onKeyDown={onListKey}
                className="max-h-64 overflow-y-auto py-1 outline-none"
              >
                {rows.map((row, i) => (
                  <ChoiceOptionRow
                    key={row ?? '\u0000none'}
                    id={`${listId}-${i}`}
                    option={row}
                    colour={row === NONE ? undefined : choiceColour(options, row)}
                    selected={row === NONE ? !current : picks.includes(row)}
                    multiple={multiple}
                    active={i === active}
                    onHover={() => i !== active && setActive(i)}
                    onPick={() => pick(row)}
                  />
                ))}
              </ul>
            )}
            {multiple && options.length > 0 ? (
              <div className="flex min-h-9 items-center justify-between gap-2 border-t border-slate-200 px-2.5 py-1 text-[12px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <span role="status" className="tabular-nums">
                  {picks.length} of {options.length} chosen
                </span>
                {picks.length ? (
                  <button
                    type="button"
                    // A press here keeps focus where it is (the find field or the list).
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => {
                      save([]);
                      announce?.(`Cleared ${field.label}`);
                    }}
                    className="-mr-1.5 cursor-pointer rounded-md px-1.5 py-0.5 font-medium text-brand-700 transition hover:bg-brand-50 pointer-coarse:py-1.5 dark:text-brand-300 dark:hover:bg-brand-500/10"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </AnchoredPopover>
      ) : null}
    </div>
  );
}

// One row of the list: a checkbox (Multiple Choice) or a tick at the end (Choice), and the option's chip; None reads
// quietly.
function ChoiceOptionRow({
  id,
  option,
  colour,
  selected,
  multiple,
  active,
  onHover,
  onPick,
}: {
  id: string;
  option: string | null;
  colour: string | undefined;
  selected: boolean;
  multiple: boolean;
  active: boolean;
  onHover: () => void;
  onPick: () => void;
}) {
  return (
    <li
      id={id}
      role="option"
      aria-selected={selected}
      aria-label={option ?? 'None'}
      // A press never takes focus from the find field or the list, so the keys carry on after a pick.
      onPointerDown={(e) => e.preventDefault()}
      onPointerMove={onHover}
      onClick={onPick}
      className={`flex cursor-pointer items-center gap-2 px-2.5 py-1.5 pointer-coarse:min-h-11 ${
        active ? 'bg-slate-100 dark:bg-slate-800' : ''
      }`}
    >
      {multiple ? (
        <span
          aria-hidden
          className={`flex size-4 shrink-0 items-center justify-center rounded border transition ${
            selected
              ? 'border-brand-700 bg-brand-700 text-white dark:border-brand-600 dark:bg-brand-600'
              : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900'
          }`}
        >
          {selected ? <CheckIcon size={11} /> : null}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1">
        {option === NONE ? (
          <span className="text-[13px] text-slate-500 max-sm:text-[16px] dark:text-slate-400">
            None
          </span>
        ) : (
          <OptionChip option={option} colour={colour} />
        )}
      </span>
      {!multiple && selected ? (
        <span aria-hidden className="shrink-0 text-brand-700 dark:text-brand-400">
          <CheckIcon size={12} />
        </span>
      ) : null}
    </li>
  );
}
