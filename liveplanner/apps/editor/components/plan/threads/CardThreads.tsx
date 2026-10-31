'use client';

// A card's comment threads in the card panel (docs/specs/026-plan/items.md "Where it shows"): one Comments field's
// (the built-in `comments`, or the type's own, item-types.md "Comments and Votes fields"), last in the Overview tab,
// listing only the threads that field holds, its New Thread starting one in it. A quiet tally and New Thread over the list; no threads, a soft empty state; the starter at
// the top when New Thread is pressed; open threads most recently active first, every one closed when the card opens
// (a thread just started, or one a link names, opens); resolved threads under a Resolved disclosure at the bottom.
// Drawn for about five threads, and for many more. Only threads: the card's history is its own Activity section below
// (CardActivity.tsx, items.md "History").

import { useEffect, useMemo, useRef, useState } from 'react';
import { CommentIcon, CompactEmptyState, lucideGlyph } from '@liveplanner/ui';
import { lucideChevronDown, lucidePlus } from '@liveworkspace/icons/lucide';
import {
  COMMENTS_FIELD,
  itemTitle,
  threadsInField,
  type Item,
  type ItemTypeDef,
} from '@liveplanner/items';
import type { CardThread, CommentMention } from '@liveplanner/project';
import { usePlan } from '../PlanContext';
import { AddThreadToCardDialog } from './AddThreadToCardDialog';
import { useCardThreadsContext } from './CardThreadsContext';
import { ThreadStarter } from './ThreadStarter';
import { ThreadTile } from './ThreadTile';
import { ANNOUNCE, threadTally } from './thread-words';

const PlusIcon = lucideGlyph(lucidePlus, 13);
const Chevron = lucideGlyph(lucideChevronDown, 13);

type CardThreadsProps = {
  item: Item;
  // The card's type and the Comments field drawn: every thread on the card when not given.
  type?: ItemTypeDef;
  field?: string;
};

// Keyed by the card, so opening another card (or this one again) starts with every thread closed.
export function CardThreads(props: CardThreadsProps) {
  return <CardThreadsOf key={props.item.id} {...props} />;
}

function CardThreadsOf({ item, type, field = COMMENTS_FIELD }: CardThreadsProps) {
  const ctx = useCardThreadsContext();
  const plan = usePlan();
  const threads = useMemo(() => {
    const all = ctx?.threads.threadsOf(item.id) ?? [];
    return type ? threadsInField(all, type, field) : all;
  }, [ctx?.threads, item.id, type, field]);
  const open = threads.filter((t) => !t.resolved);
  const resolved = threads.filter((t) => t.resolved);
  const [starting, setStarting] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [adding, setAdding] = useState<CardThread | null>(null);
  // Which threads are open: none when the card opens; one opens when its header is pressed, a link names it or it
  // has just been started here. Kept only while the panel stays on this card.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const tiles = useRef(new Map<string, HTMLElement>());

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
      .act({
        kind: 'start',
        itemId: item.id,
        text,
        ...(mentions.length ? { mentions } : {}),
        ...(field !== COMMENTS_FIELD ? { field } : {}),
      })
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

  return (
    <div data-card-threads="" className="flex flex-col gap-2">
      {threads.length > 0 || starting ? (
        <div className="flex min-h-7 items-center justify-between gap-2">
          <span className="text-[12px] text-slate-500 dark:text-slate-400">{tally}</span>
          {canComment && !starting ? newThread : null}
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
      {open.length > 0 ? (
        <ul aria-label="Open threads" className="flex flex-col gap-2">
          {open.map(tile)}
        </ul>
      ) : null}
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
