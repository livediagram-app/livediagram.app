'use client';

// The Share dialog's Team tab (one-explorer-contracts.md "Sharing and access", Work Tracker 1338): an item in a team
// opens here, since everyone in the team can already open it and needs no pass. It says so, hands over the item's
// own address (the link a member opens, which grants nothing: someone outside the team who opens it sees Not Found)
// with Copy Link, and points the way to Passes for anyone outside the team, in one click.

import { useEffect, useRef, useState } from 'react';
import { Button } from '@liveworkspace/ui';
import { Callout } from '@liveworkspace/ui/callout';
import { CheckIcon, CopyIcon, LinkIcon } from '../../ui/icons';
import { writeClipboard } from './CopyMenu';
import { SECTION_LABEL } from './parts';

// How long Copy Link says "Copied".
const COPIED_MS = 1500;

export function TeamPanel({
  url,
  teamName = null,
  word,
  onPasses,
  notify,
}: {
  // The item's own address in its app.
  url: string;
  // The team's name, when the host knows it; "the team" otherwise.
  teamName?: string | null;
  // The item's kind, lower case ("plan").
  word: string;
  onPasses: () => void;
  notify: (text: string, tone: 'success' | 'info' | 'error') => void;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const team = teamName ? teamName : 'the team';
  const copy = async () => {
    if (!(await writeClipboard(url))) {
      notify('Couldn’t copy the link. Select it to copy it yourself.', 'error');
      return;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_MS);
  };

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="share-team-heading" className="flex flex-col gap-3">
        <Callout
          tone="success"
          size="md"
          role="note"
          title={
            <h3 id="share-team-heading">
              {teamName
                ? `Everyone in ${teamName} can already open this ${word}`
                : `Everyone in the team can already open this ${word}`}
            </h3>
          }
        >
          {`It lives in ${team}’s space, so members need no pass. Send them its link and they open it as Editors.`}
        </Callout>
      </section>

      <section aria-labelledby="share-team-link" className="flex flex-col gap-2">
        <p id="share-team-link" className={SECTION_LABEL}>
          Link for the team
        </p>
        <div className="flex min-w-0 items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
              <LinkIcon size={13} />
            </span>
            <input
              readOnly
              value={url}
              aria-label={`Link to this ${word}`}
              onFocus={(e) => e.currentTarget.select()}
              className="h-9 w-full truncate rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-2 font-mono text-xs text-slate-700 outline-none transition duration-micro focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-brand-500/20"
            />
          </div>
          <Button onClick={() => void copy()} className="h-9 shrink-0 whitespace-nowrap shadow-sm">
            <span aria-hidden className="flex">
              {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
            </span>
            {copied ? 'Copied' : 'Copy Link'}
          </Button>
        </div>
        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          The link grants nothing by itself: anyone outside the team who opens it sees Not Found.
        </p>
      </section>

      <section
        aria-labelledby="share-team-outside"
        className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center dark:border-slate-800"
      >
        <div className="min-w-0 flex-1">
          <p
            id="share-team-outside"
            className="text-sm font-medium text-slate-800 dark:text-slate-100"
          >
            Sharing with someone outside the team?
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Issue them a pass: pick their role, how long it lasts, and who can use it.
          </p>
        </div>
        <Button variant="secondary" onClick={onPasses} className="shrink-0 whitespace-nowrap">
          Share With Someone Outside the Team
        </Button>
      </section>
    </div>
  );
}
