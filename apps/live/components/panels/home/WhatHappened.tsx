'use client';

// What happened (docs/specs/013-workspace/explorer-home.md "What happened"): what other people did
// to documents the person can open, under day headings, with no filter controls. A quiet See
// timeline link at the end of the section's heading row opens the Timeline; it
// sits there so it never moves when the entries land.

import { useMemo } from 'react';
import { CompactEmptyState, isNewEvent } from '@livediagram/ui';
import type { HomeGroup } from '@livediagram/api-schema';
import { HOME_COPY } from '@/app/explorer/home/home-copy';
import { useNow } from '@/hooks/ui/useNow';
import { groupsByDay } from '@/app/explorer/home/home-model';
import { WhatHappenedSkeleton } from './HomeSkeletons';
import { ActionEntry, SummaryEntry } from './WhatHappenedEntry';
import { HomeSection } from './HomeSection';
import { WHAT_HAPPENED_PANEL } from './home-styles';
import { WhatHappenedEmptyIcon } from './home-icons';

export function WhatHappened({
  groups,
  loading,
  lastSeenAt,
  timelineHref,
  onSeeTimeline,
}: {
  groups: HomeGroup[];
  loading: boolean;
  /** The unread mark before this visit: newer entries are New. */
  lastSeenAt: number | undefined;
  /** The Timeline page, for the link's href (new tab, copy link). */
  timelineHref: string;
  /** In-app navigation to the Timeline. */
  onSeeTimeline: () => void;
}) {
  const now = useNow(false);
  const days = useMemo(() => groupsByDay(groups, now), [groups, now]);
  return (
    <HomeSection
      id="what-happened"
      title={HOME_COPY.whatHappened}
      busy={loading}
      link={{ href: timelineHref, label: HOME_COPY.seeTimeline, onNavigate: onSeeTimeline }}
    >
      {loading ? (
        <WhatHappenedSkeleton />
      ) : days.length === 0 ? (
        // In the panel, the size and place of one entry (docs/specs/004-interface-design/empty-states.md "In place
        // of one item").
        <div className={WHAT_HAPPENED_PANEL}>
          <CompactEmptyState
            layout="row"
            className="px-2 py-3"
            icon={<WhatHappenedEmptyIcon />}
            title={HOME_COPY.whatHappenedEmptyTitle}
            description={HOME_COPY.whatHappenedEmpty}
          />
        </div>
      ) : (
        <div className={`flex flex-col gap-3 ${WHAT_HAPPENED_PANEL}`}>
          {days.map((day) => (
            <div key={day.day}>
              <h3
                id={`home-day-${day.day}`}
                className="mb-1 px-2 pt-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400"
              >
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
