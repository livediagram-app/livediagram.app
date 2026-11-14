'use client';

// Home (liveworkspace/docs/specs/004-index/one-explorer.md "Most Used and Recent, on Home"): under the hero, New
// (HomeNew: the four items made most recently), then Most Used (up to eight large cards, two rows of four on a desktop:
// the items opened most often in the last 14 days, "Opened N times") and Recent directly after it (up to eight more of
// the same size, the latest opened of the rest, See More at its heading's right), each a section headed as New is,
// then Spaces (HomeSpaces: My Work and each team, each a tile into its list), and Shared With You Recently. On a phone
// each of Most Used and Recent is its own strip of up to eight under its own heading. A section with nothing in it is
// left out. An item kept only in this browser is one card among Recent's (LocalCard): the same frame, size, menu and
// drag, with the This Browser badge on its line and This Browser's own verbs. With the hero hidden, Home takes the
// ordinary page header. Three requests, each one small page: Recent carries Most Used and New beside it (the index's
// `used` and `newest`), so its two sections cost one; the spaces' previews; and Shared. The cards are HomeCards.tsx's.

import { useEffect, useMemo, useState } from 'react';
import type { ShownItem } from '../data/overlay';
import { useItemList } from '../data/useItemList';
import {
  isMostUsed,
  JUMP_BACK_IN_PER_GROUP,
  homeEmptyLine,
  jumpBackInLoader,
  sharedRecentlyLoader,
} from '../data/viewLists';
import { EmptyState } from '@liveworkspace/ui';
import { ClockIcon } from '../ui/icons';
import { useExplorer } from './context';
import { PaneHeader } from './PaneHeader';
import { HomeFailed, HomeSection } from './HomeSection';
import { CardGroup, GridSkeleton, HomeCardsProvider, Strip, StripSkeleton } from './HomeCards';
import { HomeNew } from './HomeNew';
import { HomeSpaces } from './HomeSpaces';
import type { ThisBrowserItem } from '../this-browser';
import { useFirstRun } from '../welcome/context';
import { HomeWelcome } from '../welcome/HomeWelcome';
import { mergeOpened, useThisBrowserItems } from './ThisBrowser';

export const HOME_SHARED = 4;
// Recent with this browser's own items merged in.
const HOME_RECENT_MAX = JUMP_BACK_IN_PER_GROUP;
// A phone's strip, one per section: at most this many tiles (Recent's then its See More tile).
export const HOME_STRIP_MAX = JUMP_BACK_IN_PER_GROUP;

export const HOME_COPY = {
  sharedRecently: 'Shared With You Recently',
  seeMore: 'See More',
  seeAll: 'See All',
  mostUsed: 'Most Used',
  recent: 'Recent',
} as const;

/** Home's grids from `md` up; below it, the strips. */
const WIDE_QUERY = '(min-width: 768px)';

function useWide(): boolean {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const list = window.matchMedia(WIDE_QUERY);
    const update = () => setWide(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, []);
  return wide;
}

export function HomePane({ hero }: { hero: boolean }) {
  const { client, app, filter, overlay, epoch, onCreate, onHome } = useExplorer();
  const recentLoad = useMemo(() => jumpBackInLoader(client, app, filter), [client, app, filter]);
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
  const wide = useWide();
  const showApp = filter === 'all';
  // What this browser keeps of the host app's, by the same rule as Recent (last opened first): only where the host
  // can read it (the Explorer on the app's own address).
  const { live: local } = useThisBrowserItems();
  const localOpened = useMemo(() => local.filter((i) => i.lastOpenedAt !== null), [local]);
  const recentRest = useMemo(
    () =>
      mergeOpened(
        recent.items.filter((i) => !isMostUsed(i)),
        localOpened,
        HOME_RECENT_MAX,
      ),
    [recent.items, localOpened],
  );
  const mostUsed = useMemo(() => recent.items.filter(isMostUsed), [recent.items]);
  const empty = !recent.loading && mostUsed.length === 0 && recentRest.length === 0;
  const { firstRun } = useFirstRun();
  // A failed read says so once, under Recent's heading, with Try again, never "nothing yet".
  const failed = !recent.loading && Boolean(recent.error);
  const loading = recent.loading;
  // A card opened from Most Used or Recent, or See More followed to the Recent view (Home·Selected).
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

  return (
    <div data-explorer-view="home">
      {/* The hero is Home's page header; with the banner hidden, Home takes the ordinary one. */}
      {hero ? null : (
        <PaneHeader title="Home" onCreateItem={() => onCreate({ folderId: null, teamId: null })} />
      )}
      <HomeCardsProvider>
        <div className="flex flex-col gap-10">
          <HomeNew wide={wide} showApp={showApp} />
          {/* Most Used: left out once the read finds none, and while Home could not load (Recent says so). */}
          {loading || (!failed && mostUsed.length > 0) ? (
            <HomeSection
              id="most-used"
              title={HOME_COPY.mostUsed}
              busy={loading}
              onPick={onHome ? pickFrom('MostUsed') : undefined}
            >
              {loading ? (
                <SectionSkeleton wide={wide} />
              ) : (
                <SectionCards wide={wide} items={mostUsed} showApp={showApp} />
              )}
            </HomeSection>
          ) : null}
          {/* Recent: left out when Most Used holds everything opened; with nothing opened at all, it keeps Home's one
              empty state. */}
          {loading || failed || empty || recentRest.length > 0 ? (
            <HomeSection
              id="recent"
              title={HOME_COPY.recent}
              busy={loading}
              onPick={onHome ? pickFrom('Recent') : undefined}
              link={
                wide && !loading && !failed && recentRest.length > 0
                  ? { view: { kind: 'recent' }, label: HOME_COPY.seeMore }
                  : undefined
              }
            >
              {failed ? (
                <HomeFailed message="Couldn’t load Home." onRetry={retry} />
              ) : loading ? (
                <SectionSkeleton wide={wide} />
              ) : empty ? (
                <HomeEmpty />
              ) : (
                <SectionCards wide={wide} items={recentRest} showApp={showApp} seeMore />
              )}
            </HomeSection>
          ) : null}
          <HomeSpaces />
          {shared.items.length > 0 ? (
            <HomeSection
              id="shared-recently"
              title={HOME_COPY.sharedRecently}
              busy={false}
              link={{ view: { kind: 'shared' }, label: HOME_COPY.seeAll }}
            >
              <CardGroup items={shared.items} large showApp={showApp} />
            </HomeSection>
          ) : null}
        </div>
      </HomeCardsProvider>
    </div>
  );
}

const live = (i: ShownItem) => i.trashedAt === null;
// Most Used and Recent leave out what the person hid from Recent (the index does too; this catches a change made here).
const notHidden = (i: ShownItem) => live(i) && !i.hiddenFromRecent;

/** One section's placeholders: a full group of large cards from `md`, the strip's below. */
function SectionSkeleton({ wide }: { wide: boolean }) {
  return wide ? <GridSkeleton /> : <StripSkeleton />;
}

/** One section's cards: the large cards' grid from `md`; below it a strip, Recent's ending on See More. */
function SectionCards({
  wide,
  items,
  showApp,
  seeMore = false,
}: {
  wide: boolean;
  items: readonly (ShownItem | ThisBrowserItem)[];
  showApp: boolean;
  seeMore?: boolean;
}) {
  if (wide) return <CardGroup items={items} large showApp={showApp} />;
  return (
    <Strip
      items={items.filter((i): i is ShownItem => 'app' in i)}
      local={items.filter((i): i is ThisBrowserItem => !('app' in i))}
      max={HOME_STRIP_MAX}
      seeMore={seeMore ? HOME_COPY.seeMore : undefined}
    />
  );
}

// Nothing opened yet: the Explorer's one empty state, as every other list shows it.
function HomeEmpty() {
  const { words } = useExplorer();
  return (
    <EmptyState
      compact
      icon={<ClockIcon />}
      title={`No ${words.lowerMany} yet`}
      description={homeEmptyLine(words.lowerMany)}
    />
  );
}
