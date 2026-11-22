'use client';

// Send to Plan's picker (liveworkspace/docs/specs/004-index/send-to-plan.md "The picker"): a plan (Recent across every
// app, a search, New Plan), its board and column, and the card(s) as the words read them, every field editable before
// sending. Centred on screen, a bottom sheet on a phone. Opens on the plan, board and column last sent to from this
// item. A place already sent offers its card first; sending again is a choice, never a surprise.
import { useEffect, useId, useMemo, useState } from 'react';
import {
  IndexError,
  planSendRef,
  type AutomationTargetDescription,
  type Item,
  type PlanSend,
} from '@liveworkspace/index-client';
import {
  Button,
  CloseIcon,
  DateInput,
  DialogFooter,
  DialogHeader,
  SegmentedToggle,
  Select,
  TextInput,
  lucideGlyph,
} from '@liveworkspace/ui';
import { lucideCircleCheck } from '@liveworkspace/icons/lucide';
import { workbench } from '../../bindings';
import { useToast } from '../../hooks/ui/useToast';
import { indexClient } from '../../lib/index-client';
import { Dialog } from '../dialogs/Dialog';
import { alreadySent, placeTitle, sendCards, type SendMode } from './send-cards';
import { recallSend, rememberSend } from './send-memory';
import { addSends, currentSends } from './send-store';
import type { SendNoun, SendRequest } from './send-to-plan-entry';
import { matchPerson, readSendWords } from './send-words';
import { SendPlanList, type PlanList } from './SendPlanList';
import { chipWords, openSentCard } from './SentChip';

const PLAN_LIST_LIMIT = 30;
const SEARCH_SETTLE_MS = 250;
const DoneGlyph = lucideGlyph(lucideCircleCheck, 16);
const LABEL = 'text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400';

type Client = Pick<
  typeof indexClient,
  'listItems' | 'automationTarget' | 'sendToPlan' | 'newPlanForSend'
>;
type Target =
  | { state: 'idle' }
  | { state: 'loading' }
  | {
      state: 'ready';
      boards: NonNullable<AutomationTargetDescription['boards']>;
      people: { name: string }[];
    }
  | { state: 'refused' };

const NOUNS: Record<SendNoun, string> = {
  sticky: 'this sticky',
  shape: 'this shape',
  element: 'this element',
  elements: 'these elements',
  words: 'these words',
  thread: 'this thread',
  action: 'this action',
  stickies: 'these stickies',
};

function useSettled<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}

export function SendToPlanDialog({
  request,
  sourceId,
  sourceTitle,
  onClose,
  client = indexClient,
  today = new Date(),
}: {
  request: SendRequest;
  sourceId: string;
  sourceTitle: string;
  onClose: () => void;
  client?: Client;
  today?: Date;
}) {
  const toast = useToast();
  const titleId = useId();
  const { places } = request;
  const several = places.length > 1;
  const words = useMemo(() => readSendWords(places[0]?.text ?? '', today), [places, today]);
  const remembered = useMemo(() => recallSend(sourceId), [sourceId]);

  const [query, setQuery] = useState('');
  const settledQuery = useSettled(query.trim(), SEARCH_SETTLE_MS);
  const [plansFor, setPlansFor] = useState<{ key: string; list: PlanList } | null>(null);
  const [extraPlans, setExtraPlans] = useState<Item[]>([]);
  const [plan, setPlan] = useState<{ id: string; title: string } | null>(
    remembered ? { id: remembered.planId, title: remembered.planTitle } : null,
  );
  const [target, setTarget] = useState<Target>({ state: 'idle' });
  const [board, setBoard] = useState(remembered?.board ?? '');
  const [column, setColumn] = useState(remembered?.column ?? '');
  const [mode, setMode] = useState<SendMode>('each');
  const [title, setTitle] = useState(() =>
    several ? `${sourceTitle || 'Untitled'} actions` : placeTitle(places[0]!, today),
  );
  const [assignee, setAssignee] = useState('');
  const [due, setDue] = useState(words.due ?? '');
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<PlanSend | null>(() =>
    alreadySent(places, currentSends(), planSendRef),
  );

  useEffect(() => {
    workbench.track('UI', 'Opened', 'SendToPlan');
  }, []);

  // The person's plans, most recent across every app first.
  useEffect(() => {
    const abort = new AbortController();
    client
      .listItems(
        {
          app: 'liveplanner',
          view: 'recent',
          limit: PLAN_LIST_LIMIT,
          ...(settledQuery ? { q: settledQuery } : {}),
        },
        { signal: abort.signal },
      )
      .then((page) =>
        setPlansFor({ key: settledQuery, list: { state: 'ready', items: page.items } }),
      )
      .catch(() => {
        if (!abort.signal.aborted) setPlansFor({ key: settledQuery, list: { state: 'failed' } });
      });
    return () => abort.abort();
  }, [client, settledQuery]);
  const listed: PlanList =
    plansFor?.key !== settledQuery
      ? { state: 'loading' }
      : plansFor.list.state === 'ready' && !settledQuery
        ? {
            state: 'ready',
            items: [
              ...extraPlans,
              ...plansFor.list.items.filter((i) => !extraPlans.some((e) => e.id === i.id)),
            ],
          }
        : plansFor.list;

  // The plan's boards, columns and people, through liveplanner's own door with the person's grant.
  const planId = plan?.id ?? null;
  useEffect(() => {
    if (!planId) return;
    const abort = new AbortController();
    setTarget({ state: 'loading' });
    client
      .automationTarget(planId, { signal: abort.signal })
      .then((d) => {
        const boards = d.boards ?? [];
        setTarget({ state: 'ready', boards, people: d.people ?? [] });
        const keep = boards.find((b) => b.id === board) ?? boards[0];
        setBoard(keep?.id ?? '');
        setColumn((was) => (keep?.columns.includes(was) ? was : (keep?.columns[0] ?? '')));
        const named = words.mention ? matchPerson(words.mention, d.people ?? []) : null;
        setAssignee((was) => was || named || '');
      })
      .catch(() => {
        if (!abort.signal.aborted) setTarget({ state: 'refused' });
      });
    return () => abort.abort();
    // The board kept is read once a plan; picking another board after is the person's own.
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- the board, column and assignee are read once a plan
  }, [client, planId]);

  const boards = target.state === 'ready' ? target.boards : [];
  const columns = boards.find((b) => b.id === board)?.columns ?? [];
  const people = target.state === 'ready' ? target.people : [];
  const unmatched =
    words.mention && target.state === 'ready' && !matchPerson(words.mention, people)
      ? words.mention
      : null;
  const ready = !!plan && target.state === 'ready' && !!board && !!column && !sending;

  const makePlan = async (name: string) => {
    setCreating(true);
    try {
      const { item } = await client.newPlanForSend(name);
      setExtraPlans((was) => [item, ...was]);
      setPlan({ id: item.id, title: item.title });
      setQuery('');
    } catch {
      setError("Couldn't make the plan. Try again in a moment.");
    } finally {
      setCreating(false);
    }
  };

  const send = async (again: boolean) => {
    if (!plan || !ready) return;
    setSending(true);
    setError(null);
    const cards = sendCards(places, { mode, title, assignee, due }, today);
    try {
      const { sends } = await client.sendToPlan(plan.id, {
        board,
        column,
        cards,
        ...(again ? { again: true } : {}),
      });
      addSends(sends);
      rememberSend(sourceId, {
        planId: plan.id,
        planTitle: plan.title,
        board,
        column,
        at: Date.now(),
      });
      workbench.track('UI', 'Created', 'SendToPlan');
      const first = sends[0];
      const count = new Set(sends.map((s) => s.card.id)).size;
      toast.success(
        `Sent ${count === 1 ? 'a card' : `${count} cards`} to ${plan.title || 'the plan'}`,
        {
          ...(first ? { action: { label: 'Open Card', onSelect: () => openSentCard(first) } } : {}),
        },
      );
      onClose();
    } catch (err) {
      workbench.track('UI', 'Refused', 'SendToPlan');
      setSending(false);
      if (err instanceof IndexError && err.code === 'already_sent') {
        const send = err.detail?.send as PlanSend | undefined;
        if (send) setExisting(send);
        return;
      }
      setError(refusal(err));
    }
  };

  const noun = NOUNS[request.noun];
  return (
    <Dialog
      open
      onClose={onClose}
      ariaLabel="Send to Plan"
      size="xl"
      phoneSheet
      className="max-h-[92vh]"
    >
      <DialogHeader
        title="Send to Plan"
        subtitle={`Make ${several ? 'cards' : 'a card'} in liveplanner from ${noun}. It stays as it is here.`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 sm:size-8 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <CloseIcon size={18} />
        </button>
      </DialogHeader>
      <form
        id={titleId}
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          void send(existing !== null);
        }}
      >
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-x-6 gap-y-5 overflow-y-auto px-6 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          {existing ? (
            <div
              role="status"
              data-already-sent=""
              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-900 sm:col-span-2 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100"
            >
              <DoneGlyph aria-hidden className="shrink-0" />
              <span className="min-w-0 flex-1">
                Already sent: <span className="font-semibold">{existing.card.title}</span> ·{' '}
                {chipWords(existing)}. Sending again makes another card.
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => openSentCard(existing)}
              >
                Open Card
              </Button>
            </div>
          ) : null}
          <section className="flex min-w-0 flex-col gap-2" aria-label="Plan">
            <h3 className={LABEL}>Plan</h3>
            <SendPlanList
              plans={listed}
              query={query}
              onQuery={setQuery}
              pickedId={plan?.id ?? null}
              onPick={(p) => setPlan({ id: p.id, title: p.title })}
              newName={`Plans from ${sourceTitle || 'Untitled'}`.slice(0, 120)}
              onCreate={(name) => void makePlan(name)}
              creating={creating}
            />
          </section>
          <section className="flex min-w-0 flex-col gap-3" aria-label="Card" aria-live="polite">
            <h3 className={LABEL}>Card</h3>
            {!plan ? (
              <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Pick a plan for the card.
              </p>
            ) : target.state === 'refused' ? (
              <p className="rounded-lg border border-dashed border-amber-300 px-4 py-6 text-center text-sm text-amber-800 dark:border-amber-500/40 dark:text-amber-200">
                You can&apos;t add cards to this plan. Pick one you can edit.
              </p>
            ) : (
              <CardFields
                loading={target.state !== 'ready'}
                boards={boards}
                board={board}
                onBoard={(id) => {
                  setBoard(id);
                  setColumn(boards.find((b) => b.id === id)?.columns[0] ?? '');
                }}
                columns={columns}
                column={column}
                onColumn={setColumn}
                several={several}
                count={places.length}
                cut={request.cut}
                mode={mode}
                onMode={setMode}
                title={title}
                onTitle={setTitle}
                people={people}
                assignee={assignee}
                onAssignee={setAssignee}
                unmatched={unmatched}
                due={due}
                onDue={setDue}
              />
            )}
            {error ? (
              <p role="alert" className="text-sm text-red-600 dark:text-red-300">
                {error}
              </p>
            ) : null}
          </section>
        </div>
        <DialogFooter>
          <p className="mr-auto hidden text-xs text-slate-500 sm:block dark:text-slate-400">
            Made as you, linked back to the exact place.
          </p>
          <Button type="button" variant="secondary" onClick={onClose} className="shrink-0">
            Cancel
          </Button>
          <Button type="submit" disabled={!ready} className="shrink-0 whitespace-nowrap">
            {sending ? 'Sending…' : existing ? 'Send Again' : 'Send to Plan'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

function refusal(err: unknown): string {
  if (err instanceof IndexError) {
    if (err.code === 'rate_limited')
      return 'That is a lot of cards at once. Try again in a minute.';
    if (err.code === 'source_full') return 'This item has sent as many cards as it may.';
    if (err.code === 'plan_refused') {
      const reason = err.detail?.reason;
      return typeof reason === 'string' && reason
        ? `The plan refused: ${reason}.`
        : 'The plan refused the card.';
    }
    if (err.status === 403 || err.status === 404) return "You can't add cards to this plan.";
  }
  return "Couldn't send. Check your connection and try again.";
}

function CardFields(props: {
  loading: boolean;
  boards: NonNullable<AutomationTargetDescription['boards']>;
  board: string;
  onBoard: (id: string) => void;
  columns: string[];
  column: string;
  onColumn: (c: string) => void;
  several: boolean;
  count: number;
  cut: number | undefined;
  mode: SendMode;
  onMode: (m: SendMode) => void;
  title: string;
  onTitle: (t: string) => void;
  people: { name: string }[];
  assignee: string;
  onAssignee: (a: string) => void;
  unmatched: string | null;
  due: string;
  onDue: (d: string) => void;
}) {
  const ids = { board: useId(), column: useId(), title: useId(), who: useId(), due: useId() };
  const field = 'flex min-w-0 flex-col gap-1.5';
  const label = 'text-[13px] font-medium text-slate-700 dark:text-slate-200';
  if (!props.loading && props.boards.length === 0)
    return (
      <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        This plan has no board yet. Add one in liveplanner, or pick another plan.
      </p>
    );
  const oneTitle = !props.several || props.mode === 'checklist';
  return (
    <div
      className={`flex flex-col gap-3 ${props.loading ? 'animate-pulse motion-reduce:animate-none' : ''}`}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className={field}>
          <label htmlFor={ids.board} className={label}>
            Board
          </label>
          <Select
            id={ids.board}
            value={props.board}
            disabled={props.loading}
            onChange={(e) => props.onBoard(e.target.value)}
            className="w-full"
            selectClassName="w-full"
          >
            {props.boards.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </div>
        <div className={field}>
          <label htmlFor={ids.column} className={label}>
            Column
          </label>
          <Select
            id={ids.column}
            value={props.column}
            disabled={props.loading}
            onChange={(e) => props.onColumn(e.target.value)}
            className="w-full"
            selectClassName="w-full"
          >
            {props.columns.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {props.several ? (
        <div className={field}>
          <SegmentedToggle
            label="Cards"
            value={props.mode}
            onChange={props.onMode}
            options={[
              { value: 'each', label: `${props.count} Cards`, description: 'One card for each.' },
              {
                value: 'checklist',
                label: 'One Card with a Checklist',
                description: 'One card, each of them a row of its checklist.',
              },
            ]}
          />
          {props.cut ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              The first {props.count} of {props.cut}: a send makes at most {props.count} cards.
            </p>
          ) : null}
        </div>
      ) : null}
      {oneTitle ? (
        <div className={field}>
          <label htmlFor={ids.title} className={label}>
            Title
          </label>
          <TextInput
            id={ids.title}
            value={props.title}
            onChange={(e) => props.onTitle(e.target.value)}
            maxLength={200}
            autoFocus
          />
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <div className={field}>
          <label htmlFor={ids.who} className={label}>
            Assignee
          </label>
          <Select
            id={ids.who}
            value={props.assignee}
            disabled={props.loading}
            onChange={(e) => props.onAssignee(e.target.value)}
            className="w-full"
            selectClassName="w-full"
          >
            <option value="">Nobody</option>
            {props.people.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </Select>
          {props.unmatched && !props.assignee ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Nobody in this plan is called {props.unmatched}.
            </p>
          ) : null}
        </div>
        <div className={field}>
          <label htmlFor={ids.due} className={label}>
            Due
          </label>
          <DateInput
            id={ids.due}
            value={props.due || undefined}
            onCommit={(d) => props.onDue(d ?? '')}
          />
        </div>
      </div>
    </div>
  );
}
