'use client';

import { useMemo } from 'react';
import { useItemList } from '../data/useItemList';
import { isMostUsed, jumpBackInLoader } from '../data/viewLists';
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
  PaneGrid,
  PaneSection,
  PaneSkeleton,
} from './pane-parts';
import { JumpBackInCard } from './pane-items';

// ---- Home -----------------------------------------------------------------------------------------------

// How many items Home's Jump Back In lists in the pane (two full rows of four in a desktop popover; the pane's grid
// hides all but the first six below four across, so two and three across end on a full row), from this many of each
// group (fewer than Home's page).
const JUMP_BACK_IN_ROWS = 8;
const PANEL_PER_GROUP = 4;
// The recent ones asked past PANEL_PER_GROUP: JUMP_BACK_IN_ROWS of them and one for the open item.
const PANEL_RECENT_EXTRA = JUMP_BACK_IN_ROWS + 1 - PANEL_PER_GROUP;
const live = (i: ShownItem) => i.trashedAt === null;
const notHidden = (i: ShownItem) => live(i) && !i.hiddenFromRecent;
// The index's item, or one kept only in this browser (which has no app: it is the host's).
const isIndexed = (i: ShownItem | ThisBrowserItem): i is ShownItem => 'app' in i;

export function HomeSection({
  currentId,
  onOpenExplorer,
}: {
  currentId: string | null;
  onOpenExplorer?: (view: ExplorerView) => void;
}) {
  const { client, app, filter, overlay, epoch, words } = useExplorer();
  // Most used then recent (one request): enough recent ones to fill the pane alone, plus one, so a person with no most
  // used yet, or leaving out the open item, still sees two full rows.
  const load = useMemo(
    () => jumpBackInLoader(client, app, filter, PANEL_PER_GROUP, PANEL_RECENT_EXTRA),
    [client, app, filter],
  );
  const list = useItemList({
    key: `panel-home:${filter}`,
    load,
    overlay,
    belongs: notHidden,
    epoch,
  });
  // What this browser keeps of the app's, opened here: Jump Back In's by the page's rule.
  const { live: local } = useThisBrowserItems();
  const localOpened = useMemo(() => local.filter((i) => i.lastOpenedAt !== null), [local]);
  if (list.error)
    return (
      <PaneFailed
        message="Home could not load. Check your connection and try again."
        onRetry={list.retry}
      />
    );
  if (list.loading) return <PaneSkeleton rows={6} />;
  // The index's most used first, then its recent with this browser's opened ones merged in by last open, as the
  // page's Home does (mergeOpened); the open item left out of both.
  const others = list.items.filter((i) => i.id !== currentId);
  const recent = [
    ...others.filter(isMostUsed),
    ...mergeOpened(
      others.filter((i) => !isMostUsed(i)),
      localOpened.filter((i) => i.id !== currentId),
      JUMP_BACK_IN_ROWS,
    ),
  ].slice(0, JUMP_BACK_IN_ROWS);
  // Empty only because the open item is left out: there is one, just no other.
  const onlyOpen =
    recent.length === 0 &&
    (list.items.some((i) => i.id === currentId) || localOpened.some((i) => i.id === currentId));
  return (
    <div className="flex flex-col gap-6">
      <PaneSection
        title="Jump Back In"
        action={
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
        }
      >
        {recent.length ? (
          <PaneGrid label="Jump Back In" fullRowsBelowFour>
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
            description={
              onlyOpen
                ? `The other ${words.lowerMany} you use most and last will gather here.`
                : `The ${words.lowerMany} you use most and last will gather here.`
            }
          />
        )}
      </PaneSection>
    </div>
  );
}
