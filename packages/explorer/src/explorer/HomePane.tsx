'use client';

// Home (livediagram's HomePane): under the hero, New (HomeNew: the four items made most recently), then Jump Back In as livediagram draws it, Most Used (up to eight large
// cards, two rows of four on a desktop: the items opened most often in the last 14 days, "Opened N times") then Recent
// (up to eight more of the same size, the latest opened of the rest), then Spaces (HomeSpaces: My Work and each team,
// each a tile into its list), and Shared With You Recently. On a phone Jump Back
// In is one scrolling strip of up to eight, the two groups alternating. An item kept only in this browser is one card among the rest (LocalCard): the same frame, size, menu
// and drag, with the This Browser badge on its line and This Browser's own verbs. Last, What Happened: what other people did to the items the person can open, from the index's
// Timeline. With the hero hidden, Home takes the ordinary page header. Four requests, each one small page: Recent
// carries Most Used and New beside it (the index's `used` and `newest`), the spaces' previews, Shared, and one
// Timeline page. The cards themselves are HomeCards.tsx's.

import { useEffect, useMemo, useState } from 'react';
import type { ShownItem } from '../data/overlay';
import { useItemList } from '../data/useItemList';
import {
  isMostUsed,
  JUMP_BACK_IN_PER_GROUP,
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
import { useFirstRun } from '../welcome/context';
import { HomeWelcome } from '../welcome/HomeWelcome';
import { mergeOpened, useThisBrowserItems } from './ThisBrowser';
import {
  useWhatHappened,
  useWhatHappenedGroups,
  WhatHappenedFeed,
  WhatHappenedSkeleton,
} from './WhatHappened';

export const HOME_SHARED = 4;
// Jump Back In's Recent group with this browser's own items merged in.
const HOME_RECENT_MAX = JUMP_BACK_IN_PER_GROUP;
// The phone's strip: one row, at most this many tiles before See More, both groups and this browser's together.
export const HOME_STRIP_MAX = 8;

export const HOME_COPY = {
  jumpBackIn: 'Jump Back In',
  sharedRecently: 'Shared With You Recently',
  seeMore: 'See More',
  seeAll: 'See All',
  mostUsed: 'Most Used',
  recent: 'Recent',
  whatHappened: 'What Happened',
  seeTimeline: 'See Timeline',
} as const;

/** Jump Back In's grid from `md` up; below it, the strip. */
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
  const happened = useWhatHappened(client, app, filter, epoch);
  const happenedGroups = useWhatHappenedGroups(happened);
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
  const empty = !recent.loading && recent.items.length === 0 && localOpened.length === 0;
  const { firstRun } = useFirstRun();
  // A failed read of Jump Back In says so, with Try again, never "nothing yet".
  const failed = !recent.loading && recent.error;
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
          <HomeSection
            id="jump-back-in"
            title={HOME_COPY.jumpBackIn}
            busy={recent.loading}
            link={
              wide && !recent.loading && !empty && !failed
                ? { view: { kind: 'recent' }, label: HOME_COPY.seeMore }
                : undefined
            }
          >
            {failed ? (
              <HomeFailed message="Couldn’t load Home." onRetry={retry} />
            ) : recent.loading ? (
              wide ? (
                <GridSkeleton />
              ) : (
                <StripSkeleton />
              )
            ) : empty ? (
              <HomeEmpty />
            ) : !wide ? (
              <Strip
                items={phoneOrder(recent.items)}
                local={localOpened}
                max={HOME_STRIP_MAX}
                seeMore={HOME_COPY.seeMore}
              />
            ) : (
              <div className="flex flex-col gap-4">
                <CardGroup
                  label={HOME_COPY.mostUsed}
                  items={recent.items.filter(isMostUsed)}
                  large
                  showApp={showApp}
                />
                <CardGroup label={HOME_COPY.recent} items={recentRest} large showApp={showApp} />
              </div>
            )}
          </HomeSection>
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
          {/* Nothing from anyone, or a failed read: the section is left out rather than a second empty state. It is
            the page's last, so nothing moves when it goes. */}
          {happened.loading || happenedGroups.length > 0 ? (
            <HomeSection
              id="what-happened"
              title={HOME_COPY.whatHappened}
              busy={happened.loading}
              link={
                happened.loading
                  ? undefined
                  : {
                      view: { kind: 'timeline' },
                      label: HOME_COPY.seeTimeline,
                      onFollow: () => onHome?.('Selected', 'SeeTimeline'),
                    }
              }
            >
              {happened.loading ? (
                <WhatHappenedSkeleton />
              ) : (
                <WhatHappenedFeed groups={happenedGroups} seenAt={happened.seenAt} />
              )}
            </HomeSection>
          ) : null}
        </div>
      </HomeCardsProvider>
    </div>
  );
}

const live = (i: ShownItem) => i.trashedAt === null;
// Jump Back In leaves out what the person hid from Recent (the index does too; this catches a change made here).
const notHidden = (i: ShownItem) => live(i) && !i.hiddenFromRecent;

/** The phone's strip: most used and recent alternating, the rest of the longer group after. */
export function phoneOrder(items: ShownItem[]): ShownItem[] {
  const used = items.filter(isMostUsed);
  const recent = items.filter((i) => !isMostUsed(i));
  const out: ShownItem[] = [];
  for (let k = 0; k < Math.max(used.length, recent.length); k++) {
    if (used[k]) out.push(used[k]!);
    if (recent[k]) out.push(recent[k]!);
  }
  return out;
}

// Jump Back In with nothing opened yet: the Explorer's one empty state, as every other list shows it.
function HomeEmpty() {
  const { words } = useExplorer();
  return (
    <EmptyState
      compact
      icon={<ClockIcon />}
      title={`No ${words.lowerMany} yet`}
      description={`The ${words.lowerMany} you open will gather here.`}
    />
  );
}
