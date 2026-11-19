'use client';

// A public roadmap's page (docs/specs/026-plan/public-roadmap.md "What a visitor sees"): the board tab's look, the
// title, Suggest an Idea, and the chosen columns side by side (stacked on a phone). Loading, not available, error and
// the roadmap are its four states. A vote shows at once and settles on the api's answer; a refused one goes back and
// says why. Nothing of the editor is here: no sign-in, no plan, no Explorer.
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import type { PublicRoadmap } from '@liveplanner/api-schema';
import { lucideGlyph } from '@liveplanner/ui';
import { lucideLightbulb } from '@liveworkspace/icons/lucide';
import { useBrowserTabTitle } from '@liveworkspace/workbench/hooks/editor/useBrowserTabTitle';
import { formLookProps } from '@/components/forms/form-look';
import { MadeWithLiveplanner } from '@/components/forms/respond/MadeWithLiveplanner';
import { loadPublicRoadmap, sendRoadmapVote, type VoteResult } from '@/lib/api/roadmaps-public';
import { publicBrowserId } from '@/lib/public-browser-id';
import { roadmapFromPath } from '@/lib/roadmap-path';
import { RoadmapColumn } from './RoadmapColumn';
import { Callout } from '@liveworkspace/ui/callout';

// The tab's canvas style behind the page, fetched only for a tab that has one (as a form's page does).
const FormCanvasLayer = dynamic(
  () => import('@/components/forms/respond/FormCanvasLayer').then((m) => m.FormCanvasLayer),
  { ssr: false },
);

const LightbulbIcon = lucideGlyph(lucideLightbulb, 16);

type PageState =
  | { kind: 'loading' }
  | { kind: 'not_found' }
  | { kind: 'error' }
  // Read too often from this network: read again once the limit's window is over.
  | { kind: 'busy'; retryAfterMs: number }
  | { kind: 'ready'; planId: string; code: string; data: PublicRoadmap };

// What the page says when a vote is refused.
const VOTE_MESSAGES: Record<Exclude<VoteResult['kind'], 'ok'>, string> = {
  gone: 'That idea isn’t on the roadmap any more.',
  full: 'This idea has all the votes it can take.',
  busy: 'Voting is busy. Try again in a few minutes.',
  failed: 'We couldn’t save your vote. Check your connection and try again.',
};

// The roadmap with one card's vote set.
function withVote(data: PublicRoadmap, cardId: string, votes: number, voted: boolean) {
  return {
    ...data,
    columns: data.columns.map((col) => ({
      ...col,
      cards: col.cards.map((c) => (c.id === cardId ? { ...c, votes, voted } : c)),
    })),
  };
}

export function RoadmapPage() {
  const [page, setPage] = useState<PageState>({ kind: 'loading' });
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const browser = useRef<string>('');

  const load = useCallback(() => {
    const at = roadmapFromPath(window.location.pathname);
    if (at) browser.current ||= publicBrowserId();
    // Every state lands after an await, an address that cannot be a roadmap's included.
    void (
      at
        ? loadPublicRoadmap(at.planId, at.code, browser.current)
        : Promise.resolve({ kind: 'not_found' as const })
    ).then((r) =>
      setPage(
        r.kind === 'ok' && at
          ? { kind: 'ready', ...at, data: r.data }
          : r.kind === 'ok'
            ? { kind: 'not_found' }
            : r,
      ),
    );
  }, []);
  useEffect(load, [load]);
  const retry = () => {
    setPage({ kind: 'loading' });
    load();
  };
  // Busy: a read of its own once the limit's window is over (and again after each busy answer, one a window, so it
  // never adds to the limit); Try Again reads at once.
  const busy = page.kind === 'busy' ? page : null;
  useEffect(() => {
    if (!busy) return;
    const timer = window.setTimeout(load, busy.retryAfterMs);
    return () => window.clearTimeout(timer);
  }, [busy, load]);

  async function vote(cardId: string, up: boolean) {
    if (page.kind !== 'ready') return;
    const card = page.data.columns.flatMap((c) => c.cards).find((c) => c.id === cardId);
    if (!card) return;
    const before = { votes: card.votes ?? 0, voted: card.voted === true };
    setNotice(null);
    setPending((p) => new Set(p).add(cardId));
    // Shown at once; the api's answer settles it.
    setPage((p) =>
      p.kind === 'ready'
        ? { ...p, data: withVote(p.data, cardId, Math.max(0, before.votes + (up ? 1 : -1)), up) }
        : p,
    );
    const r = await sendRoadmapVote(page.planId, page.code, {
      card: cardId,
      browser: browser.current,
      up,
    });
    setPending((p) => {
      const next = new Set(p);
      next.delete(cardId);
      return next;
    });
    if (r.kind === 'ok') {
      setPage((p) =>
        p.kind === 'ready' ? { ...p, data: withVote(p.data, cardId, r.votes, r.voted) } : p,
      );
      return;
    }
    setNotice(VOTE_MESSAGES[r.kind]);
    if (r.kind === 'gone') {
      load();
      return;
    }
    setPage((p) =>
      p.kind === 'ready' ? { ...p, data: withVote(p.data, cardId, before.votes, before.voted) } : p,
    );
  }

  useBrowserTabTitle(page.kind === 'ready' ? `${page.data.title} | liveplanner` : null);

  // The board tab's look (its theme, finish and font) dresses the whole page, the backdrop included.
  const look = page.kind === 'ready' ? formLookProps(page.data.look) : null;
  return (
    <main
      {...look}
      style={
        look && page.kind === 'ready'
          ? ({
              ...look.style,
              '--bd-light': page.data.look.backdrop.light,
              '--bd-dark': page.data.look.backdrop.dark,
            } as CSSProperties)
          : undefined
      }
      className={`min-h-dvh pb-16 pt-6 sm:pt-10 ${
        look ? 'bg-[var(--bd-light)] dark:bg-[var(--bd-dark)]' : 'bg-slate-50 dark:bg-slate-950'
      }`}
      data-roadmap-state={page.kind}
    >
      {page.kind === 'ready' && page.data.look.canvas ? (
        <FormCanvasLayer canvas={page.data.look.canvas} />
      ) : null}
      <div className="relative">
        {page.kind === 'loading' ? <Skeleton /> : null}
        {page.kind === 'not_found' ? (
          <Notice
            title="This roadmap isn’t available"
            body="It may have been unpublished, or the link may be wrong."
          />
        ) : null}
        {page.kind === 'error' ? (
          <Notice
            title="We couldn’t load this roadmap"
            body="Check your connection and try again."
            action={{ label: 'Try Again', run: retry }}
          />
        ) : null}
        {page.kind === 'busy' ? (
          <Notice
            title="This roadmap is busy"
            body={`Lots of people are looking right now. It tries again in ${waitPhrase(page.retryAfterMs)}.`}
            action={{ label: 'Try Again', run: retry }}
          />
        ) : null}
        {page.kind === 'ready' ? (
          // The header and the columns share one width, centred, so the title lines up with the first column
          // and Suggest an Idea with the last.
          <div className="mx-auto w-fit max-w-full">
            <header className="flex w-full flex-col gap-4 px-4 sm:flex-row sm:items-end sm:justify-between sm:gap-8 sm:px-6">
              <div className="min-w-0">
                <h1 className="text-[28px] font-semibold tracking-tight text-slate-900 [overflow-wrap:anywhere] sm:text-[32px] dark:text-slate-50">
                  {page.data.title}
                </h1>
                {page.data.voting ? (
                  <p className="mt-1 text-[15px] text-slate-600 dark:text-slate-300">
                    Vote for the ideas you want most.
                  </p>
                ) : null}
              </div>
              {page.data.suggestPath ? (
                <a
                  href={page.data.suggestPath}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex h-10 shrink-0 items-center gap-2 self-start rounded-lg bg-[var(--form-accent)] px-4 text-[14px] font-semibold text-[var(--form-on-accent)] shadow-sm transition-[filter] hover:brightness-110 sm:self-auto"
                >
                  <LightbulbIcon />
                  Suggest an Idea
                </a>
              ) : null}
            </header>
            <div role="status" aria-live="polite" className="px-4 sm:px-6">
              {notice ? (
                <Callout tone="warning" size="md" className="mt-4 w-fit">
                  {notice}
                </Callout>
              ) : null}
            </div>
            {/* Side by side from a small screen up, scrolling sideways when they outgrow it; stacked on a phone. */}
            <div className="mt-6 overflow-x-auto pb-2 pt-px">
              <div className="flex flex-col gap-4 px-4 sm:w-max sm:flex-row sm:items-start sm:px-6">
                {page.data.columns.map((column, i) => (
                  <RoadmapColumn
                    key={`${i}-${column.name}`}
                    column={column}
                    voting={page.data.voting}
                    pending={pending}
                    onVote={(id, up) => void vote(id, up)}
                  />
                ))}
              </div>
            </div>
            <footer className="mt-10 flex justify-center">
              <MadeWithLiveplanner />
            </footer>
          </div>
        ) : null}
      </div>
    </main>
  );
}

// How long the busy page waits, in words: "a minute" for the limiter's own window.
export function waitPhrase(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} seconds`;
  if (s < 120) return 'a minute';
  return `${Math.round(s / 60)} minutes`;
}

function Skeleton() {
  return (
    <div
      role="status"
      aria-busy
      aria-label="Loading the roadmap"
      className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 sm:px-6"
    >
      <div className="h-9 w-64 max-w-full animate-pulse rounded-lg bg-white/70 motion-reduce:animate-none dark:bg-slate-900/70" />
      <div className="mt-4 flex flex-col gap-4 sm:flex-row">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-72 animate-pulse rounded-2xl bg-white/70 motion-reduce:animate-none sm:w-[320px] dark:bg-slate-900/70"
          />
        ))}
      </div>
    </div>
  );
}

function Notice({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { label: string; run: () => void };
}) {
  return (
    <div className="mx-auto max-w-[640px] px-4">
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm dark:border-slate-700/80 dark:bg-slate-900">
        <h1 className="text-[22px] font-semibold text-slate-900 dark:text-slate-50">{title}</h1>
        <p className="mt-2 text-[15px] text-slate-600 dark:text-slate-300">{body}</p>
        {action ? (
          <button
            type="button"
            onClick={action.run}
            className="mt-5 h-10 cursor-pointer rounded-lg bg-brand-700 px-5 text-[14px] font-semibold text-white hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-700"
          >
            {action.label}
          </button>
        ) : null}
        <p className="mt-8">
          <MadeWithLiveplanner />
        </p>
      </div>
    </div>
  );
}
