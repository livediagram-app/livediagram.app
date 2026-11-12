'use client';

import { useMemo } from 'react';
import { useItemList } from '../data/useItemList';
import { homeEmptyLine, isMostUsed, jumpBackInLoader } from '../data/viewLists';
import type { ShownItem } from '../data/overlay';
import { useExplorer } from '../explorer/context';
import { mergeOpened, useThisBrowserItems } from '../explorer/ThisBrowser';
import type { ThisBrowserItem } from '../this-browser';
import { ClockIcon } from '../ui/icons';
import { explorerPath, type ExplorerView } from '../views';
import { PanelLocalCard } from './PanelThisBrowser';
import {
  PANE_LINK,
  PaneEmpty,
  PaneFailed,
  PaneCardSkeleton,
  PaneGrid,
  PaneSection,
} from './pane-parts';
import { JumpBackInCard } from './pane-items';

// ---- Home ----------------------------------------------------------------------------------------------

// The panel's Home (liveworkspace/docs/specs/004-index/one-explorer.md "The editors' panel's Home"): Most Used, then
// Recent with See all, each under its own heading, from one request. Each holds one row of four (PANEL_PER_GROUP);
// Recent takes two (PANEL_RECENT_ALONE) while nothing is most used yet, so a newcomer still sees two full rows.
const PANEL_PER_GROUP = 4;
const PANEL_RECENT_ALONE = 8;
// One more most used than the section shows, so leaving out the open item (usually among them) still fills its row.
const PANEL_USED_ASKED = PANEL_PER_GROUP + 1;
// The recent ones asked past PANEL_USED_ASKED: enough for Recent alone, and one for the open item.
const PANEL_RECENT_EXTRA = PANEL_RECENT_ALONE + 1 - PANEL_USED_ASKED;
const live = (i: ShownItem) => i.trashedAt === null;
const notHidden = (i: ShownItem) => live(i) && !i.hiddenFromRecent;
// The index's item, or one kept only in this browser (which has no app: it is the host's).
const isIndexed = (i: ShownItem | ThisBrowserItem): i is ShownItem => 'app' in i;

const MOST_USED = 'Most Used';
const RECENT = 'Recent';

export function HomeSection({
  currentId,
  onOpenExplorer,
}: {
  currentId: string | null;
  onOpenExplorer?: (view: ExplorerView) => void;
}) {
  const { client, app, filter, overlay, epoch, words } = useExplorer();
  // Most used then recent (one request): enough recent ones to fill Recent alone, plus one, so a person with no most
  // used yet, or leaving out the open item, still sees two full rows.
  const load = useMemo(
    () => jumpBackInLoader(client, app, filter, PANEL_USED_ASKED, PANEL_RECENT_EXTRA),
    [client, app, filter],
  );
  const list = useItemList({
    key: `panel-home:${filter}`,
    load,
    overlay,
    belongs: notHidden,
    epoch,
  });
  // What this browser keeps of the app's, opened here: Recent's by the page's rule.
  const { live: local } = useThisBrowserItems();
  const localOpened = useMemo(() => local.filter((i) => i.lastOpenedAt !== null), [local]);
  // A failed read draws once, with no headings.
  if (list.error)
    return (
      <PaneFailed
        message="Home could not load. Check your connection and try again."
        onRetry={list.retry}
      />
    );
  const seeAll = (
    <a
      href={explorerPath({ kind: 'recent' })}
      onClick={
        onOpenExplorer
          ? (e) => {
              e.preventDefault();
              onOpenExplorer({ kind: 'recent' });
            }
          : undefined
      }
      className={PANE_LINK}
    >
      See all
    </a>
  );
  if (list.loading)
    return (
      <div className="flex flex-col gap-6">
        <PaneSection title={MOST_USED}>
          <PaneCardSkeleton cards={PANEL_PER_GROUP} />
        </PaneSection>
        <PaneSection title={RECENT} action={seeAll}>
          <PaneCardSkeleton cards={PANEL_PER_GROUP} />
        </PaneSection>
      </div>
    );
  // The index's most used, then its recent with this browser's opened ones merged in by last open, as the page's
  // Home does (mergeOpened); the open item left out of both.
  // The open item leaves before the cut to four; a most used one past the four joins Recent by its last open.
  const others = list.items.filter((i) => i.id !== currentId);
  const used = others.filter(isMostUsed);
  const mostUsed = used.slice(0, PANEL_PER_GROUP);
  const recentMax = mostUsed.length ? PANEL_PER_GROUP : PANEL_RECENT_ALONE;
  const spare = used.slice(PANEL_PER_GROUP);
  const indexRecent = others.filter((i) => !isMostUsed(i));
  const recentPool = spare.length
    ? [...indexRecent, ...spare].sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))
    : indexRecent;
  const recent = mergeOpened(
    recentPool,
    localOpened.filter((i) => i.id !== currentId),
    recentMax,
  ).slice(0, recentMax);
  const empty = mostUsed.length === 0 && recent.length === 0;
  // Empty only because the open item is left out: there is one, just no other.
  const onlyOpen =
    empty &&
    (list.items.some((i) => i.id === currentId) || localOpened.some((i) => i.id === currentId));
  return (
    <div className="flex flex-col gap-6">
      {mostUsed.length ? (
        <PaneSection title={MOST_USED}>
          <PaneGrid label={MOST_USED} fullRows={PANEL_PER_GROUP}>
            {mostUsed.map((item) => (
              <JumpBackInCard key={item.id} item={item} />
            ))}
          </PaneGrid>
        </PaneSection>
      ) : null}
      {recent.length || empty ? (
        <PaneSection title={RECENT} action={seeAll}>
          {recent.length ? (
            <PaneGrid
              label={RECENT}
              fullRows={recent.length > PANEL_PER_GROUP ? PANEL_RECENT_ALONE : PANEL_PER_GROUP}
            >
              {recent.map((item) =>
                isIndexed(item) ? (
                  <JumpBackInCard key={item.id} item={item} />
                ) : (
                  <PanelLocalCard key={item.id} item={item} />
                ),
              )}
            </PaneGrid>
          ) : (
            <PaneEmpty
              icon={<ClockIcon />}
              title={onlyOpen ? 'Nothing else yet' : `No ${words.lowerMany} yet`}
              description={homeEmptyLine(words.lowerMany, onlyOpen)}
            />
          )}
        </PaneSection>
      ) : null}
    </div>
  );
}
