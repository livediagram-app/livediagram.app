'use client';

// Home (liveworkspace/docs/specs/004-index/one-explorer.md "Home's layout"): under the hero, two columns once the pane
// is wide enough. On the left, Recent as a timeline (HomeTimeline): New's items (made) and Recent's (opened) as one list
// of rows by day, newest first, See More at its heading's right. On the right, the rail: Most Used (up to eight ranked
// rows, each with its 14-day day chart), Spaces (HomeSpaces) and Shared With You Recently, each a panel. Below that
// width (a phone, a narrow window) one column, the rail's panels after the timeline. A section with nothing in it is
// left out, heading and all; with every one empty (once each read has answered), Home shows one empty state for the
// whole view with New (HomeNothing, "Nothing on Home"). Each item shows once, in the first of New, Most Used and
// Recent it qualifies for (home-sections.ts). An item kept only in this browser is a row among the timeline's
// (HomeRow's LocalCard), with Offline's own verbs. With the hero hidden, Home takes the ordinary page header. Three
// requests, each one small page: Recent carries Most Used and New beside it (the index's `used` and `newest`); the
// spaces' previews; and Shared.

import { useMemo } from 'react';
import type { ShownItem } from '../data/overlay';
import { useItemList } from '../data/useItemList';
import { JUMP_BACK_IN_PER_GROUP, homeOpenedLoader, sharedRecentlyLoader } from '../data/viewLists';
import { useExplorer } from './context';
import { EmptyPane } from './EmptyPane';
import { PaneHeader } from './PaneHeader';
import { HomeFailed, HomeSection } from './HomeSection';
import { HomeCardsProvider, HomeRow } from './HomeCards';
import { HomeTimeline, TimelineSkeleton } from './HomeTimeline';
import { MUTED, SKELETON } from '../ui/classes';
import { useHomeNew } from './HomeNew';
import { homeSections } from './home-sections';
import { HomeSpaces, useHomeSpaces } from './HomeSpaces';
import { useFirstRun } from '../welcome/context';
import { HomeWelcome } from '../welcome/HomeWelcome';
import { useThisBrowserItems } from './ThisBrowser';

export const HOME_SHARED = 4;
// Recent with this browser's own items merged in.
const HOME_RECENT_MAX = JUMP_BACK_IN_PER_GROUP;

export const HOME_COPY = {
  sharedRecently: 'Shared With You Recently',
  seeMore: 'See More',
  seeAll: 'See All',
  mostUsed: 'Most Used',
  recent: 'Recent',
  dayChartKey: 'Each square is a day: 14 days ago on the left, today on the right.',
} as const;

export function HomePane({ hero }: { hero: boolean }) {
  const { client, app, filter, overlay, epoch, onCreate, onHome } = useExplorer();
  const recentLoad = useMemo(() => homeOpenedLoader(client, app, filter), [client, app, filter]);
  const sharedLoad = useMemo(
    () => sharedRecentlyLoader(client, app, filter, HOME_SHARED),
    [client, app, filter],
  );
  const recent = useItemList({
    key: `home-recent:${filter}`,
    load: recentLoad,
    overlay,
    belongs: notHidden,
    epoch,
  });
  const shared = useItemList({
    key: `home-shared:${filter}`,
    load: sharedLoad,
    overlay,
    belongs: live,
    epoch,
  });
  const showApp = filter === 'all';
  // What this browser keeps of the host app's, by the same rule as Recent (last opened first): only where the host
  // can read it (the Explorer on the app's own address).
  const { live: local } = useThisBrowserItems();
  const localOpened = useMemo(() => local.filter((i) => i.lastOpenedAt !== null), [local]);
  // New first, then Most Used, then Recent: each item in the first it qualifies for, each section still full.
  const made = useHomeNew();
  const { mostUsed, recent: recentRest } = useMemo(
    () => homeSections(recent.items, made.shown, localOpened, HOME_RECENT_MAX),
    [recent.items, made.shown, localOpened],
  );
  // Most Used's charts measure every day against the busiest day across the list, so rows compare at a glance.
  const peak = useMemo(
    () => mostUsed.reduce((top, i) => Math.max(top, ...(i.useHistory ?? [0])), 0),
    [mostUsed],
  );
  const { firstRun } = useFirstRun();
  // A failed read says so once, under Recent's heading, with Try again, never "nothing yet".
  const failed = !recent.loading && Boolean(recent.error);
  const loading = recent.loading;
  const spaces = useHomeSpaces();
  // The timeline holds New's items (made) and Recent's (opened); New's own read failing leaves only Recent's.
  const madeShown = made.error ? [] : made.shown;
  const timelineLoading = loading || made.loading;
  const timeline = madeShown.length > 0 || recentRest.length > 0;
  // Every section answered and empty: one empty state for the whole view, never a heading over nothing.
  const nothing =
    !loading &&
    !failed &&
    mostUsed.length === 0 &&
    recentRest.length === 0 &&
    !made.loading &&
    made.shown.length === 0 &&
    !shared.loading &&
    shared.items.length === 0 &&
    spaces.empty;
  // A row opened from Most Used or Recent, or See More followed to the Recent view (Home·Selected).
  const pickFrom = (section: 'MostUsed' | 'Recent') => (seeLink: boolean) =>
    onHome?.('Selected', seeLink ? 'SeeMore' : section);
  const retry = () => {
    onHome?.('Loaded', 'Retry');
    recent.retry();
    shared.retry();
  };

  // A first run (the host's welcome, and nothing the person can open yet): starting points in place of the lists.
  if (firstRun)
    return (
      <div data-explorer-view="home">
        {hero ? null : (
          <PaneHeader
            title="Home"
            onCreateItem={() => onCreate({ folderId: null, teamId: null })}
          />
        )}
        <HomeWelcome withSearch={!hero} />
      </div>
    );

  const showMostUsed = loading || (!failed && mostUsed.length > 0);
  const showShared = shared.items.length > 0;
  const rail = showMostUsed || !spaces.empty || showShared;

  return (
    <div data-explorer-view="home">
      {/* The hero is Home's page header; with the banner hidden, Home takes the ordinary one. */}
      {hero ? null : (
        <PaneHeader title="Home" onCreateItem={() => onCreate({ folderId: null, teamId: null })} />
      )}
      {nothing ? (
        <HomeNothing />
      ) : (
        <HomeCardsProvider>
          {/* The timeline on the left and the rail on the right once the pane is wide enough for both (its own
              width, not the window's: the sidebar takes its share). Below that one column, Most Used first (the
              quickest way back in on a phone), then the timeline, then the rail's other panels: the order they are
              written in, so a keyboard and a screen reader meet them in that order too. */}
          <div className="@container" data-home-layout="">
            <div
              className={`grid grid-cols-1 items-start gap-6 sm:gap-8 ${rail ? '@4xl:grid-cols-[minmax(0,1fr)_20rem] @4xl:grid-rows-[auto_1fr] @6xl:grid-cols-[minmax(0,1fr)_22rem]' : ''}`}
            >
              {showMostUsed ? (
                <div className="min-w-0 @4xl:col-start-2 @4xl:row-start-1">
                  <HomeSection
                    id="most-used"
                    title={HOME_COPY.mostUsed}
                    busy={loading}
                    panel
                    onPick={onHome ? pickFrom('MostUsed') : undefined}
                  >
                    {loading ? (
                      <RowsSkeleton rows={5} thumb={false} />
                    ) : (
                      <>
                        <ol>
                          {mostUsed.map((item, i) => (
                            <li key={item.id} className="min-w-0">
                              <HomeRow
                                item={item}
                                showApp={showApp}
                                line="used"
                                rank={i + 1}
                                peak={peak}
                              />
                            </li>
                          ))}
                        </ol>
                        {peak > 0 ? (
                          <p className={`px-2 pb-1 pt-2 text-[11.5px] leading-4 ${MUTED}`}>
                            {HOME_COPY.dayChartKey}
                          </p>
                        ) : null}
                      </>
                    )}
                  </HomeSection>
                </div>
              ) : null}
              {timelineLoading || failed || timeline ? (
                <div className="min-w-0 @4xl:col-start-1 @4xl:row-span-2 @4xl:row-start-1">
                  <HomeSection
                    id="recent"
                    title={HOME_COPY.recent}
                    busy={timelineLoading}
                    onPick={onHome ? pickFrom('Recent') : undefined}
                    link={
                      !timelineLoading && !failed && timeline
                        ? { view: { kind: 'recent' }, label: HOME_COPY.seeMore }
                        : undefined
                    }
                  >
                    {failed ? (
                      <HomeFailed message="Couldn’t load Home." onRetry={retry} />
                    ) : timelineLoading ? (
                      <TimelineSkeleton />
                    ) : (
                      <HomeTimeline made={madeShown} opened={recentRest} showApp={showApp} />
                    )}
                  </HomeSection>
                </div>
              ) : null}
              {!spaces.empty || showShared ? (
                <div
                  className={`flex min-w-0 flex-col gap-6 @4xl:col-start-2 ${showMostUsed ? '@4xl:row-start-2' : '@4xl:row-start-1'}`}
                  data-home-rail=""
                >
                  <HomeSpaces state={spaces} />
                  {showShared ? (
                    <HomeSection
                      id="shared-recently"
                      title={HOME_COPY.sharedRecently}
                      busy={false}
                      panel
                      link={{ view: { kind: 'shared' }, label: HOME_COPY.seeAll }}
                    >
                      <ul>
                        {shared.items.map((item) => (
                          <li key={item.id} className="min-w-0">
                            <HomeRow item={item} showApp={showApp} line="opened" />
                          </li>
                        ))}
                      </ul>
                    </HomeSection>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </HomeCardsProvider>
      )}
    </div>
  );
}

/** A rail panel's rows as they load: the row's shape, with or without its thumbnail. */
function RowsSkeleton({ rows, thumb }: { rows: number; thumb: boolean }) {
  return (
    <div aria-hidden className="flex flex-col">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex min-h-14 items-center gap-3 p-2">
          {thumb ? <div className={`h-11 w-16 shrink-0 rounded-lg ${SKELETON}`} /> : null}
          <div className="flex flex-1 flex-col gap-1.5">
            <div className={`h-3.5 w-3/4 ${SKELETON}`} />
            <div className={`h-2.5 w-1/2 ${SKELETON}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Where Home's New makes one, as the header's does: the person's own space, in no folder.
const HOME_PLACE = { folderId: null, teamId: null };
const live = (i: ShownItem) => i.trashedAt === null;
// Most Used and Recent leave out what the person hid from Recent (the index does too; this catches a change made here).
const notHidden = (i: ShownItem) => live(i) && !i.hiddenFromRecent;

// Nothing on Home at all: the Explorer's one empty state for the whole view, with New where the header's New makes it.
function HomeNothing() {
  const { words, kind, onCreate } = useExplorer();
  return (
    <div data-home-nothing="">
      <EmptyPane
        view={{ kind: 'home' }}
        words={words}
        onCreate={(app) => (app ? onCreate(HOME_PLACE, app) : onCreate(HOME_PLACE))}
        createLabel={`New ${kind.one}`}
      />
    </div>
  );
}
