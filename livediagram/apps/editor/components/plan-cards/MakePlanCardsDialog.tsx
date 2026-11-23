'use client';

// Make Plan Cards' preview (docs/specs/013-workspace/make-plan-cards.md "The preview"): a plan, board and column as Send
// to Plan's picker offers them, how lanes land, and one row a card, every one ticked, with the shapes no longer on the
// tab offered (unticked) for the Trash. Nothing is written until Make Cards. Centred, a bottom sheet on a phone.
import { useEffect, useId, useMemo, useState } from 'react';
import { IndexError, type AutomationTargetDescription, type Item } from '@liveworkspace/index-client';
import { Button, DialogFooter, SegmentedToggle, Select } from '@liveworkspace/ui';
import { Callout } from '@liveworkspace/ui/callout';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { makePlanCardsHeroArt } from '@liveworkspace/ui/dialog-hero-art/make-plan-cards';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { SendPlanList, type PlanList } from '@liveworkspace/workbench/components/send-to-plan/SendPlanList';
import { recallSend, rememberSend } from '@liveworkspace/workbench/components/send-to-plan/send-memory';
import { addSends, refreshSends } from '@liveworkspace/workbench/components/send-to-plan/send-store';
import { SearchInput } from '@liveworkspace/workbench/components/primitives/SearchInput';
import { useToast } from '@liveworkspace/workbench/hooks/ui/useToast';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { track } from '@/lib/telemetry';
import {
  defaultLaneMode,
  makeAsk,
  makePreview,
  type LaneMode,
  type MakeRow,
  type MakeShape,
  type RemovedCard,
} from '@/lib/plan-cards/make-plan-rows';

const PLAN_LIST_LIMIT = 30;
const SEARCH_SETTLE_MS = 250;
const LABEL = 'text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400';
const BOX = 'h-4 w-4 shrink-0 cursor-pointer';
// Rows past this many are reached by the search: the list stays light at 500 shapes.
const ROWS_SHOWN = 200;

type Client = Pick<
  typeof indexClient,
  'listItems' | 'automationTarget' | 'makePlanCards' | 'newPlanForSend'
>;
type Boards = NonNullable<AutomationTargetDescription['boards']>;
type Target =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'ready'; boards: Boards }
  | { state: 'refused' };

function useSettled<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}

const DAY = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
const dayWords = (day: string) => {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return DAY.format(new Date(y, m - 1, d));
};
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function MakePlanCardsDialog({
  shapes,
  removed,
  sends,
  source,
  sourceTitle,
  onClose,
  client = indexClient,
}: {
  shapes: readonly MakeShape[];
  removed: readonly RemovedCard[];
  // This diagram's sends, as its chips read them.
  sends: Parameters<typeof makePreview>[0]['sends'];
  source: { itemId: string; tabId: string; label: string };
  sourceTitle: string;
  onClose: () => void;
  client?: Client;
}) {
  const toast = useToast();
  const titleId = useId();
  const remembered = useMemo(() => recallSend(source.itemId), [source.itemId]);

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
  const [laneMode, setLaneMode] = useState<LaneMode | null>(null);
  const [ticked, setTicked] = useState<ReadonlySet<string>>(
    () => new Set(shapes.map((s) => s.element)),
  );
  const [trash, setTrash] = useState<ReadonlySet<string>>(() => new Set());
  const [filter, setFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const [making, setMaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    track('UI', 'Opened', 'MakePlanCards');
  }, []);

  // The person's plans, the most recent across every app first.
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

  // The plan's boards and columns, through liveplanner's own door with the person's grant.
  const planId = plan?.id ?? null;
  useEffect(() => {
    if (!planId) return;
    const abort = new AbortController();
    setTarget({ state: 'loading' });
    client
      .automationTarget(planId, { signal: abort.signal })
      .then((d) => {
        const boards = d.boards ?? [];
        setTarget({ state: 'ready', boards });
        const keep = boards.find((b) => b.id === board) ?? boards[0];
        setBoard(keep?.id ?? '');
        setColumn((was) => (keep?.columns.includes(was) ? was : (keep?.columns[0] ?? '')));
      })
      .catch(() => {
        if (!abort.signal.aborted) setTarget({ state: 'refused' });
      });
    return () => abort.abort();
    // The board kept is read once a plan; picking another board after is the person's own.
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- the board and column are read once a plan
  }, [client, planId]);

  const boards = target.state === 'ready' ? target.boards : [];
  const columns = useMemo(() => boards.find((b) => b.id === board)?.columns ?? [], [boards, board]);
  const hasLanes = useMemo(() => shapes.some((s) => s.lane), [shapes]);
  const lanes = laneMode ?? defaultLaneMode(shapes, columns);

  const preview = useMemo(
    () =>
      makePreview({
        shapes,
        ticked,
        laneMode: lanes,
        columns,
        planId,
        tabId: source.tabId,
        sends,
        removed,
      }),
    [shapes, ticked, lanes, columns, planId, source.tabId, sends, removed],
  );
  const trashing = preview.removed.filter((s) => trash.has(s.card.id)).length;
  const nothing = preview.made + preview.updated + trashing === 0;
  const ready =
    !!plan && target.state === 'ready' && !!board && !!column && !making && !nothing;

  const needle = filter.trim().toLowerCase();
  const shown = needle
    ? preview.rows.filter((r) => r.title.toLowerCase().includes(needle))
    : preview.rows;
  const allTicked = preview.rows.every((r) => r.ticked);

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

  const make = async () => {
    if (!plan || !ready) return;
    setMaking(true);
    setError(null);
    try {
      const answer = await client.makePlanCards(
        plan.id,
        makeAsk({
          shapes,
          ticked,
          removedTicked: new Set(preview.removed.filter((s) => trash.has(s.card.id)).map((s) => s.card.id)),
          laneMode: lanes,
          columns,
          board,
          column,
          source,
        }),
      );
      addSends(answer.sends);
      void refreshSends();
      rememberSend(source.itemId, {
        planId: plan.id,
        planTitle: plan.title,
        board,
        column,
        at: Date.now(),
      });
      track('UI', 'Created', 'MakePlanCards');
      const cards = answer.made + answer.updated;
      const link = answer.sends[0]?.link;
      toast.success(
        `${plural(cards, 'card')} in ${plan.title || 'the plan'}${answer.trashed ? `, ${answer.trashed} moved to the Trash` : ''}`,
        link
          ? {
              action: {
                label: 'Open Plan',
                onSelect: () => window.open(link, '_blank', 'noopener,noreferrer'),
              },
            }
          : {},
      );
      onClose();
    } catch (err) {
      track('UI', 'Refused', 'MakePlanCards');
      setMaking(false);
      setError(refusal(err));
    }
  };

  const toggle = (element: string) =>
    setTicked((was) => {
      const next = new Set(was);
      if (next.has(element)) next.delete(element);
      else next.add(element);
      return next;
    });

  const summary = [
    preview.made ? `Make ${plural(preview.made, 'card')}` : '',
    preview.updated ? `update ${preview.updated}` : '',
    preview.links ? plural(preview.links, 'Blocked By link') : '',
    trashing ? `${trashing} to the Trash` : '',
    preview.loops ? `${preview.loops} left out (a loop)` : '',
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Dialog open onClose={onClose} titleId={titleId} size="3xl" phoneSheet className="max-h-[92vh]">
      <HeroDialogHeader
        art={makePlanCardsHeroArt}
        titleId={titleId}
        title="Make Plan Cards"
        subtitle={`Turn ${plural(shapes.length, 'shape')} from ${source.label || sourceTitle || 'this tab'} into cards in a plan.`}
        onClose={onClose}
      />
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          void make();
        }}
      >
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-x-6 gap-y-5 overflow-y-auto px-4 py-4 sm:px-6 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <section className="flex min-w-0 flex-col gap-3" aria-label="Plan">
            <h3 className={LABEL}>Plan</h3>
            <SendPlanList
              plans={listed}
              query={query}
              onQuery={setQuery}
              pickedId={plan?.id ?? null}
              onPick={(p) => setPlan({ id: p.id, title: p.title })}
              newName={`Plan from ${sourceTitle || 'Untitled'}`.slice(0, 120)}
              onCreate={(name) => void makePlan(name)}
              creating={creating}
            />
            {plan ? (
              <PlaceFields
                target={target}
                board={board}
                onBoard={(id) => {
                  setBoard(id);
                  setColumn(boards.find((b) => b.id === id)?.columns[0] ?? '');
                }}
                columns={columns}
                column={column}
                onColumn={setColumn}
              />
            ) : null}
            {hasLanes ? (
              <SegmentedToggle
                label="Lanes Become"
                value={lanes}
                onChange={setLaneMode}
                options={[
                  { value: 'columns', label: 'Columns', description: "A lane lands in the board's column of its name." },
                  { value: 'labels', label: 'Labels', description: "A lane's name becomes a label on its cards." },
                  { value: 'none', label: 'Nothing', description: 'Lanes are left out.' },
                ]}
              />
            ) : null}
          </section>
          <section className="flex min-w-0 flex-col gap-3" aria-label="Cards" aria-live="polite">
            <div className="flex items-center justify-between gap-3">
              <h3 className={LABEL}>Cards</h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setTicked(allTicked ? new Set() : new Set(shapes.map((s) => s.element)))
                }
              >
                {allTicked ? 'Untick All' : 'Tick All'}
              </Button>
            </div>
            {shapes.length > 8 ? (
              <SearchInput
                value={filter}
                onChange={setFilter}
                placeholder="Search the cards"
                ariaLabel="Search the cards"
                clearAriaLabel="Clear the search"
                clearDescription="Show every card again."
              />
            ) : null}
            <CardRows
              rows={shown.slice(0, ROWS_SHOWN)}
              more={Math.max(0, shown.length - ROWS_SHOWN)}
              filtered={needle !== ''}
              onToggle={toggle}
            />
            {preview.cut ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                The first {preview.rows.length} of {shapes.length}: a make takes at most{' '}
                {preview.rows.length} shapes.
              </p>
            ) : null}
            {preview.removed.length ? (
              <fieldset className="flex flex-col gap-2" data-plan-cards-removed="">
                <legend className={`${LABEL} mb-2`}>Removed from the diagram</legend>
                <ul className="divide-y divide-slate-100 rounded-lg border border-amber-200 dark:divide-slate-800 dark:border-amber-500/30">
                  {preview.removed.map((s) => (
                    <li key={s.id}>
                      <label className="flex min-h-11 cursor-pointer items-center gap-2.5 px-3 py-2 sm:min-h-9">
                        <input
                          type="checkbox"
                          className={BOX}
                          checked={trash.has(s.card.id)}
                          onChange={() =>
                            setTrash((was) => {
                              const next = new Set(was);
                              if (next.has(s.card.id)) next.delete(s.card.id);
                              else next.add(s.card.id);
                              return next;
                            })
                          }
                        />
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-800 dark:text-slate-100">
                          {s.card.title}
                        </span>
                        <span className="shrink-0 text-xs text-amber-700 dark:text-amber-300">
                          Move to Trash
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Their shapes are gone. Tick a card to move it to the plan&apos;s Trash; the rest stay as they are.
                </p>
              </fieldset>
            ) : null}
            {error ? (
              <Callout tone="error" size="md" role="alert">
                {error}
              </Callout>
            ) : null}
          </section>
        </div>
        <DialogFooter>
          <p
            className="mr-auto hidden min-w-0 truncate text-xs text-slate-500 sm:block dark:text-slate-400"
            data-plan-cards-summary=""
          >
            {nothing ? 'Tick the shapes to make into cards.' : `${summary}.`}
          </p>
          <Button type="button" variant="secondary" onClick={onClose} className="shrink-0">
            Cancel
          </Button>
          <Button type="submit" disabled={!ready} className="shrink-0 whitespace-nowrap">
            {making
              ? 'Making Cards…'
              : preview.made === 0 && preview.updated > 0
                ? 'Update Cards'
                : 'Make Cards'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

function refusal(err: unknown): string {
  if (err instanceof IndexError) {
    if (err.code === 'rate_limited') return 'That is a lot of cards at once. Try again in a minute.';
    if (err.code === 'source_full') return 'This diagram has made as many cards as it may.';
    if (err.code === 'plan_refused') {
      const reason = err.detail?.reason;
      return typeof reason === 'string' && reason
        ? `The plan refused: ${reason}.`
        : 'That plan is full.';
    }
    if (err.status === 403 || err.status === 404) return "You can't add cards to this plan.";
  }
  return "The plan couldn't be reached just now. Try again.";
}

function PlaceFields({
  target,
  board,
  onBoard,
  columns,
  column,
  onColumn,
}: {
  target: Target;
  board: string;
  onBoard: (id: string) => void;
  columns: readonly string[];
  column: string;
  onColumn: (c: string) => void;
}) {
  const ids = { board: useId(), column: useId() };
  const label = 'text-[13px] font-medium text-slate-700 dark:text-slate-200';
  if (target.state === 'refused')
    return (
      <p className="rounded-lg border border-dashed border-amber-300 px-4 py-4 text-center text-sm text-amber-800 dark:border-amber-500/40 dark:text-amber-200">
        You can&apos;t add cards to this plan. Pick one you can edit.
      </p>
    );
  const loading = target.state !== 'ready';
  const boards = target.state === 'ready' ? target.boards : [];
  if (!loading && boards.length === 0)
    return (
      <p className="rounded-lg border border-dashed border-slate-200 px-4 py-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        This plan has no board yet. Add one in liveplanner, or pick another plan.
      </p>
    );
  return (
    <div
      className={`grid grid-cols-2 gap-3 ${loading ? 'animate-pulse motion-reduce:animate-none' : ''}`}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <label htmlFor={ids.board} className={label}>
          Board
        </label>
        <Select
          id={ids.board}
          value={board}
          disabled={loading}
          onChange={(e) => onBoard(e.target.value)}
          className="w-full"
          selectClassName="w-full"
        >
          {boards.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <label htmlFor={ids.column} className={label}>
          Column
        </label>
        <Select
          id={ids.column}
          value={column}
          disabled={loading}
          onChange={(e) => onColumn(e.target.value)}
          className="w-full"
          selectClassName="w-full"
        >
          {columns.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

function landsWords(row: MakeRow): { text: string; warn: boolean } | null {
  if (row.lands.kind === 'label') return { text: row.lands.name, warn: false };
  if (row.lands.kind === 'column')
    return row.lands.matched
      ? { text: row.lands.name, warn: false }
      : { text: `No column called ${row.lands.name}`, warn: true };
  return null;
}

function CardRows({
  rows,
  more,
  filtered,
  onToggle,
}: {
  rows: readonly MakeRow[];
  more: number;
  filtered: boolean;
  onToggle: (element: string) => void;
}) {
  if (rows.length === 0)
    return (
      <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        {filtered ? 'No card matches.' : 'Nothing here has words to make a card from.'}
      </p>
    );
  return (
    <ul
      className="max-h-[22rem] divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 md:max-h-[26rem] dark:divide-slate-800 dark:border-slate-700"
      data-plan-cards-rows=""
    >
      {rows.map((row) => {
        const lands = landsWords(row);
        const dates =
          row.start && row.due && row.start !== row.due
            ? `${dayWords(row.start)} – ${dayWords(row.due)}`
            : row.due
              ? `Due ${dayWords(row.due)}`
              : row.start
                ? `Starts ${dayWords(row.start)}`
                : '';
        return (
          <li key={row.element}>
            <label
              className={`flex min-h-11 cursor-pointer items-start gap-2.5 px-3 py-2 transition-colors hover:bg-slate-50 sm:min-h-9 dark:hover:bg-slate-800/60 ${row.ticked ? '' : 'opacity-60'}`}
            >
              <input
                type="checkbox"
                className={`${BOX} mt-0.5`}
                checked={row.ticked}
                onChange={() => onToggle(row.element)}
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm text-slate-800 dark:text-slate-100">
                  {row.title}
                </span>
                <span className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {lands ? (
                    <span className={lands.warn ? 'text-amber-700 dark:text-amber-300' : ''}>
                      {lands.text}
                    </span>
                  ) : null}
                  {dates ? <span>{dates}</span> : null}
                  {row.waits ? <span>Waits on {row.waits}</span> : null}
                </span>
              </span>
              {row.updates ? (
                <span
                  className="mt-0.5 shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/30"
                  title={`Updates ${row.updates.card.title}`}
                >
                  Updates Card
                </span>
              ) : null}
            </label>
          </li>
        );
      })}
      {more ? (
        <li className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
          {plural(more, 'more card')}: search to find one.
        </li>
      ) : null}
    </ul>
  );
}
