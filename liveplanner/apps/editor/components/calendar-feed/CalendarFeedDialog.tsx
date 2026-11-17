'use client';

// Subscribe to Calendar (docs/specs/026-plan/calendar-feed.md "The dialog"; blueprint calendar-feed.md "Part 2"): the
// person's own feed of this plan, read fresh when it opens, in one of three states. Off: the options and Make
// Calendar Link. Just made: the link, shown this once, to copy or hand to a calendar. On: when the link was made,
// Reset Link and Turn Off, each behind a confirm. The options sit under every state: in Off they are what the link
// is made with; once a feed exists a change saves at once and keeps the link. The privacy note is always there.
// The same dialog serves the My Work feed ("The My Work feed"): the person's own cards across plans, with no options.
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type {
  CalendarFeedType,
  CalendarFeedOptions,
  CalendarFeedSettings,
} from '@liveplanner/api-schema';
import { Button, ConfirmPopover, lucideGlyph } from '@liveplanner/ui';
import { SkeletonRows } from '@liveworkspace/ui';
import { MEDIUM_DATE } from '@liveworkspace/ui/date-format';
import { ToolExplainer } from '@liveworkspace/ui/tool-explainer';
import { calendarFeedArt } from '@liveworkspace/ui/tool-explainer-art';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { lucideLock } from '@liveworkspace/icons/lucide';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { DialogFooter } from '@liveworkspace/workbench/components/dialogs/DialogFooter';
import { API_BASE } from '@/lib/api/core';
import { track } from '@/lib/telemetry';
import {
  changeCalendarFeed,
  issueCalendarFeed,
  issueMyWorkCalendarFeed,
  readCalendarFeed,
  readMyWorkCalendarFeed,
  turnOffCalendarFeed,
  turnOffMyWorkCalendarFeed,
} from './calendar-feed-client';
import type { CalendarFeedScope } from './calendar-feed-gate';
import { feedUrlOf } from './calendar-feed-links';
import { calendarFeedHeroArt } from './CalendarFeedHeroArt';
import { CalendarFeedLink } from './CalendarFeedLink';
import { CalendarFeedOptionsSection } from './CalendarFeedOptions';

const LockIcon = lucideGlyph(lucideLock, 14);

// The Off state's line, per kind of feed.
const PLAN_OFF_COPY =
  'Every card with a Start or Due date, as an all-day event that opens the card.';
const MY_WORK_OFF_COPY =
  'Every open card assigned to you, in any plan you own or share with a team, on its Start or Due date.';

export const DEFAULT_FEED_OPTIONS: CalendarFeedOptions = {
  typeIds: null,
  mine: false,
  includeDone: false,
};

const optionsOf = (feed: CalendarFeedSettings): CalendarFeedOptions => ({
  typeIds: feed.typeIds,
  boardId: feed.boardId ?? null,
  mine: feed.mine,
  includeDone: feed.includeDone,
});

/** Which feed the dialog manages: a plan's, or the person's My Work feed. */
export type CalendarFeedTarget =
  { kind: 'plan'; scope: CalendarFeedScope } | { kind: 'my-work'; ownerId: string };

type Loaded = { feed: CalendarFeedSettings | null; types: CalendarFeedType[] };

// The My Work feed as the dialog holds it: no options of its own, so the defaults stand in.
const myWorkLoaded = (feed: { createdAt: number } | null): Loaded => ({
  feed: feed ? { ...DEFAULT_FEED_OPTIONS, createdAt: feed.createdAt } : null,
  types: [],
});

async function readFeed(target: CalendarFeedTarget): Promise<Loaded> {
  if (target.kind === 'plan') return readCalendarFeed(target.scope);
  return myWorkLoaded((await readMyWorkCalendarFeed(target.ownerId)).feed);
}

async function issueFeed(
  target: CalendarFeedTarget,
  options: CalendarFeedOptions,
): Promise<{ feed: CalendarFeedSettings; path: string }> {
  if (target.kind === 'plan') return issueCalendarFeed(target.scope, options);
  const made = await issueMyWorkCalendarFeed(target.ownerId);
  return { feed: { ...DEFAULT_FEED_OPTIONS, createdAt: made.feed.createdAt }, path: made.path };
}

const turnOffFeed = (target: CalendarFeedTarget) =>
  target.kind === 'plan'
    ? turnOffCalendarFeed(target.scope)
    : turnOffMyWorkCalendarFeed(target.ownerId);
// The confirm open over Reset Link or Turn Off, anchored to the button that opened it.
type Confirming = { kind: 'reset' | 'off'; anchor: HTMLElement } | null;

export function CalendarFeedDialog({
  target,
  onClose,
}: {
  target: CalendarFeedTarget;
  onClose: () => void;
}) {
  const myWork = target.kind === 'my-work';
  const titleId = useId();
  const [data, setData] = useState<Loaded | null>(null);
  const [readFailed, setReadFailed] = useState(false);
  const [options, setOptions] = useState<CalendarFeedOptions>(DEFAULT_FEED_OPTIONS);
  // The link, the one time it is shown: never stored, so closing forgets it and reopening shows On.
  const [madeUrl, setMadeUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const makeRef = useRef<HTMLButtonElement>(null);
  const copyRef = useRef<HTMLButtonElement>(null);
  // The keyboard follows a state change it caused (the button pressed goes): set by a press here, taken once.
  const focusNext = useRef<'copy' | 'make' | null>(null);

  const read = useCallback(async () => {
    try {
      const loaded = await readFeed(target);
      setData(loaded);
      if (loaded.feed) setOptions(optionsOf(loaded.feed));
    } catch {
      setReadFailed(true);
    }
  }, [target]);
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- a fetch from the api: its state lands after the await, never synchronously
    void read();
  }, [read]);

  const state = !data ? null : data.feed === null ? 'off' : madeUrl ? 'made' : 'on';
  // In the commit that shows the new state, not a passive effect after it: a passive effect runs in a later task, by
  // when a press the person already made (Copy Link failing over to the field) has moved focus, and it took it back.
  useLayoutEffect(() => {
    const next = focusNext.current;
    if (!next) return;
    focusNext.current = null;
    (next === 'copy' ? copyRef : makeRef).current?.focus();
  }, [state]);

  async function issue(reset: boolean) {
    setConfirming(null);
    setBusy(true);
    setSaveFailed(false);
    try {
      const made = await issueFeed(target, options);
      // Each a literal pair and type, for the telemetry coverage tests.
      if (myWork) {
        if (reset) track('Plan', 'Changed', 'MyWorkCalendarFeedLink');
        else track('Plan', 'Created', 'MyWorkCalendarFeed');
      } else if (reset) track('Plan', 'Changed', 'CalendarFeedLink');
      else track('Plan', 'Created', 'CalendarFeed');
      focusNext.current = 'copy';
      setData((d) => (d ? { ...d, feed: made.feed } : d));
      setMadeUrl(feedUrlOf(made.path, API_BASE, window.location.href));
    } catch {
      setSaveFailed(true);
    }
    setBusy(false);
  }

  async function turnOff() {
    setConfirming(null);
    setBusy(true);
    setSaveFailed(false);
    try {
      await turnOffFeed(target);
      if (myWork) track('Plan', 'Ended', 'MyWorkCalendarFeed');
      else track('Plan', 'Ended', 'CalendarFeed');
      focusNext.current = 'make';
      setData((d) => (d ? { ...d, feed: null } : d));
      setMadeUrl(null);
    } catch {
      setSaveFailed(true);
    }
    setBusy(false);
  }

  // A choice in Off waits for Make Calendar Link; once a feed exists it saves at once, keeping the link, and goes
  // back if the save fails.
  async function choose(next: CalendarFeedOptions) {
    const before = options;
    setOptions(next);
    setSaveFailed(false);
    if (!data?.feed || target.kind !== 'plan') return;
    try {
      const changed = await changeCalendarFeed(target.scope, next);
      track('Plan', 'Changed', 'CalendarFeedOptions');
      setData((d) => (d ? { ...d, feed: changed.feed } : d));
    } catch {
      setOptions(before);
      setSaveFailed(true);
    }
  }

  return (
    <Dialog open onClose={onClose} titleId={titleId} size="md" phoneSheet>
      <HeroDialogHeader
        art={calendarFeedHeroArt}
        titleId={titleId}
        title="Subscribe to Calendar"
        subtitle={myWork ? 'Your cards in your own calendar.' : 'Card dates in your own calendar.'}
        onClose={onClose}
      />
      <div
        className="flex flex-col gap-4 px-4 py-4 sm:px-6"
        data-calendar-feed-state={state ?? (readFailed ? 'error' : 'loading')}
      >
        {state === null ? (
          readFailed ? (
            <div className="flex items-center justify-between gap-3">
              <p role="alert" className="text-sm text-slate-700 dark:text-slate-200">
                Couldn’t load your calendar link.
              </p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setReadFailed(false);
                  void read();
                }}
              >
                Try Again
              </Button>
            </div>
          ) : (
            <SkeletonRows label="Loading your calendar link" rows={2} />
          )
        ) : (
          <>
            {state === 'off' ? (
              // The tool's explainer (footer-tools-menu.md "Explainers"): no link yet.
              <ToolExplainer
                art={calendarFeedArt}
                title={myWork ? 'Your Work in Your Calendar' : 'This Plan in Your Calendar'}
                description={myWork ? MY_WORK_OFF_COPY : PLAN_OFF_COPY}
                steps={[
                  'Make your private link.',
                  'Add it to Google Calendar, Outlook or Apple Calendar, once.',
                  'Dated cards show as all-day events, kept up to date.',
                ]}
                data="calendar-feed"
              />
            ) : null}
            {state === 'made' && madeUrl ? (
              <CalendarFeedLink ref={copyRef} url={madeUrl} myWork={myWork} />
            ) : null}
            {state === 'on' && data?.feed ? (
              <p className="text-sm text-slate-700 dark:text-slate-200">
                Your calendar link is on. Made {MEDIUM_DATE.format(data.feed.createdAt)}.
              </p>
            ) : null}
            {myWork ? null : (
              <CalendarFeedOptionsSection
                types={data?.types ?? []}
                options={options}
                disabled={busy}
                onChange={(next) => void choose(next)}
              />
            )}
            <p
              className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-900"
              data-calendar-feed-privacy=""
            >
              <span className="mt-0.5 shrink-0" aria-hidden>
                <LockIcon />
              </span>
              <span>
                Anyone with this link can see the titles and dates of the cards in this feed. Don’t
                share it or post it anywhere. If it leaks, press Reset Link: the old link stops at
                once.
              </span>
            </p>
            {saveFailed ? (
              <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">
                Couldn’t save. Try again.
              </p>
            ) : null}
          </>
        )}
      </div>
      <DialogFooter>
        {state === 'off' ? (
          <Button ref={makeRef} size="sm" busy={busy} onClick={() => void issue(false)}>
            Make Calendar Link
          </Button>
        ) : null}
        {state === 'on' ? (
          <>
            <Button
              variant="secondary"
              size="sm"
              busy={busy}
              onClick={(e) => setConfirming({ kind: 'off', anchor: e.currentTarget })}
            >
              Turn Off
            </Button>
            <Button
              variant="secondary"
              size="sm"
              busy={busy}
              onClick={(e) => setConfirming({ kind: 'reset', anchor: e.currentTarget })}
            >
              Reset Link
            </Button>
          </>
        ) : null}
        {state === 'made' ? (
          <Button variant="secondary" size="sm" onClick={onClose}>
            Done
          </Button>
        ) : null}
      </DialogFooter>
      {confirming?.kind === 'reset' ? (
        <ConfirmPopover
          anchor={confirming.anchor}
          message="Make a new link?"
          warning="The old one stops working at once, so calendars using it stop updating until you add the new one."
          confirmLabel="Reset Link"
          onConfirm={() => void issue(true)}
          onCancel={() => setConfirming(null)}
        />
      ) : null}
      {confirming?.kind === 'off' ? (
        <ConfirmPopover
          anchor={confirming.anchor}
          message="Turn off your calendar link?"
          warning="Calendars using it stop updating."
          confirmLabel="Turn Off"
          onConfirm={() => void turnOff()}
          onCancel={() => setConfirming(null)}
        />
      ) : null}
    </Dialog>
  );
}
