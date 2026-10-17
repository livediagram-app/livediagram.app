'use client';

// Jump back in (docs/specs/013-workspace/explorer-home.md "Jump back in"): the person's Within reach
// set of documents. On a desktop or tablet the Most used cards then the Recent cards, each group under its label,
// with See more in the heading row; on a phone the alternating strip that ends in its See more tile, which
// interleaves the groups and so labels neither.

import { useId } from 'react';
import { CompactEmptyState, useMediaQuery } from '@livediagram/ui';
import { track } from '@/lib/telemetry';
import { useRelativeNow } from '@/lib/relative-time';
import { HOME_COPY } from '@/app/explorer/home/home-copy';
import type { JumpBackInGroup, JumpBackInSet } from '@/app/explorer/home/home-model';
import { HomeSection } from './HomeSection';
import { GridSkeleton, StripSkeleton } from './HomeSkeletons';
import { JumpBackInStrip } from './JumpBackInStrip';
import { JumpBackInCard } from './JumpBackInCard';
import {
  EMPTY_SLOT,
  GROUP_LABEL,
  JUMP_BACK_IN_MIN_HEIGHT,
  LARGE_CARD,
  MOST_USED_GRID,
  RECENT_GRID,
} from './home-styles';
import { JumpBackInEmptyIcon } from './home-icons';

/** The grid from the spec's `md:` up: desktop and tablet. */
const HOME_WIDE_QUERY = '(min-width: 768px)';

const HEADING_ID = 'home-jump-back-in';

const GROUP_LABELS: Record<JumpBackInGroup, string> = { mostUsed: 'Most used', recent: 'Recent' };

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
        // The shared empty state (docs/specs/004-interface-design/empty-states.md) in place of one most used card,
        // so an empty Jump back in looks like a list with one thing in it.
        <div className={MOST_USED_GRID}>
          <div className={`${LARGE_CARD} ${EMPTY_SLOT} rounded-[18px]`}>
            <CompactEmptyState
              className="h-full w-full"
              icon={<JumpBackInEmptyIcon />}
              title={HOME_COPY.jumpBackInEmptyTitle}
              description={HOME_COPY.jumpBackInEmpty}
            />
          </div>
        </div>
      ) : (
        <div className={`flex flex-col gap-4 ${JUMP_BACK_IN_MIN_HEIGHT}`}>
          <CardGroup ownerId={ownerId} group="mostUsed" items={set.mostUsed} />
          <CardGroup ownerId={ownerId} group="recent" items={set.recent} />
        </div>
      )}
    </HomeSection>
  );
}

/** One labelled group of cards; a group with no document draws nothing, label included. */
function CardGroup({
  ownerId,
  group,
  items,
}: {
  ownerId: string;
  group: JumpBackInGroup;
  items: JumpBackInSet['mostUsed'];
}) {
  const labelId = useId();
  const now = useRelativeNow();
  if (items.length === 0) return null;
  return (
    <div data-jump-back-in-group={group}>
      <h3 id={labelId} className={GROUP_LABEL}>
        {GROUP_LABELS[group]}
      </h3>
      <ul aria-labelledby={labelId} className={group === 'mostUsed' ? MOST_USED_GRID : RECENT_GRID}>
        {items.map((item) => (
          <li key={item.documentId} className="min-w-0">
            <JumpBackInCard ownerId={ownerId} item={item} group={group} now={now} />
          </li>
        ))}
      </ul>
    </div>
  );
}
