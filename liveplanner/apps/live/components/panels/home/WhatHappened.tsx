'use client';

// What Happened (docs/specs/013-workspace/explorer-home.md "What Happened"): what other people did
// to projects the person can open, under day headings, with no filter controls and no link of its own.

import { useMemo } from 'react';
import { isNewEvent } from '@liveplanner/ui';
import type { HomeGroup } from '@liveplanner/api-schema';
import { HOME_COPY } from '@/app/explorer/home/home-copy';
import { useNow } from '@/hooks/ui/useNow';
import { groupsByDay } from '@/app/explorer/home/home-model';
import { WhatHappenedSkeleton } from './HomeSkeletons';
import { ActionEntry, SummaryEntry } from './WhatHappenedEntry';
import { HomeSection } from './HomeSection';
import { WHAT_HAPPENED_PANEL } from './home-styles';

export function WhatHappened({
  groups,
  loading,
  lastSeenAt,
}: {
  groups: HomeGroup[];
  loading: boolean;
  /** The unread mark before this visit: newer entries are New. */
  lastSeenAt: number | undefined;
}) {
  const now = useNow(false);
  const days = useMemo(() => groupsByDay(groups, now), [groups, now]);
  // Nothing from anyone: Home leaves the section out rather than show a second empty state
  // (explorer-home.md "What Happened"). It is the page's last section, so nothing moves when it goes.
  if (!loading && days.length === 0) return null;
  return (
    <HomeSection id="what-happened" title={HOME_COPY.whatHappened} busy={loading}>
      {loading ? (
        <WhatHappenedSkeleton />
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
