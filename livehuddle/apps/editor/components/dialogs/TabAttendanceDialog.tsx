'use client';

import { useEffect, useState } from 'react';
import {
  ATTENDANCE_RETENTION_DAYS,
  type AttendanceVisit,
  type TabAttendanceResponse,
} from '@livehuddle/api-schema';
import {
  Button,
  DialogCloseButton,
  DialogHeader,
  IDENTITY_FILL,
  PictureDisc,
  identityVars,
} from '@livehuddle/ui';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { initialsOf } from '@/lib/identity';
import { useRelativeNow } from '@/lib/relative-time';
import { groupVisitsByDay, visitLength, visitTimes } from '@/lib/tab-attendance';

// A tab's Attendance (docs/specs/012-collaboration/tab-attendance.md "Where it shows"; blueprint "Presentation and
// UX"): who was in the tab and when, by day, newest first. Opened from the tab menu by an Editor or a Participant;
// read fresh each time it opens.

const TITLE_ID = 'tab-attendance-title';

type Load =
  { state: 'loading' } | { state: 'error' } | { state: 'ready'; visits: AttendanceVisit[] };

type TabAttendanceDialogProps = {
  tabName: string;
  load: () => Promise<TabAttendanceResponse>;
  onClose: () => void;
};

export function TabAttendanceDialog({ tabName, load, onClose }: TabAttendanceDialogProps) {
  const [loaded, setLoaded] = useState<Load>({ state: 'loading' });
  // A visit still open counts its time up while the dialog stays open.
  const now = useRelativeNow();
  // Each read: the first on opening, and one per Try Again (which shows the placeholders again first).
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    load().then(
      (res) => {
        if (live) setLoaded({ state: 'ready', visits: res.visits });
      },
      () => {
        if (live) setLoaded({ state: 'error' });
      },
    );
    return () => {
      live = false;
    };
  }, [load, attempt]);
  const tryAgain = () => {
    setLoaded({ state: 'loading' });
    setAttempt((n) => n + 1);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      titleId={TITLE_ID}
      size="md"
      className="max-h-[min(36rem,calc(100dvh-2rem))]"
    >
      <DialogHeader
        title={<span id={TITLE_ID}>Attendance</span>}
        subtitle={`${tabName} · Last ${ATTENDANCE_RETENTION_DAYS} days`}
      >
        <HelpArticleLink article="tabAttendance" size="md" />
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      <div className="scrollbar-slim flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
        {loaded.state === 'loading' ? <LoadingRows /> : null}
        {loaded.state === 'error' ? (
          <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Couldn&apos;t load attendance.
            </p>
            <Button variant="secondary" size="sm" onClick={tryAgain}>
              Try Again
            </Button>
          </div>
        ) : null}
        {loaded.state === 'ready' && loaded.visits.length === 0 ? (
          <div className="flex flex-col items-center gap-1 py-8 text-center">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Nobody has been in this tab yet.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Visits show here for {ATTENDANCE_RETENTION_DAYS} days.
            </p>
          </div>
        ) : null}
        {loaded.state === 'ready'
          ? groupVisitsByDay(loaded.visits, now).map((day) => (
              <section key={day.key} aria-labelledby={`attendance-day-${day.key}`}>
                <h3
                  id={`attendance-day-${day.key}`}
                  className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                >
                  {day.label}
                </h3>
                <ul className="flex flex-col">
                  {day.visits.map((visit) => (
                    <VisitRow key={visit.id} visit={visit} now={now} />
                  ))}
                </ul>
              </section>
            ))
          : null}
      </div>
    </Dialog>
  );
}

function VisitRow({ visit, now }: { visit: AttendanceVisit; now: number }) {
  const length = visitLength(visit, now);
  const badges = [...(visit.self ? ['You'] : []), ...(visit.guest ? ['Guest'] : [])];
  return (
    <li className="flex items-center gap-3 rounded-lg px-2 py-2">
      <PictureDisc
        as="div"
        size={28}
        pictureUrl={visit.picture ?? null}
        name=""
        aria-hidden
        style={{ ...identityVars(visit.color), fontSize: 11 }}
        className={`shrink-0 font-semibold text-white ${IDENTITY_FILL}`}
      >
        {initialsOf(visit.name)}
      </PictureDisc>
      <div className="min-w-0 flex-1 pl-1">
        <div className="flex flex-wrap items-center gap-1">
          <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
            {visit.name || 'Someone'}
          </span>
          {badges.map((b) => (
            <span
              key={b}
              className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              {b}
            </span>
          ))}
          {visit.leftAt === null ? (
            <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
              Here Now
            </span>
          ) : null}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{visitTimes(visit)}</p>
      </div>
      <span className="shrink-0 text-xs font-medium tabular-nums text-slate-600 dark:text-slate-300">
        <span aria-hidden>{length.short}</span>
        <span className="sr-only">{length.spoken}</span>
      </span>
    </li>
  );
}

// Three placeholder rows while the visits load.
function LoadingRows() {
  return (
    <ul aria-busy="true" aria-label="Loading attendance" className="flex flex-col">
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex items-center gap-3 px-2 py-2">
          <span className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
          <span className="flex flex-1 flex-col gap-1.5 pl-1">
            <span className="h-3 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <span className="h-2.5 w-44 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
          </span>
        </li>
      ))}
    </ul>
  );
}
