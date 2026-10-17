'use client';

// Home's hero (docs/specs/013-workspace/explorer-home.md "The hero"; blueprint
// docs/specs/013-workspace/blueprints/explorer-home-view.md "Presentation and UX"): the full-width band under the
// Explorer header on Home, its page header. Status pills, the greeting, the lead, the lens field drawn large with
// New Document inside it, and the fanned sheets of the newest documents. Reads only what the shell already holds.

import { lazy, Suspense, useMemo } from 'react';
import { PlusIcon } from '@/components/primitives/explorer-icons';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { DocumentThumbnail } from '@/components/panels/DocumentThumbnail';
import { track } from '@/lib/telemetry';
import { useNow } from '@/hooks/ui/useNow';
import { useExplorer } from '@/app/explorer/ExplorerContext';
import { HamburgerIcon } from '@/app/explorer/PaneHeader';
import { LensField, LensFieldStill } from '@/app/explorer/lens/LensField';
import { inboxBadge } from '@/app/explorer/sidebar/inbox-badge';
import { explorerPathFor } from '@/app/explorer/routes';
import { HERO_COPY, heroGreeting, heroPills, heroSheets } from '@/app/explorer/home/hero-model';
import { WELCOME_COPY } from '@/app/explorer/home/first-run';
import { useFirstRun } from '@/app/explorer/home/useFirstRun';
import { WelcomeSearch } from './WelcomeSearch';
import { InAppLink } from './HomeSection';
import { FOCUS_RING, SHEET_FRAME, SHEET_PLACES } from './home-styles';

const HEADING_ID = 'home-hero-greeting';

const PILL_DOT = { emerald: 'bg-emerald-500', sky: 'bg-sky-500' } as const;

const PILL =
  'inline-flex h-8 items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';

// A first run's sheets are template previews, fetched only when a first run draws them (explorer-home.md "First
// run"). React.lazy rather than next/dynamic: next/dynamic registers its module for preloading, which would fetch
// the previews on every Explorer page.
const HeroTemplateFan = lazy(() =>
  import('./HeroTemplateFan').then((m) => ({ default: m.HeroTemplateFan })),
);

/** `active` while Home is the page; a hero folding away draws its field still, so the page holds one live field. */
export function HomeHero({ active = true }: { active?: boolean }) {
  const { ownerId, documents, loading, activity, go, setMobileNavOpen, lens, lensResult } =
    useExplorer();
  const sheets = useMemo(() => heroSheets(documents), [documents]);
  const pills = heroPills({
    documents: loading ? undefined : documents.length,
    inbox: inboxBadge(activity),
  });
  const { heroFirstRun: firstRun, signedIn } = useFirstRun();
  const now = useNow(false);
  const greeting = heroGreeting(new Date(now).getHours());

  const newDocument = (
    <button
      type="button"
      aria-label={HERO_COPY.newDocument}
      onClick={() => {
        track('Home', 'Selected', 'Hero.NewDocument');
        window.location.assign('/new');
      }}
      className={`optical-edges flex h-11 shrink-0 items-center gap-2 rounded-xl bg-brand-700 px-[18px] text-[15px] font-semibold text-white transition hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-700 ${FOCUS_RING}`}
    >
      <PlusIcon />
      {/* The label folds to the plus on a phone; the button keeps its name. */}
      <span className="hidden sm:text-optical-line">{HERO_COPY.newDocument}</span>
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
            <HelpArticleLink article="timeline" variant="button" />
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
                pill.id === 'documents' ? ({ kind: 'all' } as const) : ({ kind: 'inbox' } as const);
              return (
                <InAppLink
                  key={pill.id}
                  href={explorerPathFor(view)}
                  onNavigate={() => go(view)}
                  onActivate={() =>
                    track(
                      'Home',
                      'Selected',
                      pill.id === 'documents' ? 'Hero.Documents' : 'Hero.Inbox',
                    )
                  }
                  className={`${PILL} transition hover:border-slate-300 dark:hover:border-slate-600 ${FOCUS_RING}`}
                >
                  <span aria-hidden className={`size-[7px] rounded-full ${PILL_DOT[pill.tone]}`} />
                  <span className="text-optical-centre">{pill.label}</span>
                </InAppLink>
              );
            })}
            {/* Help ends the pills' row from `sm` to `lg`; from `lg` it stands at the hero's top right, over the
                sheets; on a phone it sits beside the menu button above. */}
            <span className="ml-auto hidden sm:inline-flex lg:hidden">
              <HelpArticleLink article="timeline" variant="button" />
            </span>
          </div>
          <h1
            id={HEADING_ID}
            // Two lines held whichever greeting it is, so the first run's and the ordinary one swap without a shift.
            className="min-h-[2lh] max-w-3xl text-4xl font-extrabold leading-[1.02] tracking-[-0.04em] text-[#17153a] sm:text-5xl lg:text-[3.5rem] dark:text-white"
          >
            {firstRun
              ? `${WELCOME_COPY.greeting} ${WELCOME_COPY.question}`
              : `${greeting} ${HERO_COPY.question}`}
          </h1>
          <p className="min-h-[2lh] max-w-2xl text-[17px] leading-relaxed text-slate-600 dark:text-slate-300">
            {firstRun ? WELCOME_COPY.lead : HERO_COPY.lead}
          </p>
          <div className="max-w-2xl">
            {!active ? (
              <LensFieldStill size="hero" trailing={newDocument} />
            ) : firstRun ? (
              <WelcomeSearch />
            ) : (
              <LensField
                lens={lens}
                subjects={lensResult.subjects}
                size="hero"
                trailing={newDocument}
              />
            )}
          </div>
        </div>
        <div className="absolute right-4 top-6 z-20 hidden sm:right-6 lg:block">
          <HelpArticleLink article="timeline" variant="button" />
        </div>
        <div aria-hidden className="relative hidden h-72 min-w-[18rem] flex-[1_1_22rem] lg:block">
          {firstRun ? (
            <Suspense fallback={null}>
              <HeroTemplateFan />
            </Suspense>
          ) : null}
          {(firstRun ? [] : sheets).map((doc, i) => (
            <span key={doc.id} data-hero-sheet="" className={`${SHEET_FRAME} ${SHEET_PLACES[i]}`}>
              <DocumentThumbnail
                ownerId={ownerId}
                documentId={doc.id}
                version={doc.savedAt}
                empty={doc.empty}
                className="block h-full w-full"
              />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
