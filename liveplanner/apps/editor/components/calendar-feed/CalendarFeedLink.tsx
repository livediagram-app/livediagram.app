'use client';

// Subscribe to Calendar's Just made state (docs/specs/026-plan/calendar-feed.md "The dialog"): the link in a read-only
// field with Copy Link, Google Calendar and Apple Calendar, the Outlook line, and the shown-once line. The link lives
// only here, for as long as the dialog is open: the plan keeps its hash, never the link.
import { forwardRef, useId } from 'react';
import { Button, ButtonContent, buttonClassName, useCopiedFlash } from '@liveplanner/ui';
import { track } from '@/lib/telemetry';
import { appleCalendarUrl, googleCalendarUrl } from './calendar-feed-links';

const LINK_FIELD =
  'w-full min-w-0 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';

const CALENDAR_LINK = buttonClassName({ variant: 'secondary', size: 'xs' });

export const CalendarFeedLink = forwardRef<HTMLButtonElement, { url: string }>(
  function CalendarFeedLink({ url }, copyRef) {
    const fieldId = useId();
    const { copied, flash } = useCopiedFlash(1800);
    async function copy() {
      try {
        await navigator.clipboard.writeText(url);
        flash();
        track('Plan', 'Copied', 'CalendarFeed');
      } catch {
        // No clipboard (an insecure context, a refused permission): the field is selected to copy by hand.
        const field = document.getElementById(fieldId) as HTMLInputElement | null;
        field?.focus();
        field?.select();
      }
    }
    return (
      <div className="flex flex-col gap-2.5" data-calendar-feed-link="">
        <div className="flex items-center gap-2">
          <input
            id={fieldId}
            readOnly
            aria-label="Calendar link"
            value={url}
            spellCheck={false}
            onFocus={(e) => e.currentTarget.select()}
            className={LINK_FIELD}
          />
          <Button ref={copyRef} size="sm" onClick={() => void copy()} className="shrink-0">
            {copied ? 'Copied' : 'Copy Link'}
          </Button>
        </div>
        <span role="status" className="sr-only">
          {copied ? 'Calendar link copied' : ''}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-600 dark:text-slate-300">Add it to</span>
          <a
            href={googleCalendarUrl(url)}
            target="_blank"
            rel="noopener noreferrer"
            className={CALENDAR_LINK}
            onClick={() => track('Plan', 'Shared', 'CalendarFeedGoogle')}
          >
            <ButtonContent>Google Calendar</ButtonContent>
          </a>
          <a
            href={appleCalendarUrl(url)}
            className={CALENDAR_LINK}
            onClick={() => track('Plan', 'Shared', 'CalendarFeedApple')}
          >
            <ButtonContent>Apple Calendar</ButtonContent>
          </a>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300">
          In Outlook, choose Add Calendar, then Subscribe from Web, and paste the link.
        </p>
        <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
          This is the only time the link is shown. Copy it now: if you lose it, Reset Link makes a
          new one.
        </p>
      </div>
    );
  },
);
