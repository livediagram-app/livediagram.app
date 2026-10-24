'use client';

// Home's hero: the full-width band under the host's header on Home, its page header (livediagram's and
// liveplanner's HomeHero, made app-agnostic). Status pills, the greeting by the reader's hour, the app's
// question and lead, the search field drawn large with New inside it, and the host's art on the right (a
// fan of previews, say). The pills count from what the Explorer already reads: My Work's count (one small
// request, only while the hero shows) and the Inbox the sidebar counts; a pill shows only once its count is
// known, never "0 plans" while it loads. Help and a close that hides the banner sit in its corner.

import { useEffect, useState, type ReactNode } from 'react';
import type { ItemCount } from '../data/useItemCount';
import { inboxTotal } from './inbox/sections';
import { CloseIcon, HamburgerIcon, HelpMarkIcon, PlusIcon } from '../ui/icons';
import { FOCUS_RING } from '../ui/classes';
import type { ExplorerView } from '../views';
import { heroGreeting, type Words } from '../words';
import { useExplorer } from './context';
import { SearchField } from './SearchField';
import { useFirstRun } from '../welcome/context';
import { WelcomeSearch } from '../welcome/HomeWelcome';
import { WELCOME_COPY } from '../welcome/types';

const HEADING_ID = 'explorer-home-hero';

export const HERO_COPY = {
  openNav: 'Browse sections',
  hideBanner: 'Hide Home Banner',
  help: 'Help',
} as const;

const PILL_DOT = { emerald: 'bg-emerald-500', sky: 'bg-sky-500' } as const;

const PILL =
  'inline-flex h-8 items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';

export type HeroPill = {
  id: 'items' | 'inbox';
  label: string;
  tone: keyof typeof PILL_DOT;
  view: ExplorerView;
};

/** The status pills, each only once its count is known: never "0 plans" while the list loads, nor a clear
 *  Inbox that was never read. */
export function heroPills(
  input: { items: ItemCount | undefined; inbox: number | undefined },
  words: Words,
): HeroPill[] {
  const pills: HeroPill[] = [];
  if (input.items) {
    const { count, more } = input.items;
    pills.push({
      id: 'items',
      label: more
        ? `${count}+ ${words.lowerMany}`
        : `${count} ${count === 1 ? words.lowerOne : words.lowerMany}`,
      tone: 'emerald',
      view: { kind: 'all' },
    });
  }
  if (input.inbox !== undefined) {
    pills.push({
      id: 'inbox',
      label: input.inbox === 0 ? 'Inbox is clear' : `${input.inbox} open in your Inbox`,
      tone: 'sky',
      view: { kind: 'inbox' },
    });
  }
  return pills;
}

/** The hour now, read after mount (so the server's render and the first client one agree) and again on
 *  the hour, so a page left open from morning to afternoon greets the afternoon. */
function useHour(): number | null {
  const [hour, setHour] = useState<number | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const now = new Date();
      setHour(now.getHours());
      const next = new Date(now);
      next.setHours(now.getHours() + 1, 0, 0, 0);
      timer = setTimeout(tick, next.getTime() - now.getTime() + 50);
    };
    tick();
    return () => clearTimeout(timer);
  }, []);
  return hour;
}

/** The Explorer makes the band inert while it folds away, so the page holds one live field. */
export function HomeHero({
  items,
  art,
  onHide,
}: {
  items: ItemCount | undefined;
  /** The host's picture for the right-hand side, from `lg` up. */
  art?: ReactNode;
  /** Hides the banner for good (the host's setting, or this browser's). */
  onHide?: () => void;
}) {
  const { kind, inbox, viewerId, viewHref, navigate, onCreate, openNav, heroWords } = useExplorer();
  const hour = useHour();
  const { heroFirstRun, welcome } = useFirstRun();
  // A first run greets rather than asks what the person is doing today, and searches templates, not their work.
  const firstRun = heroFirstRun && welcome ? welcome : null;
  const pills: { id: string; label: string; tone: keyof typeof PILL_DOT; view?: ExplorerView }[] =
    firstRun
      ? [
          { id: 'free', label: firstRun.manifest?.pillFree ?? '', tone: 'emerald' as const },
          {
            id: 'account',
            label: firstRun.signedIn ? WELCOME_COPY.pillSignedIn : WELCOME_COPY.pillGuest,
            tone: 'sky' as const,
          },
        ].filter((p) => p.label)
      : heroPills({ items, inbox: inboxTotal(inbox.data, viewerId) }, kind);
  const greeting = firstRun
    ? `Welcome to ${firstRun.manifest?.name ?? ''}.`
    : hour === null
      ? ''
      : heroGreeting(hour);
  const question = firstRun ? WELCOME_COPY.question : heroWords.question;
  const lead = firstRun ? WELCOME_COPY.lead : heroWords.lead;

  const newItem = (
    <button
      type="button"
      aria-label={`New ${kind.one}`}
      onClick={() => onCreate({ folderId: null, teamId: null })}
      className={`flex h-11 shrink-0 items-center gap-2 rounded-xl bg-brand-700 px-[18px] text-[15px] font-semibold text-white transition hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-700 ${FOCUS_RING}`}
    >
      <PlusIcon size={14} />
      {/* The label folds to the plus on a phone; the button keeps its name. */}
      <span className="hidden sm:inline">New {kind.one}</span>
    </button>
  );

  return (
    <section
      aria-labelledby={HEADING_ID}
      data-home-hero=""
      className="relative overflow-hidden border-b border-slate-200 bg-brand-50/70 bg-[radial-gradient(var(--color-brand-200)_1px,transparent_1px)] bg-[length:22px_22px] dark:border-slate-800 dark:bg-slate-900 dark:bg-[radial-gradient(color-mix(in_oklab,var(--color-brand-800)_45%,var(--color-slate-900))_1px,transparent_1px)]"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-260px] hidden h-[520px] w-[900px] -translate-x-1/3 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--color-brand-600)_30%,transparent),transparent)] dark:block"
      />
      <div className="relative mx-auto flex w-full max-w-7xl flex-wrap items-center gap-10 px-4 pb-12 pt-6 sm:px-6 lg:pb-14">
        <div className="flex min-w-0 flex-[999_1_32rem] flex-col gap-5">
          {/* A phone: the menu button and the corner share their own row, so the pills never push Help onto
              a line of its own. */}
          <div className="-mb-2 flex items-center justify-between sm:hidden">
            <button
              type="button"
              onClick={openNav}
              aria-label={HERO_COPY.openNav}
              className={`-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-600 transition hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white ${FOCUS_RING}`}
            >
              <HamburgerIcon />
            </button>
            <HeroCorner onHide={onHide} />
          </div>
          {/* Holds a pill's height before the counts arrive, so nothing under it moves when they do. */}
          <div className="flex min-h-8 flex-wrap items-center gap-2">
            {pills.map((pill) =>
              !pill.view ? (
                <span key={pill.id} data-hero-pill={pill.id} className={PILL}>
                  <span aria-hidden className={`size-[7px] rounded-full ${PILL_DOT[pill.tone]}`} />
                  <span>{pill.label}</span>
                </span>
              ) : (
                <a
                  key={pill.id}
                  href={viewHref(pill.view)}
                  data-hero-pill={pill.id}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                    e.preventDefault();
                    navigate(pill.view!);
                  }}
                  className={`${PILL} transition hover:border-slate-300 dark:hover:border-slate-600 ${FOCUS_RING}`}
                >
                  <span aria-hidden className={`size-[7px] rounded-full ${PILL_DOT[pill.tone]}`} />
                  <span>{pill.label}</span>
                </a>
              ),
            )}
            {/* Help and the close end the pills' row from `sm` to `lg`; from `lg` they stand at the hero's
                top right, over the art; on a phone they sit beside the menu button above. */}
            <span className="ml-auto hidden sm:inline-flex lg:hidden">
              <HeroCorner onHide={onHide} />
            </span>
          </div>
          <h1
            id={HEADING_ID}
            // Two lines held, so the band's height never moves as the greeting lands after mount. Whole-pixel
            // line heights, so everything under the hero lands on whole pixels.
            className="min-h-[2lh] max-w-3xl text-4xl leading-[37px] font-extrabold tracking-[-0.04em] text-[#17153a] sm:text-5xl sm:leading-[49px] lg:text-[3.5rem] lg:leading-[57px] dark:text-white"
          >
            {greeting ? `${greeting} ${question}` : null}
          </h1>
          <p className="min-h-[2lh] max-w-2xl text-[17px] leading-[28px] text-slate-600 dark:text-slate-300">
            {lead}
          </p>
          <div className="max-w-2xl">
            {firstRun ? <WelcomeSearch /> : <SearchField size="hero" trailing={newItem} />}
          </div>
        </div>
        <div className="absolute right-4 top-6 z-20 hidden sm:right-6 lg:block">
          <HeroCorner onHide={onHide} />
        </div>
        {art ? (
          // Set down below the corner's Help and close (top-6, 30px tall), so the sheets never sit under them.
          <div className="relative mt-14 hidden h-72 min-w-[18rem] flex-[1_1_22rem] lg:block">
            {art}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** The hero's corner: Home's Help, then the close that hides the banner. Drawn wherever the hero puts its
 *  Help (a phone's row, the pills' row, the wide top right), so the two never part. */
function HeroCorner({ onHide }: { onHide?: () => void }) {
  const { helpHref } = useExplorer();
  const help = helpHref?.({ kind: 'home' });
  if (!help && !onHide) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      {help ? <HelpButton href={help} /> : null}
      {onHide ? (
        <button
          type="button"
          onClick={onHide}
          aria-label={HERO_COPY.hideBanner}
          title={HERO_COPY.hideBanner}
          data-home-banner-close=""
          className={`relative flex size-[30px] shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white ${FOCUS_RING}`}
        >
          <CloseIcon size={14} />
        </button>
      ) : null}
    </span>
  );
}

/** livediagram's Help button: a neutral bordered button with the help glyph, opening the article in a new
 *  tab. */
export function HelpButton({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white ${FOCUS_RING}`}
    >
      <HelpMarkIcon />
      <span>{HERO_COPY.help}</span>
    </a>
  );
}
