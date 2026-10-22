'use client';

// Home's hero (docs/specs/013-workspace/explorer-home.md "The hero"; blueprint
// docs/specs/013-workspace/blueprints/explorer-home-view.md "Presentation and UX"): the full-width band under the
// Explorer header on Home, its page header. Status pills, the greeting, the lead, the lens field drawn large with
// New Project inside it, and the fanned previews of a Board, a Sheet, a Dashboard and a Form. Reads only what the
// shell already holds; the previews are static art, the same for everyone.

import { lazy, Suspense } from 'react';
import { PlusIcon } from '@/components/primitives/explorer-icons';
import { HeroCorner } from './HeroCorner';
import { track } from '@/lib/telemetry';
import { useNow } from '@/hooks/ui/useNow';
import { useExplorer } from '@/app/explorer/ExplorerContext';
import { HamburgerIcon } from '@/app/explorer/PaneHeader';
import { LensField, LensFieldStill } from '@/app/explorer/lens/LensField';
import { inboxBadge } from '@/app/explorer/sidebar/inbox-badge';
import { explorerPathFor } from '@/app/explorer/routes';
import { HERO_COPY, heroGreeting, heroPills } from '@/app/explorer/home/hero-model';
import { WELCOME_COPY } from '@/app/explorer/home/first-run';
import { useFirstRun } from '@/app/explorer/home/useFirstRun';
import { WelcomeSearch } from './WelcomeSearch';
import { InAppLink } from './HomeSection';
import { FOCUS_RING } from './home-styles';
import { assignAppLocation } from '@/lib/app-location';

const HEADING_ID = 'home-hero-greeting';

const PILL_DOT = { emerald: 'bg-emerald-500', sky: 'bg-sky-500' } as const;

const PILL =
  'inline-flex h-8 items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';

// The fanned previews' art is its own chunk, fetched once Home draws its hero, so the Explorer's first paint never
// waits on it (the box holds its size, so nothing moves when it lands). React.lazy rather than next/dynamic:
// next/dynamic registers its module for preloading, which would fetch the art on every Explorer page.
const HeroFeatureFan = lazy(() =>
  import('./HeroFeatureFan').then((m) => ({ default: m.HeroFeatureFan })),
);

/** `active` while Home is the page; a hero folding away draws its field still, so the page holds one live field. */
export function HomeHero({ active = true }: { active?: boolean }) {
  const { projects, loading, failedReads, activity, go, setMobileNavOpen, lens, lensResult } =
    useExplorer();
  const pills = heroPills({
    // A list that failed to load has no count to tell.
    projects: loading || failedReads.projects ? undefined : projects.length,
    inbox: inboxBadge(activity),
  });
  const { heroFirstRun: firstRun, signedIn } = useFirstRun();
  const now = useNow(false);
  const greeting = heroGreeting(new Date(now).getHours());

  const newProject = (
    <button
      type="button"
      aria-label={HERO_COPY.newProject}
      onClick={() => {
        track('Home', 'Selected', 'Hero.NewProject');
        assignAppLocation('/new');
      }}
      className={`optical-edges flex h-11 shrink-0 items-center gap-2 rounded-xl bg-brand-700 px-[18px] text-[15px] font-semibold text-white transition hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-700 ${FOCUS_RING}`}
    >
      <PlusIcon />
      {/* The label folds to the plus on a phone; the button keeps its name. */}
      <span className="hidden sm:text-optical-line">{HERO_COPY.newProject}</span>
    </button>
  );

  return (
    <section
      aria-labelledby={HEADING_ID}
      data-home-hero=""
      className="relative overflow-hidden border-b border-slate-200 bg-sky-50/70 bg-[radial-gradient(#cfe0f1_1px,transparent_1px)] bg-[length:22px_22px] dark:border-slate-800 dark:bg-slate-900 dark:bg-[radial-gradient(#1c2752_1px,transparent_1px)]"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-260px] hidden h-[520px] w-[900px] -translate-x-1/3 rounded-full bg-[radial-gradient(closest-side,rgba(37,99,235,0.30),transparent)] dark:block"
      />
      <div className="relative mx-auto flex w-full max-w-7xl flex-wrap items-center gap-10 px-4 pb-12 pt-6 sm:px-6 lg:pb-14">
        <div className="flex min-w-0 flex-[999_1_32rem] flex-col gap-5">
          {/* A phone: the menu button and Help share their own row, so the pills never push Help onto a line
              of its own. */}
          <div className="-mb-2 flex items-center justify-between sm:hidden">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label={HERO_COPY.openNav}
              className={`-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-600 transition hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white ${FOCUS_RING}`}
            >
              <HamburgerIcon />
            </button>
            <HeroCorner />
          </div>
          {/* Holds a pill's height before the counts arrive, so nothing under it moves when they do. */}
          <div className="flex min-h-8 flex-wrap items-center gap-2">
            {firstRun ? (
              // What is true of every start; nothing to follow, so not links.
              <>
                <span className={PILL}>
                  <span aria-hidden className={`size-[7px] rounded-full ${PILL_DOT.emerald}`} />
                  <span className="text-optical-centre">{WELCOME_COPY.pillFree}</span>
                </span>
                <span className={PILL}>
                  <span aria-hidden className={`size-[7px] rounded-full ${PILL_DOT.sky}`} />
                  <span className="text-optical-centre">
                    {signedIn ? WELCOME_COPY.pillSignedIn : WELCOME_COPY.pillGuest}
                  </span>
                </span>
              </>
            ) : null}
            {(firstRun ? [] : pills).map((pill) => {
              const view =
                pill.id === 'projects' ? ({ kind: 'all' } as const) : ({ kind: 'inbox' } as const);
              return (
                <InAppLink
                  key={pill.id}
                  href={explorerPathFor(view)}
                  onNavigate={() => go(view)}
                  onActivate={() =>
                    track(
                      'Home',
                      'Selected',
                      pill.id === 'projects' ? 'Hero.Projects' : 'Hero.Inbox',
                    )
                  }
                  className={`${PILL} transition hover:border-slate-300 dark:hover:border-slate-600 ${FOCUS_RING}`}
                >
                  <span aria-hidden className={`size-[7px] rounded-full ${PILL_DOT[pill.tone]}`} />
                  <span className="text-optical-centre">{pill.label}</span>
                </InAppLink>
              );
            })}
            {/* Help and the banner's close end the pills' row from `sm` to `lg`; from `lg` they stand at the hero's
                top right, over the previews; on a phone they sit beside the menu button above. */}
            <span className="ml-auto hidden sm:inline-flex lg:hidden">
              <HeroCorner />
            </span>
          </div>
          <h1
            id={HEADING_ID}
            // Two lines held whichever greeting it is, so the first run's and the ordinary one swap without a shift.
            // Whole-pixel line heights (about 1.02 of each size), so the hero's height, and everything under it, lands
            // on whole pixels whatever the font: the sidebar's tiles fail the optical audit on a fraction.
            className="min-h-[2lh] max-w-3xl text-4xl leading-[37px] font-extrabold tracking-[-0.04em] text-[#17153a] sm:text-5xl sm:leading-[49px] lg:text-[3.5rem] lg:leading-[57px] dark:text-white"
          >
            {firstRun
              ? `${WELCOME_COPY.greeting} ${WELCOME_COPY.question}`
              : `${greeting} ${HERO_COPY.question}`}
          </h1>
          <p className="min-h-[2lh] max-w-2xl text-[17px] leading-[28px] text-slate-600 dark:text-slate-300">
            {firstRun ? WELCOME_COPY.lead : HERO_COPY.lead}
          </p>
          <div className="max-w-2xl">
            {!active ? (
              <LensFieldStill size="hero" trailing={newProject} />
            ) : firstRun ? (
              <WelcomeSearch />
            ) : (
              <LensField
                lens={lens}
                subjects={lensResult.subjects}
                size="hero"
                trailing={newProject}
              />
            )}
          </div>
        </div>
        <div className="absolute right-4 top-6 z-20 hidden sm:right-6 lg:block">
          <HeroCorner />
        </div>
        <div className="relative hidden h-72 min-w-[18rem] flex-[1_1_22rem] lg:block">
          <Suspense fallback={null}>
            <HeroFeatureFan />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
