'use client';

// A card's comment threads in the card panel (docs/specs/026-plan/items.md "Where it shows"): the `comments` field,
// last in the Overview tab. A quiet tally and New Thread over the list; no threads, a soft empty state; the starter at
// the top when New Thread is pressed; open threads most recently active first, every one closed when the card opens
// (a thread just started, or one a link names, opens); resolved threads under a Resolved disclosure at the bottom.
// Drawn for about five threads, and for many more. With the header's Activity switch on, the card's history
// (CardActivity.tsx, items.md "History") is interleaved with the open threads by time.

import { useEffect, useMemo, useRef, useState } from 'react';
import { CommentIcon, CompactEmptyState, lucideGlyph } from '@liveplanner/ui';
import { lucideChevronDown, lucidePlus } from '@liveworkspace/icons/lucide';
import { itemTitle, typeIn, type Item } from '@liveplanner/items';
import type { CardThread, CommentMention } from '@liveplanner/project';
import { usePlan } from '../PlanContext';
import { AddThreadToCardDialog } from './AddThreadToCardDialog';
import { useCardThreadsContext } from './CardThreadsContext';
import { ThreadStarter } from './ThreadStarter';
import { ThreadTile } from './ThreadTile';
import { ANNOUNCE, threadTally } from './thread-words';
import { useCardHistory } from '@/hooks/plan/useCardHistory';
import {
  ACTIVITY_ROWS_SHOWN,
  ActivityNote,
  ActivityRow,
  ActivitySwitch,
  ShowMoreActivity,
  activityFeed,
  useActivityOn,
} from './CardActivity';
import type { ActivityContext } from './activity-words';

const PlusIcon = lucideGlyph(lucidePlus, 13);
const Chevron = lucideGlyph(lucideChevronDown, 13);

// Keyed by the card, so opening another card (or this one again) starts with every thread closed.
export function CardThreads({ item }: { item: Item }) {
  return <CardThreadsOf key={item.id} item={item} />;
}

function CardThreadsOf({ item }: { item: Item }) {
  const ctx = useCardThreadsContext();
  const plan = usePlan();
  const threads = useMemo(() => ctx?.threads.threadsOf(item.id) ?? [], [ctx?.threads, item.id]);
  const open = threads.filter((t) => !t.resolved);
  const resolved = threads.filter((t) => t.resolved);
  const [starting, setStarting] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [adding, setAdding] = useState<CardThread | null>(null);
  // Which threads are open: none when the card opens; one opens when its header is pressed, a link names it or it
  // has just been started here. Kept only while the panel stays on this card.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const tiles = useRef(new Map<string, HTMLElement>());
  // The card's activity: its history, read while the switch is on, the first rows shown until Show N More.
  const [activityOn, setActivityOn] = useActivityOn();
  const [allActivity, setAllActivity] = useState(false);
  const history = useCardHistory({
    scope: ctx?.threads.scope ?? null,
    itemId: item.id,
    rev: item.rev,
    enabled: activityOn,
  });
  const activityCtx = useMemo<ActivityContext>(
    () => ({
      statusNames: plan?.statusNames ?? new Map(),
      types: plan?.types ?? [],
      type: plan ? typeIn(plan.types, item.type) : undefined,
      items: plan?.items ?? new Map(),
    }),
    [plan, item.type],
  );

  // A link to one of this card's threads (#item=…&thread=…): open it (the Resolved list too), bring it into view.
  const focused = ctx?.threads.focused ?? null;
  const focusedThread = focused ? threads.find((t) => t.id === focused) : undefined;
  useEffect(() => {
    if (!focusedThread || !ctx) return;
    // A one-shot request from outside the panel (the link), taken once and let go: keeping the thread open past it
    // is this panel's own state.
    // oxlint-disable-next-line react/set-state-in-effect
    setExpanded((prev) => new Set([...prev, focusedThread.id]));
    if (focusedThread.resolved) setShowResolved(true);
    const id = focusedThread.id;
    const frame = requestAnimationFrame(() =>
      tiles.current.get(id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
    );
    ctx.threads.focus(null);
    return () => cancelAnimationFrame(frame);
  }, [focusedThread, ctx]);

  if (!ctx) return null;
  const { canComment } = ctx;
  const titleOf = (itemId: string) => {
    const it = plan?.items.get(itemId);
    return it ? itemTitle(it) || 'Untitled' : null;
  };
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const tile = (t: CardThread) => (
    <ThreadTile
      key={t.id}
      thread={t}
      itemId={item.id}
      expanded={expanded.has(t.id)}
      onToggle={() => toggle(t.id)}
      ctx={ctx}
      titleOf={titleOf}
      onAddToCard={setAdding}
      tileRef={(el) => {
        if (el) tiles.current.set(t.id, el);
        else tiles.current.delete(t.id);
      }}
    />
  );
  const start = (text: string, mentions: CommentMention[]) => {
    setStarting(false);
    void ctx.threads
      .act({ kind: 'start', itemId: item.id, text, ...(mentions.length ? { mentions } : {}) })
      .then((made) => {
        if (!made) return;
        setExpanded((prev) => new Set([...prev, made.id]));
        ctx.announce(ANNOUNCE.started);
      });
  };
  const newThread = (
    <button
      type="button"
      onClick={() => setStarting(true)}
      className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-brand-700 transition hover:bg-brand-50 motion-reduce:transition-none pointer-coarse:py-2 dark:text-brand-300 dark:hover:bg-brand-500/10"
    >
      <PlusIcon aria-hidden />
      New Thread
    </button>
  );
  const tally = threadTally(open.length, resolved.length);
  const entries = activityOn ? history.entries : [];
  const feed = activityFeed(open, entries, allActivity ? entries.length : ACTIVITY_ROWS_SHOWN);
  const activitySwitch = ctx.threads.scope ? (
    <ActivitySwitch on={activityOn} onChange={setActivityOn} />
  ) : null;

  return (
    <div data-card-threads="" className="flex flex-col gap-2">
      {threads.length > 0 || starting || activitySwitch ? (
        <div className="flex min-h-7 items-center justify-between gap-2">
          <span className="text-[12px] text-slate-500 dark:text-slate-400">
            {threads.length > 0 || starting ? tally : null}
          </span>
          <span className="flex items-center gap-1">
            {activitySwitch}
            {canComment && !starting && threads.length > 0 ? newThread : null}
          </span>
        </div>
      ) : null}
      {starting ? (
        <ThreadStarter self={ctx.self} onStart={start} onCancel={() => setStarting(false)} />
      ) : null}
      {threads.length === 0 && !starting ? (
        <CompactEmptyState
          size="small"
          icon={<CommentIcon />}
          title={canComment ? 'No threads yet' : 'No comments yet'}
          description={
            canComment
              ? 'Start a thread to discuss this card.'
              : 'No one has started a thread on this card.'
          }
          action={canComment ? newThread : undefined}
          className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700"
        />
      ) : null}
      {feed.rows.length > 0 ? (
        <ul
          aria-label={entries.length > 0 ? 'Open threads and activity' : 'Open threads'}
          className="flex flex-col gap-2"
        >
          {feed.rows.map((row) =>
            row.kind === 'thread' ? (
              tile(row.thread)
            ) : (
              <ActivityRow key={`a-${row.index}`} entry={row.entry} ctx={activityCtx} />
            ),
          )}
        </ul>
      ) : null}
      {feed.hidden > 0 ? (
        <ShowMoreActivity hidden={feed.hidden} onShow={() => setAllActivity(true)} />
      ) : null}
      {activityOn ? <ActivityNote history={history} /> : null}
      {resolved.length > 0 ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            aria-expanded={showResolved}
            onClick={() => setShowResolved((v) => !v)}
            className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-[12px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 motion-reduce:transition-none pointer-coarse:py-2 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <span
              aria-hidden
              className={`transition-transform motion-reduce:transition-none ${showResolved ? '' : '-rotate-90'}`}
            >
              <Chevron />
            </span>
            Resolved · {resolved.length}
          </button>
          {showResolved ? (
            <ul aria-label="Resolved threads" className="flex flex-col gap-2">
              {resolved.map(tile)}
            </ul>
          ) : null}
        </div>
      ) : null}
      {adding ? (
        <AddThreadToCardDialog
          thread={ctx.threads.threads.get(adding.id) ?? adding}
          ctx={ctx}
          onClose={() => setAdding(null)}
        />
      ) : null}
    </div>
  );
}
