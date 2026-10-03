'use client';

// Explorer Home (docs/specs/013-workspace/explorer-home.md; blueprint
// docs/specs/013-workspace/blueprints/explorer-home-view.md). On a tablet or wider, Recent (Jump
// back in, then What happened) beside the Timeline column, both landmarks with headings. On a
// phone, a Recent / Timeline switch over one panel, starting on Recent every visit.

import { useEffect, useState } from 'react';
import { useMediaQuery } from '@livediagram/ui';
import { track } from '@/lib/telemetry';
import { ARRIVED_ON_HOME } from '@/app/explorer/entry-path';
import { HOME_COPY } from '@/app/explorer/home/home-copy';
import { useHome } from '@/app/explorer/home/useHome';
import { HomeTimeline } from './HomeTimeline';
import { HOME_PANEL_ID, HomeSwitch, homeTabId, type HomeColumn } from './HomeSwitch';
import { JumpBackIn } from './JumpBackIn';
import { WhatHappened } from './WhatHappened';
import { FOCUS_RING, MUTED, SECTION_HEADING } from './home-styles';

/** Two columns from the spec's `md:` up. */
export const HOME_WIDE_QUERY = '(min-width: 768px)';

const RECENT_HEADING = 'home-recent';
const TIMELINE_HEADING = 'home-timeline';

export function HomePane({
  ownerId,
  onSeen,
  allActivityHref,
  onSeeAll,
}: {
  ownerId: string;
  /** Home's read moved the Timeline's unread mark: clear the sidebar badge. */
  onSeen: () => void;
  allActivityHref: string;
  onSeeAll: () => void;
}) {
  const home = useHome(ownerId, onSeen);
  const wide = useMediaQuery(HOME_WIDE_QUERY);
  const [column, setColumn] = useState<HomeColumn>('recent');

  // Once per visit: Home as the page the Explorer opened on, or reached from elsewhere.
  useEffect(() => {
    track('Home', 'Opened', ARRIVED_ON_HOME ? 'Landing' : 'Nav');
  }, []);

  if (home.status === 'error') {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 py-16 text-center">
        <p className={`text-sm ${MUTED}`}>{HOME_COPY.readFailed}</p>
        <button
          type="button"
          onClick={home.retry}
          className={`rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 ${FOCUS_RING}`}
        >
          {HOME_COPY.tryAgain}
        </button>
      </div>
    );
  }

  const loading = home.status === 'loading';
  const recent = (
    <div aria-busy={loading} className="flex flex-col gap-6">
      <JumpBackIn ownerId={ownerId} items={home.jumpBackIn} loading={loading} />
      <WhatHappened
        groups={home.whatHappened}
        loading={loading}
        allActivityHref={allActivityHref}
        onSeeAll={onSeeAll}
      />
    </div>
  );
  const timeline = (
    <div aria-busy={loading}>
      <HomeTimeline
        ownerId={ownerId}
        entries={home.timeline}
        loading={loading}
        hasMore={home.hasMore}
        paging={home.paging}
        onLoadMore={home.loadMore}
        onRetryMore={home.retryMore}
        labelledBy={TIMELINE_HEADING}
      />
    </div>
  );

  if (wide) {
    return (
      <div className="grid grid-cols-[minmax(0,1fr)_16rem] gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby={RECENT_HEADING} className="min-w-0">
          <h2 id={RECENT_HEADING} className={`mb-3 ${SECTION_HEADING}`}>
            {HOME_COPY.recent}
          </h2>
          {recent}
        </section>
        <section aria-labelledby={TIMELINE_HEADING}>
          <h2 id={TIMELINE_HEADING} className={`mb-3 ${SECTION_HEADING}`}>
            {HOME_COPY.timeline}
          </h2>
          {timeline}
        </section>
      </div>
    );
  }

  return (
    <div>
      <HomeSwitch column={column} onChange={setColumn} />
      <div
        role="tabpanel"
        id={HOME_PANEL_ID}
        aria-labelledby={homeTabId(column)}
        tabIndex={0}
        className={`mt-4 rounded-md ${FOCUS_RING}`}
      >
        <h2 id={column === 'recent' ? RECENT_HEADING : TIMELINE_HEADING} className="sr-only">
          {column === 'recent' ? HOME_COPY.recent : HOME_COPY.timeline}
        </h2>
        {column === 'recent' ? recent : timeline}
      </div>
    </div>
  );
}
