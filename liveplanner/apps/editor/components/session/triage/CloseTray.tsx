'use client';

// Bug Triage's close tray (docs/specs/026-plan/session-tabs.md "Bug Triage", "Running it"): in the action bar's place
// once Close is pressed, a short reason (typed, or filled from a chip), an optional Duplicate Of picked with the plan's
// card picker, where the card goes, Cancel and Close {Type}. Close needs a reason; Enter in the reason presses it and
// Escape cancels. The facilitator's alone, as the action bar is.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  SESSION_REASON_MAX,
  isArchived,
  isTrashed,
  itemTitle,
  typeIn,
  type Item,
  type ItemTypeDef,
} from '@liveplanner/items';
import { lucideLink, lucideX } from '@liveworkspace/icons/lucide';
import { Tooltip, lucideGlyph, useEscape } from '@liveplanner/ui';
import { CardPickerDialog } from '@/components/plan/CardPickerDialog';
import { byNewestChange, pickCardOf, useCardPickerSearch } from '@/components/plan/card-picker';
import { refOf } from '../session-words';
import type { SessionCloseInput } from '../useSessionRun';
import { REASON_CHIPS, duplicateReason } from './triage-words';

const LinkIcon = lucideGlyph(lucideLink, 14);
const RemoveIcon = lucideGlyph(lucideX, 12);

const HEADING =
  'text-[12px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';
const button =
  'inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800';
const chip =
  'inline-flex h-8 cursor-pointer items-center rounded-md border px-2.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500';
const chipOff =
  'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800';
const chipOn =
  'border-rose-500 bg-rose-50 text-rose-800 dark:border-rose-400 dark:bg-rose-950/50 dark:text-rose-200';

export function CloseTray({
  item,
  items,
  types,
  targetName,
  statusName,
  onCancel,
  onConfirm,
}: {
  item: Item;
  items: ReadonlyMap<string, Item>;
  types: readonly ItemTypeDef[];
  // Where Close takes the card (a column's name), with a duplicate linked or not; null when it stays.
  targetName: (duplicate: boolean) => string | null;
  // The card's own column's name.
  statusName: string;
  onCancel: () => void;
  onConfirm: (input: SessionCloseInput) => void;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [reason, setReason] = useState('');
  const [dupId, setDupId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const type = typeIn(types, item.type);
  const dup = dupId ? (items.get(dupId) ?? null) : null;
  const ready = reason.trim().length > 0;
  // With a mouse the reason takes focus at once; on a touch screen the keyboard would cover the card.
  useEffect(() => {
    if (!window.matchMedia?.('(pointer: coarse)').matches) inputRef.current?.focus();
  }, []);
  useEscape(onCancel, { enabled: !picking });
  const rows = useMemo(
    () =>
      picking
        ? [...items.values()]
            .filter((i) => i.id !== item.id && !isTrashed(i) && !isArchived(i))
            .map((i) => pickCardOf(i, types))
            .sort(byNewestChange)
        : [],
    [picking, items, item.id, types],
  );
  const picker = useCardPickerSearch(rows);
  const confirm = () => {
    if (!ready) return;
    onConfirm({ reason: reason.trim(), ...(dup ? { duplicateOf: dup.id } : {}) });
  };
  const to = targetName(!!dup);
  return (
    <div
      role="group"
      aria-label={`Close ${type.label}`}
      data-close-tray=""
      className="flex flex-col gap-2.5 border-t border-rose-200 bg-rose-50/50 px-4 py-3 sm:px-6 xl:pr-[20rem] dark:border-rose-900/60 dark:bg-rose-950/20"
    >
      <div role="group" aria-label="Reasons" className="flex flex-wrap items-center gap-1.5">
        <span className={`${HEADING} mr-1`}>Close As</span>
        {REASON_CHIPS.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={reason === r}
            onClick={() => {
              setReason(r);
              inputRef.current?.focus();
            }}
            className={`${chip} ${reason === r ? chipOn : chipOff}`}
          >
            {r}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor={`${id}-reason`} className="sr-only">
          Reason
        </label>
        <input
          id={`${id}-reason`}
          ref={inputRef}
          value={reason}
          maxLength={SESSION_REASON_MAX}
          placeholder="Why close it? A few words"
          onChange={(e) => setReason(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              confirm();
            }
          }}
          className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 placeholder:text-slate-400 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-400/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <span className="shrink-0 text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
          {reason.length} / {SESSION_REASON_MAX}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={HEADING}>Duplicate Of</span>
        {dup ? (
          <span
            className="inline-flex h-8 min-w-0 max-w-[18rem] items-center gap-1.5 rounded-lg border border-slate-200 bg-white pl-2.5 pr-1 text-[13px] dark:border-slate-700 dark:bg-slate-900"
            data-duplicate-chip={dup.id}
          >
            <span className="shrink-0 text-[12px] font-medium text-slate-500 dark:text-slate-400">
              {refOf(dup.id, items, types)}
            </span>
            <span className="truncate text-slate-800 dark:text-slate-100">{itemTitle(dup)}</span>
            <Tooltip label="Remove Duplicate">
              <button
                type="button"
                aria-label="Remove Duplicate"
                onClick={() => setDupId(null)}
                className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <RemoveIcon aria-hidden />
              </button>
            </Tooltip>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-2.5 text-[13px] font-medium text-slate-600 hover:border-slate-400 hover:bg-white hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-900"
          >
            <LinkIcon aria-hidden />
            Link Duplicate
          </button>
        )}
        <span className="min-w-0 flex-1 truncate px-1 text-[13px] text-slate-500 max-sm:basis-full dark:text-slate-400">
          {to ? (
            <>
              Moves to{' '}
              <strong className="font-semibold text-slate-800 dark:text-slate-100">{to}</strong>
            </>
          ) : (
            <>
              Stays in{' '}
              <strong className="font-semibold text-slate-800 dark:text-slate-100">
                {statusName}
              </strong>
              : no closing stage
            </>
          )}
        </span>
        <div className="flex gap-2 max-sm:ml-auto">
          <button type="button" className={button} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={confirm}
            className="inline-flex h-10 cursor-pointer items-center rounded-lg bg-rose-600 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-rose-600 dark:focus-visible:ring-offset-slate-900"
          >
            Close {type.label}
          </button>
        </div>
      </div>
      {picking ? (
        <CardPickerDialog
          title="Link Duplicate"
          description={`Pick the card ${refOf(item.id, items, types)} repeats. Closing links the two.`}
          cards={picker.shown}
          query={picker.query}
          onQuery={picker.setQuery}
          listLabel="Cards in this plan"
          emptyText="This plan has no other cards to link."
          showType={types.length > 1}
          onPick={(picked) => {
            setDupId(picked.itemId);
            setPicking(false);
            const dupRef = refOf(picked.itemId, items, types);
            setReason((r) => (r.trim() && r !== 'Duplicate' ? r : duplicateReason(dupRef)));
          }}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </div>
  );
}
