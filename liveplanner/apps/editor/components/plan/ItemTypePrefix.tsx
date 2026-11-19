'use client';

// The type editor's Prefix (docs/specs/026-plan/item-types.md "Card number prefixes"): the letters before its cards'
// numbers (WI in WI-12), beside Name in Configuration. A saved type opens on the prefix its cards show; a new type
// starts empty, its placeholder the prefix its name makes, which it stores on Save. Typed in any case and saved upper
// case; one another type of the plan has, or one that is not a prefix, stops Save with the reason under the field.
import { useMemo, useState } from 'react';
import {
  CARD_PREFIX_MAX,
  PREFIX_RULE,
  autoPrefix,
  normalPrefix,
  prefixOf,
  prefixOwner,
  prefixTaken,
  type ItemTypeDef,
} from '@liveplanner/items';
import { SheetRow } from './PlanModal';

export type TypePrefixDraft = {
  // What the field holds, as typed.
  value: string;
  onChange: (next: string) => void;
  // The prefix the name makes: the field's placeholder, and what an empty field saves (a new type) or goes back to.
  made: string;
  // What its cards read with, as the hint under the field shows it.
  shown: string;
  // The number the plan's next card takes, so the hint reads as that card will ("Cards read WI-101").
  next: number;
  // Why Save is stopped, or null: said in full beside Save, and in short under the field (`short`).
  problem: string | null;
  short: string | null;
  // What the type stores: the typed prefix; a new type's made one when the field is empty; none for a saved type
  // whose field was emptied (it goes back to its made one).
  stored: string | undefined;
};

export function useTypePrefixDraft(
  start: Pick<ItemTypeDef, 'prefix'>,
  type: ItemTypeDef | null | undefined,
  types: readonly ItemTypeDef[],
  label: string,
  next: number,
): TypePrefixDraft {
  const [value, onChange] = useState(() =>
    type ? (prefixOf(types, type.id) ?? '') : (start.prefix ?? ''),
  );
  const id = type?.id;
  // Every other type's prefix, as its cards show it.
  const taken = useMemo(
    () => new Set(types.filter((t) => t.id !== id).map((t) => prefixOf(types, t.id)!)),
    [types, id],
  );
  const made = autoPrefix(label.trim(), taken);
  const typed = value.trim();
  const valid = typed ? normalPrefix(typed) : null;
  const owner = valid ? prefixOwner(types, id ?? '', valid) : null;
  const problem = typed && !valid ? PREFIX_RULE : owner && valid ? prefixTaken(valid, owner) : null;
  const short = typed && !valid ? 'Letters and digits' : owner ? `${owner.label} has it` : null;
  return {
    value,
    onChange,
    made,
    shown: valid ?? made,
    next,
    problem,
    short,
    stored: valid ?? (type ? undefined : made),
  };
}

export function ItemTypePrefixField({ id, draft }: { id: string; draft: TypePrefixDraft }) {
  const hintId = `${id}-hint`;
  return (
    <SheetRow label="Prefix" htmlFor={id} className="w-32 shrink-0">
      <input
        id={id}
        value={draft.value}
        maxLength={CARD_PREFIX_MAX}
        placeholder={draft.made}
        spellCheck={false}
        autoCapitalize="characters"
        autoComplete="off"
        aria-invalid={draft.problem ? true : undefined}
        aria-describedby={hintId}
        onChange={(e) => draft.onChange(e.target.value)}
        className={`h-[38px] w-full rounded-lg border bg-white px-2.5 font-mono text-[13px] uppercase tracking-wide text-slate-900 outline-none transition placeholder:normal-case placeholder:text-slate-400 focus:ring-2 dark:bg-slate-900 dark:text-slate-100 ${
          draft.problem
            ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 dark:border-rose-500'
            : 'border-slate-200 focus:border-brand-400 focus:ring-brand-500/20 dark:border-slate-700'
        }`}
      />
      <p
        id={hintId}
        aria-live="polite"
        className={`mt-1 text-[11px] leading-snug ${
          draft.short ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        {draft.short ?? (
          <>
            Cards read{' '}
            <span className="font-mono tabular-nums">{`${draft.shown}-${draft.next}`}</span>
          </>
        )}
      </p>
    </SheetRow>
  );
}
