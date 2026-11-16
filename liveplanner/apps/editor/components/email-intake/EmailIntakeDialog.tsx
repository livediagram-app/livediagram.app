'use client';

// Email to Board (docs/specs/026-plan/email-to-board.md "The dialog"): a board of the tab's own address, read fresh when
// it opens, in one of two states. Off: what an email becomes, Who Can Send and Turn On. On: the address with Copy
// Address, a quiet line of what it has done, Who Can Send saving as it changes, and New Address and Turn Off behind
// confirms. A tab with several boards gets a board picker at the top.
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import type {
  EmailIntake,
  EmailIntakeSenders as Senders,
  EmailIntakesResponse,
} from '@liveplanner/api-schema';
import {
  Button,
  ConfirmPopover,
  LoadingSweep,
  Select,
  lucideGlyph,
  relativeSince,
  useCopiedFlash,
} from '@liveplanner/ui';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { lucideMail } from '@liveworkspace/icons/lucide';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { DialogFooter } from '@liveworkspace/workbench/components/dialogs/DialogFooter';
import { useRelativeNow } from '@/lib/relative-time';
import { track } from '@/lib/telemetry';
import {
  newEmailIntakeAddress,
  readEmailIntakes,
  saveEmailIntake,
  turnOffEmailIntake,
} from './email-intake-client';
import type { EmailIntakeScope } from './email-intake-gate';
import { emailIntakeHeroArt } from './EmailIntakeHeroArt';
import { EmailIntakeSenders } from './EmailIntakeSenders';

const MailIcon = lucideGlyph(lucideMail, 14);

const ADDRESS_FIELD =
  'w-full min-w-0 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The quiet line of what an address has done: "3 cards made · 1 refused · Last card 2 hours ago". */
export function intakeCountsLine(intake: EmailIntake, now: number): string {
  if (intake.made === 0 && intake.refused === 0 && intake.dropped === 0) return 'No mail yet.';
  const parts = [plural(intake.made, 'card made', 'cards made')];
  if (intake.refused > 0) parts.push(`${intake.refused} refused`);
  if (intake.dropped > 0) parts.push(`${intake.dropped} dropped`);
  if (intake.lastAt !== null) parts.push(`Last card ${relativeSince(intake.lastAt, now)}`);
  return parts.join(' · ');
}

type Confirming = { kind: 'new' | 'off'; anchor: HTMLElement };

export function EmailIntakeDialog({
  scope,
  boardIds,
  onClose,
}: {
  scope: EmailIntakeScope;
  // The Plan boards on the tab, in its order.
  boardIds: readonly string[];
  onClose: () => void;
}) {
  const titleId = useId();
  const pickerId = useId();
  const fieldId = useId();
  const now = useRelativeNow();
  const [data, setData] = useState<EmailIntakesResponse | null>(null);
  const [readFailed, setReadFailed] = useState(false);
  const [boardId, setBoardId] = useState<string | null>(null);
  // Who Can Send for a board whose address is off (an address's own is its row's).
  const [draft, setDraft] = useState<Senders>('members');
  const [busy, setBusy] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  const { copied, flash } = useCopiedFlash(1800);

  const read = useCallback(async () => {
    try {
      setData(await readEmailIntakes(scope));
    } catch {
      setReadFailed(true);
    }
  }, [scope]);
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- a fetch from the api: its state lands after the await, never synchronously
    void read();
  }, [read]);

  // The tab's boards the api knows, in the tab's order (a board just drawn may not be saved yet).
  const boards = useMemo(
    () => (data ? boardIds.flatMap((id) => data.boards.filter((b) => b.id === id)) : []),
    [data, boardIds],
  );
  const board = boards.find((b) => b.id === boardId) ?? boards[0] ?? null;
  const intake = board ? (data?.intakes.find((i) => i.boardId === board.id) ?? null) : null;

  const putIntake = (next: EmailIntake) =>
    setData((d) =>
      d ? { ...d, intakes: [...d.intakes.filter((i) => i.boardId !== next.boardId), next] } : d,
    );

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setSaveFailed(false);
    try {
      await work();
    } catch {
      setSaveFailed(true);
    }
    setBusy(false);
  }

  const turnOn = () =>
    run(async () => {
      if (!board) return;
      const { intake: made } = await saveEmailIntake(scope, board.id, draft);
      track('Plan', 'Created', 'EmailIntake');
      putIntake(made);
    });

  // Off, a choice only moves the draft; on, it saves at once (the address kept) and goes back if the save fails.
  async function changeSenders(next: Senders) {
    if (!board) return;
    setSaveFailed(false);
    if (!intake) {
      setDraft(next);
      return;
    }
    const before = intake;
    putIntake({ ...intake, senders: next });
    try {
      const { intake: saved } = await saveEmailIntake(scope, board.id, next);
      track('Plan', 'Changed', 'EmailIntakeSenders');
      putIntake(saved);
    } catch {
      putIntake(before);
      setSaveFailed(true);
    }
  }

  const newAddress = () =>
    run(async () => {
      setConfirming(null);
      if (!board) return;
      const { intake: next } = await newEmailIntakeAddress(scope, board.id);
      track('Plan', 'Changed', 'EmailIntakeAddress');
      putIntake(next);
    });

  const turnOff = () =>
    run(async () => {
      setConfirming(null);
      if (!board) return;
      await turnOffEmailIntake(scope, board.id);
      track('Plan', 'Ended', 'EmailIntake');
      if (intake) setDraft(intake.senders);
      setData((d) => (d ? { ...d, intakes: d.intakes.filter((i) => i.boardId !== board.id) } : d));
    });

  async function copy() {
    if (!intake) return;
    try {
      await navigator.clipboard.writeText(intake.address);
      flash();
      track('Plan', 'Copied', 'EmailIntake');
    } catch {
      // No clipboard (an insecure context, a refused permission): the field is selected to copy by hand.
      const field = document.getElementById(fieldId) as HTMLInputElement | null;
      field?.focus();
      field?.select();
    }
  }

  const state = !data
    ? readFailed
      ? 'error'
      : 'loading'
    : !data.available
      ? 'unavailable'
      : !board
        ? 'no-board'
        : board.column === null
          ? 'no-column'
          : intake
            ? 'on'
            : 'off';

  return (
    <Dialog open onClose={onClose} titleId={titleId} size="md" phoneSheet>
      <HeroDialogHeader
        art={emailIntakeHeroArt}
        titleId={titleId}
        title="Email to Board"
        subtitle="Forward mail. Get cards."
        onClose={onClose}
      />
      <div
        className="scrollbar-slim flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6"
        data-email-intake-state={state}
      >
        {state === 'loading' ? (
          <div className="flex h-24 items-center justify-center" aria-busy="true">
            <span className="sr-only">Loading this board’s address</span>
            <LoadingSweep />
          </div>
        ) : null}
        {state === 'error' ? (
          <div className="flex items-center justify-between gap-3">
            <p role="alert" className="text-sm text-slate-700 dark:text-slate-200">
              Couldn’t load this board’s address.
            </p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setReadFailed(false);
                void read();
              }}
            >
              Try Again
            </Button>
          </div>
        ) : null}
        {state === 'unavailable' ? (
          <p className="text-sm text-slate-700 dark:text-slate-200">
            Email to Board isn’t set up on this server.
          </p>
        ) : null}
        {state === 'no-board' ? (
          <p className="text-sm text-slate-700 dark:text-slate-200">
            This tab has no saved board yet. Try again in a moment.
          </p>
        ) : null}
        {boards.length > 1 && board && data?.available ? (
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor={pickerId}
              className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
            >
              Board
            </label>
            <Select
              id={pickerId}
              value={board.id}
              disabled={busy}
              onChange={(e) => {
                setBoardId(e.target.value);
                setSaveFailed(false);
              }}
              className="min-w-0 max-w-[65%]"
              selectClassName="w-full truncate"
            >
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title || b.tabName}
                  {data.intakes.some((i) => i.boardId === b.id) ? ' (on)' : ''}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
        {state === 'no-column' ? (
          <p className="text-sm text-slate-700 dark:text-slate-200">
            This board has no column for new cards.
          </p>
        ) : null}
        {state === 'off' && board ? (
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            Forward an email to this board’s own address and it becomes a card in{' '}
            <strong className="font-semibold text-slate-900 dark:text-slate-50">
              {board.column}
            </strong>
            : the subject as its title, the message as its description, pictures attached.
          </p>
        ) : null}
        {state === 'on' && intake ? (
          <div className="flex flex-col gap-2" data-email-intake-address="">
            <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              <MailIcon />
              Mail to this address becomes a card in {board?.column}.
            </p>
            <div className="flex items-center gap-2">
              <input
                id={fieldId}
                readOnly
                aria-label="Board address"
                value={intake.address}
                spellCheck={false}
                onFocus={(e) => e.currentTarget.select()}
                className={ADDRESS_FIELD}
              />
              <Button size="sm" onClick={() => void copy()} className="shrink-0">
                {copied ? 'Copied' : 'Copy Address'}
              </Button>
            </div>
            <span role="status" className="sr-only">
              {copied ? 'Board address copied' : ''}
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400" data-email-intake-counts="">
              {intakeCountsLine(intake, now)}
            </p>
          </div>
        ) : null}
        {state === 'off' || state === 'on' ? (
          <EmailIntakeSenders
            value={intake?.senders ?? draft}
            disabled={busy}
            onChange={(next) => void changeSenders(next)}
          />
        ) : null}
        {saveFailed ? (
          <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">
            Couldn’t save. Try again.
          </p>
        ) : null}
      </div>
      {state === 'off' || state === 'on' ? (
        <DialogFooter>
          {state === 'off' ? (
            <Button size="sm" busy={busy} onClick={() => void turnOn()}>
              Turn On
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={(e) => setConfirming({ kind: 'new', anchor: e.currentTarget })}
              >
                New Address
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={(e) => setConfirming({ kind: 'off', anchor: e.currentTarget })}
              >
                Turn Off
              </Button>
              <Button size="sm" onClick={onClose}>
                Done
              </Button>
            </>
          )}
        </DialogFooter>
      ) : null}
      {confirming ? (
        <ConfirmPopover
          anchor={confirming.anchor}
          message={confirming.kind === 'new' ? 'Make a new address?' : 'Turn off this address?'}
          warning={
            confirming.kind === 'new'
              ? 'The old one stops taking mail at once.'
              : 'Mail sent to it is refused from now on.'
          }
          confirmLabel={confirming.kind === 'new' ? 'New Address' : 'Turn Off'}
          onConfirm={() => void (confirming.kind === 'new' ? newAddress() : turnOff())}
          onCancel={() => setConfirming(null)}
        />
      ) : null}
    </Dialog>
  );
}
