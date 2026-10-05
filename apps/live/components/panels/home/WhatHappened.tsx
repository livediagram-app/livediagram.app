'use client';

// What happened (docs/specs/013-workspace/explorer-home.md "What happened"): what other people did
// to documents the person can open, under day headings, with no filter controls. A quiet See all
// activity link at the end of the section's heading row opens the Timeline feed (All activity); it
// sits there so it never moves when the entries land.

import { useMemo } from 'react';
import { isNewEvent } from '@livediagram/ui';
import type { HomeGroup } from '@livediagram/api-schema';
import { HOME_COPY } from '@/app/explorer/home/home-copy';
import { useNow } from '@/hooks/ui/useNow';
import { groupsByDay } from '@/app/explorer/home/home-model';
import { WhatHappenedSkeleton } from './HomeSkeletons';
import { ActionEntry, SummaryEntry } from './WhatHappenedEntry';
import { HomeSection } from './HomeSection';
import { MUTED } from './home-styles';

export function WhatHappened({
  groups,
  loading,
  lastSeenAt,
  allActivityHref,
  onSeeAll,
}: {
  groups: HomeGroup[];
  loading: boolean;
  /** The unread mark before this visit: newer entries are New. */
  lastSeenAt: number | undefined;
  /** The All activity page, for the link's href (new tab, copy link). */
  allActivityHref: string;
  /** In-app navigation to All activity. */
  onSeeAll: () => void;
}) {
  const now = useNow(false);
  const days = useMemo(() => groupsByDay(groups, now), [groups, now]);
  return (
    <HomeSection
      id="what-happened"
      title={HOME_COPY.whatHappened}
      busy={loading}
      link={{ href: allActivityHref, label: HOME_COPY.seeAllActivity, onNavigate: onSeeAll }}
    >
      {loading ? (
        <WhatHappenedSkeleton />
      ) : days.length === 0 ? (
        <p className={`py-2 text-sm ${MUTED}`}>{HOME_COPY.whatHappenedEmpty}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {days.map((day) => (
            <div key={day.day}>
              <h3 id={`home-day-${day.day}`} className={`mb-1 px-2 text-xs font-medium ${MUTED}`}>
                {day.label}
              </h3>
              <ul className="flex flex-col gap-1">
                {day.groups.flatMap((group) =>
                  group.summary
                    ? [
                        <SummaryEntry
                          key={group.id}
                          group={group}
                          isNew={isNewEvent(group.latestAt, lastSeenAt, now)}
                        />,
                      ]
                    : group.actions.map((action) => (
                        <ActionEntry
                          key={action.id}
                          group={group}
                          action={action}
                          isNew={isNewEvent(action.occurredAt, lastSeenAt, now)}
                        />
                      )),
                )}
              </ul>
            </div>
          ))}
        </div>
      )}
    </HomeSection>
  );
}
