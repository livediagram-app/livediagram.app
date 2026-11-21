'use client';

// Email to Board (docs/specs/026-plan/email-to-board.md "The dialog"): a board of the tab's own address, read fresh when
// it opens, in one of two states. Off: what an email becomes, Each Email Becomes (the card type and column, a card
// target: the boards that show it are read back, never chosen), Who Can Send and Turn On. On: the address with Copy
// Address, a quiet line of what it has done, Each Email Becomes and Who Can Send saving as they change, and New
// Address and Turn Off behind confirms. A tab with several boards gets a board picker at the top.
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import type {
  EmailIntake,
  EmailIntakeSenders as Senders,
  EmailIntakeTarget,
  EmailIntakeType,
  EmailIntakesResponse,
} from '@liveplanner/api-schema';
import {
  Button,
  ConfirmPopover,
  Select,
  lucideGlyph,
  relativeSince,
  useCopiedFlash,
} from '@liveplanner/ui';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { ToolExplainer } from '@liveworkspace/ui/tool-explainer';
import { emailToBoardArt } from '@liveworkspace/ui/tool-explainer-art';
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
import { EmailIntakeMakes } from './EmailIntakeMakes';
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

// "a Bug card in New": what a message becomes, in words ("a card in New" when only the board's column is known).
const cardWords = (target: EmailIntakeTarget | null, column: string | null): string =>
  target
    ? `${withArticle(target.cardType)} card in ${target.column}`
    : column
      ? `a card in ${column}`
      : 'a card';
const withArticle = (word: string): string => `${/^[aeiou]/i.test(word) ? 'an' : 'a'} ${word}`;

// A chosen type and column by the names the api listed them under; its boards are the api's to work out, so none
// are claimed until it answers.
function targetNamed(
  types: readonly EmailIntakeType[],
  target: { typeId: string; status: string },
): EmailIntakeTarget | null {
  const type = types.find((t) => t.id === target.typeId);
  const column = type?.columns.find((c) => c.status === target.status);
  return type && column
    ? { ...target, cardType: type.label, column: column.name, showsOn: [] }
    : null;
}

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
  // What an address not yet on would make, once chosen here (the board's own first type and column until then).
  const [draftMakes, setDraftMakes] = useState<{ typeId: string; status: string } | null>(null);
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
  // What its mail becomes: the address's own card, or, off, the one chosen here over the board's first.
  // An api from before addresses kept a card of their own sends neither `types` nor a `target` (the editor and the
  // api deploy apart): the dialog then reads as it did, with no card to choose, never as an address refusing mail.
  const types = data?.types ?? [];
  const chosen = draftMakes ? targetNamed(types, draftMakes) : null;
  const makes: EmailIntakeTarget | null =
    (intake ? intake.target : (chosen ?? board?.target)) ?? null;

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
      const { intake: made } = await saveEmailIntake(scope, board.id, draft, draftMakes);
      track('Plan', 'Created', 'EmailIntake');
      putIntake(made);
      setDraftMakes(null);
    });

  // Off, a choice only moves the draft; on, it saves at once (the address kept) and goes back if the save fails.
  async function changeMakes(next: { typeId: string; status: string }) {
    if (!board) return;
    setSaveFailed(false);
    if (!intake) {
      setDraftMakes(next);
      return;
    }
    const before = intake;
    // Its names now, its boards once the api has worked them out.
    putIntake({ ...intake, target: targetNamed(types, next) });
    try {
      const { intake: saved } = await saveEmailIntake(scope, board.id, intake.senders, next);
      track('Plan', 'Changed', 'EmailIntakeTarget');
      putIntake(saved);
    } catch {
      putIntake(before);
      setSaveFailed(true);
    }
  }

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
        : board.column === null || (!intake && board.target === null)
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
        {state === 'loading' ? <EmailIntakeSkeleton /> : null}
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
                // What a new address would make was chosen for the other board: this one starts on its own.
                setDraftMakes(null);
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
          // The tool's explainer (footer-tools-menu.md "Explainers"): not on yet.
          <ToolExplainer
            art={emailToBoardArt}
            title="Mail In, Cards Out"
            description={`Forward an email to this board’s own address and it becomes ${cardWords(makes, board.column)}.`}
            steps={[
              'Turn it on to get the board’s own address.',
              'Forward or send an email to it.',
              'The subject becomes the title, the message the description, pictures and PDFs attached.',
            ]}
            data="email-intake"
          />
        ) : null}
        {state === 'on' && intake ? (
          <div className="flex flex-col gap-2" data-email-intake-address="">
            <p
              className={`flex items-center gap-1.5 text-sm font-medium ${
                intake.target === null
                  ? 'text-amber-800 dark:text-amber-200'
                  : 'text-emerald-700 dark:text-emerald-300'
              }`}
            >
              <MailIcon />
              {intake.target === null
                ? 'No board shows its cards now, so its mail is refused. Choose what each email becomes.'
                : `Mail to this address becomes ${cardWords(makes, board?.column ?? null)}.`}
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
        {(state === 'off' || state === 'on') && types.length ? (
          <EmailIntakeMakes
            types={types}
            value={makes}
            showsOn={makes?.showsOn ?? []}
            disabled={busy}
            onChange={(next) => void changeMakes(next)}
          />
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

const BAR = 'animate-pulse rounded bg-slate-200/80 motion-reduce:animate-none dark:bg-slate-700/60';
const BOX = 'animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none dark:bg-slate-800/70';

/** Loading, in the Off state's shape (its line, Who Can Send's two rows and the warning, the footer's room), so the
 *  dialog does not shrink while it loads and grow when the address arrives (owner, 2026-11-17). */
function EmailIntakeSkeleton() {
  return (
    <div aria-busy="true" data-email-intake-skeleton="" className="flex flex-col gap-4">
      <span className="sr-only">Loading this board’s address</span>
      <div className="flex flex-col gap-2 py-0.5">
        <div className={`h-3.5 w-full ${BAR}`} />
        <div className={`h-3.5 w-4/5 ${BAR}`} />
      </div>
      <div className="flex flex-col gap-2">
        <div className={`mb-2 h-3 w-24 ${BAR}`} />
        <div className={`h-[58px] ${BOX}`} />
        <div className={`h-[58px] ${BOX}`} />
        <div className={`mt-1 h-14 ${BOX}`} />
      </div>
      <div className="h-12" />
    </div>
  );
}
