'use client';

// What happened (docs/specs/013-workspace/explorer-home.md "What happened"): what other people did
// to documents the person can open, under day headings, with no filter controls. A quiet See all
// activity link in the heading row opens the Timeline feed (All activity); it sits there so it
// never moves when the entries land.

import { useMemo } from 'react';
import type { HomeGroup } from '@livediagram/api-schema';
import { HOME_COPY } from '@/app/explorer/home/home-copy';
import { useNow } from '@/hooks/ui/useNow';
import { groupsByDay } from '@/app/explorer/home/home-model';
import { WhatHappenedSkeleton } from './HomeSkeletons';
import { ActionEntry, SummaryEntry } from './WhatHappenedEntry';
import { FOCUS_RING, MUTED, SUB_HEADING } from './home-styles';

export function WhatHappened({
  groups,
  loading,
  allActivityHref,
  onSeeAll,
}: {
  groups: HomeGroup[];
  loading: boolean;
  /** The All activity page, for the link's href (new tab, copy link). */
  allActivityHref: string;
  /** In-app navigation to All activity. */
  onSeeAll: () => void;
}) {
  const now = useNow(false);
  const days = useMemo(() => groupsByDay(groups, now), [groups, now]);
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 id="home-what-happened" className={SUB_HEADING}>
          {HOME_COPY.whatHappened}
        </h3>
        <a
          href={allActivityHref}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
            e.preventDefault();
            onSeeAll();
          }}
          className={`rounded-sm text-xs font-medium text-brand-700 hover:underline dark:text-brand-300 ${FOCUS_RING}`}
        >
          {HOME_COPY.seeAllActivity}
        </a>
      </div>
      {loading ? (
        <WhatHappenedSkeleton />
      ) : days.length === 0 ? (
        <p className={`py-2 text-sm ${MUTED}`}>{HOME_COPY.whatHappenedEmpty}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {days.map((day) => (
            <div key={day.day}>
              <h4 id={`home-day-${day.day}`} className={`mb-1 px-2 text-xs font-medium ${MUTED}`}>
                {day.label}
              </h4>
              <ul className="flex flex-col gap-1">
                {day.groups.flatMap((group) =>
                  group.summary
                    ? [<SummaryEntry key={group.id} group={group} />]
                    : group.actions.map((action) => (
                        <ActionEntry key={action.id} group={group} action={action} />
                      )),
                )}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
