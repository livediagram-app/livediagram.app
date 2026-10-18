'use client';

// Explorer Home (docs/specs/013-workspace/explorer-home.md; blueprint
// docs/specs/013-workspace/blueprints/explorer-home-view.md). One column at every width: Jump back
// in, then What Happened, each its own section opened by a display heading, generous space between
// them. The hero above it is the shell's (HomeHero).

import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { track } from '@/lib/telemetry';
import { ARRIVED_ON_HOME } from '@/app/explorer/entry-path';
import { HOME_COPY } from '@/app/explorer/home/home-copy';
import { useHome } from '@/app/explorer/home/useHome';
import { useFirstRun } from '@/app/explorer/home/useFirstRun';
import type { DocumentEntryFor } from '@/app/explorer/useDocumentEntryFor';
import { JumpBackIn } from './JumpBackIn';
import { WhatHappened } from './WhatHappened';
import { FOCUS_RING, MUTED } from './home-styles';
import { GridSkeleton } from './HomeSkeletons';

// The first run's starts (explorer-home.md "First run"), fetched only when a first run draws them: their template
// previews would otherwise weigh on every Home. React.lazy rather than next/dynamic, which registers its module for
// preloading and so would fetch it for everyone.
const HomeWelcome = lazy(() => import('./HomeWelcome').then((m) => ({ default: m.HomeWelcome })));

export function HomePane({
  ownerId,
  onSeen,
  timelineHref,
  onSeeTimeline,
  recentHref,
  onSeeMore,
  importToolbar,
  documentMenus,
}: {
  ownerId: string;
  /** Home's read moved the Timeline feed's unread mark: clear the sidebar badge. */
  onSeen: () => void;
  timelineHref: string;
  onSeeTimeline: () => void;
  recentHref: string;
  onSeeMore: () => void;
  /** The Explorer's Import From control, for the first run's Bring It With You. */
  importToolbar?: ReactNode;
  /** Each Jump Back In document's Explorer ⋯ menu (explorer-home.md "Jump Back In"). */
  documentMenus?: DocumentEntryFor;
}) {
  const home = useHome(ownerId, onSeen);
  const { firstRun, offerSignIn } = useFirstRun();

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

  // Nothing yet: starts in place of Jump Back In and What Happened, which would only be empty.
  if (firstRun) {
    return (
      <Suspense fallback={<GridSkeleton />}>
        <HomeWelcome offerSignIn={offerSignIn} importToolbar={importToolbar} />
      </Suspense>
    );
  }

  const loading = home.status === 'loading';
  return (
    <div className="flex flex-col gap-10">
      <JumpBackIn
        ownerId={ownerId}
        set={home.jumpBackIn}
        loading={loading}
        recentHref={recentHref}
        onSeeMore={onSeeMore}
        documentMenus={documentMenus}
      />
      <WhatHappened
        groups={home.whatHappened}
        loading={loading}
        lastSeenAt={home.lastSeenAt}
        timelineHref={timelineHref}
        onSeeTimeline={onSeeTimeline}
      />
    </div>
  );
}
