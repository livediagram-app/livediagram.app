'use client';

// Jump back in (docs/specs/013-workspace/explorer-home.md "Jump back in"): the person's Within reach
// set of documents. On a desktop or tablet a 4 by 2 grid, most used on top and recent below, with
// See more in the heading row; on a phone the alternating strip that ends in its See more tile. The
// two halves carry no titles: the documents are one list named Jump back in (Calm by default).

import { CompactEmptyState, useMediaQuery } from '@livediagram/ui';
import { track } from '@/lib/telemetry';
import { HOME_COPY } from '@/app/explorer/home/home-copy';
import type { JumpBackInSet } from '@/app/explorer/home/home-model';
import { HomeSection } from './HomeSection';
import { GridSkeleton, StripSkeleton } from './HomeSkeletons';
import { JumpBackInStrip } from './JumpBackInStrip';
import { JumpBackInTile } from './JumpBackInTile';
import { GRID, GRID_MIN_HEIGHT, GRID_THUMB } from './home-styles';
import { JumpBackInEmptyIcon } from './home-icons';

/** The grid from the spec's `md:` up: desktop and tablet. */
const HOME_WIDE_QUERY = '(min-width: 768px)';

const HEADING_ID = 'home-jump-back-in';

export function JumpBackIn({
  ownerId,
  set,
  loading,
  recentHref,
  onSeeMore,
}: {
  ownerId: string;
  set: JumpBackInSet;
  loading: boolean;
  /** The Recent page, for See more's href (new tab, copy link). */
  recentHref: string;
  /** In-app navigation to the Recent page. */
  onSeeMore: () => void;
}) {
  const wide = useMediaQuery(HOME_WIDE_QUERY);
  const empty = set.mostUsed.length === 0 && set.recent.length === 0;
  return (
    <HomeSection
      id="jump-back-in"
      title={HOME_COPY.jumpBackIn}
      busy={loading}
      link={
        wide
          ? {
              href: recentHref,
              label: HOME_COPY.seeMore,
              onNavigate: onSeeMore,
              onActivate: () => track('Home', 'Selected', 'JumpBackIn.SeeMore'),
            }
          : undefined
      }
    >
      {!wide ? (
        loading ? (
          <StripSkeleton />
        ) : (
          <JumpBackInStrip
            ownerId={ownerId}
            set={set}
            recentHref={recentHref}
            onSeeMore={onSeeMore}
            labelledBy={HEADING_ID}
          />
        )
      ) : loading ? (
        <GridSkeleton />
      ) : empty ? (
        // The shared empty state (docs/specs/004-interface-design/empty-states.md), in the grid's reserved box.
        <CompactEmptyState
          className={GRID_MIN_HEIGHT}
          icon={<JumpBackInEmptyIcon />}
          title={HOME_COPY.jumpBackInEmptyTitle}
          description={HOME_COPY.jumpBackInEmpty}
        />
      ) : (
        <ul aria-labelledby={HEADING_ID} className={GRID}>
          {set.mostUsed.map((item) => (
            <li key={item.documentId} className="min-w-0">
              <JumpBackInTile
                ownerId={ownerId}
                item={item}
                group="mostUsed"
                thumbClassName={GRID_THUMB}
              />
            </li>
          ))}
          {set.recent.map((item, i) => (
            // The recent open the second row, whatever the length of the first.
            <li
              key={item.documentId}
              className={`min-w-0 ${i === 0 && set.mostUsed.length > 0 ? 'col-start-1' : ''}`}
            >
              <JumpBackInTile
                ownerId={ownerId}
                item={item}
                group="recent"
                thumbClassName={GRID_THUMB}
              />
            </li>
          ))}
        </ul>
      )}
    </HomeSection>
  );
}
