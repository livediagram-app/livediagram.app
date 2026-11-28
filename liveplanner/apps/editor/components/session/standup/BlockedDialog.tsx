'use client';

// Stand-up's Blocked dialog (docs/specs/026-plan/session-tabs.md "Stand-up", "Running it"): a centred dialog (a sheet
// on a phone) with an illustrated header naming the card, a short reason (typed, or filled from a chip) with its
// counter, then Cancel and Mark Blocked. Mark Blocked needs a reason; Enter in the reason presses it and Escape
// cancels. The facilitator's alone, as the action bar is.
import { useEffect, useId, useRef, useState } from 'react';
import { SESSION_REASON_MAX, itemTitle, type Item } from '@liveplanner/items';
import { Button, DialogFooter, TextInput } from '@liveworkspace/ui';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { ChoicePills } from '@/components/primitives/ChoicePills';
import { blockedHeroArt } from './BlockedHeroArt';
import { BLOCKED_CHIPS } from './standup-words';

const HEADING = 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

export function BlockedDialog({
  item,
  cardRef,
  onCancel,
  onConfirm,
}: {
  item: Item;
  cardRef: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const id = useId();
  const titleId = `${id}-title`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [reason, setReason] = useState('');
  const ready = reason.trim().length > 0;
  // With a mouse the reason takes focus at once; on a touch screen the keyboard would cover the sheet.
  useEffect(() => {
    if (!window.matchMedia?.('(pointer: coarse)').matches) inputRef.current?.focus();
  }, []);
  const confirm = () => {
    if (ready) onConfirm(reason.trim());
  };
  return (
    <Dialog open onClose={onCancel} titleId={titleId} size="md" phoneSheet>
      <HeroDialogHeader
        art={blockedHeroArt}
        titleId={titleId}
        title="Mark Blocked"
        subtitle={`${cardRef} · ${itemTitle(item)}`}
        onClose={onCancel}
      />
      <div
        className="scrollbar-slim flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6"
        data-blocked-dialog=""
      >
        <label htmlFor={`${id}-reason`} className={HEADING}>
          What’s in the way?
        </label>
        <ChoicePills
          label="Reasons"
          data="blocked-reasons"
          pills={BLOCKED_CHIPS.map((r) => ({ id: r, label: r }))}
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
          placeholder="Waiting on the payments sandbox keys"
          aria-describedby={`${id}-count`}
          onChange={(e) => setReason(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              confirm();
            }
          }}
        />
        <p className="flex justify-between gap-3 text-[11px] text-slate-500 dark:text-slate-400">
          <span>Flags the card and keeps the reason as a comment on it.</span>
          <span id={`${id}-count`} className="shrink-0 tabular-nums">
            {reason.length} / {SESSION_REASON_MAX}
          </span>
        </p>
      </div>
      <DialogFooter>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={!ready} onClick={confirm}>
          Mark Blocked
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
