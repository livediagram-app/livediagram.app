'use client';

// Bug Triage's Close dialog (docs/specs/026-plan/session-tabs.md "Bug Triage", "Closing a bug"): a centred dialog
// (a sheet on a phone) with an illustrated header naming the card, a short reason (typed, or filled from a chip) with
// its counter, an optional Duplicate Of picked with the plan's card picker, where the card goes, then Cancel and
// Close {Type}. Close needs a reason; Enter in the reason presses it and Escape cancels. The facilitator's alone, as
// the action bar is.
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
import { lucideArrowRight, lucideLink, lucideX } from '@liveworkspace/icons/lucide';
import { Button, DialogFooter, TextInput } from '@liveworkspace/ui';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { Tooltip, lucideGlyph } from '@liveplanner/ui';
import { ChoicePills } from '@/components/primitives/ChoicePills';
import { CardPickerDialog } from '@/components/plan/CardPickerDialog';
import { byNewestChange, pickCardOf, useCardPickerSearch } from '@/components/plan/card-picker';
import { refOf } from '../session-words';
import type { SessionCloseInput } from '../useSessionRun';
import { closeHeroArt } from './CloseHeroArt';
import { REASON_CHIPS, duplicateReason } from './triage-words';

const LinkIcon = lucideGlyph(lucideLink, 14);
const RemoveIcon = lucideGlyph(lucideX, 12);
const ArrowIcon = lucideGlyph(lucideArrowRight, 14);

const HEADING = 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

export function CloseDialog({
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
  const titleId = `${id}-title`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [reason, setReason] = useState('');
  const [dupId, setDupId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const type = typeIn(types, item.type);
  const dup = dupId ? (items.get(dupId) ?? null) : null;
  const ready = reason.trim().length > 0;
  // With a mouse the reason takes focus at once; on a touch screen the keyboard would cover the sheet.
  useEffect(() => {
    if (!window.matchMedia?.('(pointer: coarse)').matches) inputRef.current?.focus();
  }, []);
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
  const ref = refOf(item.id, items, types);
  return (
    <Dialog open onClose={onCancel} titleId={titleId} size="md" phoneSheet>
      <HeroDialogHeader
        art={closeHeroArt}
        titleId={titleId}
        title={`Close ${type.label}`}
        subtitle={`${ref} · ${itemTitle(item)}`}
        onClose={onCancel}
      />
      <div
        className="scrollbar-slim flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6"
        data-close-dialog=""
      >
        <section className="flex flex-col gap-2">
          <label htmlFor={`${id}-reason`} className={HEADING}>
            Reason
          </label>
          <ChoicePills
            label="Reasons"
            data="close-reasons"
            pills={REASON_CHIPS.map((r) => ({ id: r, label: r }))}
            pressed={(r) => reason === r}
            onPick={(r) => {
              setReason(r);
              inputRef.current?.focus();
            }}
          />
          <TextInput
            id={`${id}-reason`}
            ref={inputRef}
            value={reason}
            maxLength={SESSION_REASON_MAX}
            placeholder="Why close it? A few words"
            aria-describedby={`${id}-count`}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                confirm();
              }
            }}
          />
          <p
            id={`${id}-count`}
            className="self-end text-[11px] tabular-nums text-slate-500 dark:text-slate-400"
          >
            {reason.length} / {SESSION_REASON_MAX}
          </p>
        </section>
        <section className="flex flex-col gap-2">
          <h3 className={HEADING}>
            Duplicate Of <span className="font-normal normal-case tracking-normal">(optional)</span>
          </h3>
          {/* One row's height either way, so the dialog keeps its height as a duplicate comes and goes. */}
          <div className="flex h-9 items-center">
            {dup ? (
              <span
                className="inline-flex h-9 min-w-0 max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-white pl-3 pr-1 text-[13px] dark:border-slate-700 dark:bg-slate-900"
                data-duplicate-chip={dup.id}
              >
                <span className="shrink-0 text-[12px] font-medium text-slate-500 dark:text-slate-400">
                  {refOf(dup.id, items, types)}
                </span>
                <span className="truncate text-slate-800 dark:text-slate-100">
                  {itemTitle(dup)}
                </span>
                <Tooltip label="Remove Duplicate">
                  <button
                    type="button"
                    aria-label="Remove Duplicate"
                    onClick={() => setDupId(null)}
                    className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  >
                    <RemoveIcon aria-hidden />
                  </button>
                </Tooltip>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setPicking(true)}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 text-[13px] font-medium text-slate-600 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <LinkIcon aria-hidden />
                Link Duplicate
              </button>
            )}
          </div>
        </section>
        <p
          className="flex items-center gap-2 text-[13px] text-slate-600 dark:text-slate-300"
          role="status"
          data-close-moves=""
        >
          <span className="text-slate-500 dark:text-slate-400">
            <ArrowIcon aria-hidden />
          </span>
          {to ? (
            <span>
              Moves to{' '}
              <strong className="font-semibold text-slate-900 dark:text-slate-100">{to}</strong>
            </span>
          ) : (
            <span>
              Stays in{' '}
              <strong className="font-semibold text-slate-900 dark:text-slate-100">
                {statusName}
              </strong>
              : no closing stage
            </span>
          )}
        </p>
      </div>
      <DialogFooter>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={!ready} onClick={confirm}>
          {`Close ${type.label}`}
        </Button>
      </DialogFooter>
      {picking ? (
        <CardPickerDialog
          title="Link Duplicate"
          description={`Pick the card ${ref} repeats. Closing links the two.`}
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
    </Dialog>
  );
}
