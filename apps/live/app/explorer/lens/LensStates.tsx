'use client';

import { useEffect, useRef, useState } from 'react';
import {
  LENS_SETTLE_MS,
  announceResults,
  issueMessage,
  type LensIssue,
} from '@livediagram/explorer-lens';
import { Button, EmptyState, SearchIcon } from '@livediagram/ui';
import { DocumentIcon } from '@/components/primitives/explorer-icons';

// What a lensed list says when it has nothing to show, or could not load, and what it tells a
// screen reader once typing settles (docs/specs/013-workspace/explorer-filters.md "States").

export const FILTERED_EMPTY_TITLE = 'No documents match these filters';
export const LOAD_FAILED_TITLE = 'Couldn’t load documents';

/**
 * The polite live region that says how many documents the lens left, once the lens has stopped
 * changing for `LENS_SETTLE_MS`. Silent on mount: arriving at a view is not a change.
 */
export function LensAnnouncer({
  input,
  shown,
  total,
  muted = false,
}: {
  input: string;
  shown: number;
  total: number;
  /** Another region speaks for this view (the team library counts its own rows). */
  muted?: boolean;
}) {
  const [message, setMessage] = useState('');
  // The lens the view arrived with; null once it has changed, so changing back speaks too.
  const arrived = useRef<string | null>(input);
  const counts = useRef({ shown, total, muted });
  useEffect(() => {
    counts.current = { shown, total, muted };
  }, [shown, total, muted]);
  useEffect(() => {
    if (input === arrived.current) return;
    arrived.current = null;
    // Read when the lens settles: typing on Home has opened Search results by then.
    const timer = window.setTimeout(() => {
      const { shown, total, muted } = counts.current;
      if (!muted) setMessage(announceResults(shown, total));
    }, LENS_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [input]);
  return (
    <div role="status" aria-live="polite" className="sr-only">
      {message}
    </div>
  );
}

/** Each reported word, as one line: never silent, never dropped. */
export function LensIssues({ issues, id }: { issues: readonly LensIssue[]; id?: string }) {
  if (issues.length === 0) return null;
  return (
    <ul id={id} className="mt-2 flex flex-col gap-0.5 text-xs text-amber-800 dark:text-amber-200">
      {issues.map((issue) => (
        <li key={`${issue.reason}:${issue.start}`}>{issueMessage(issue)}</li>
      ))}
    </ul>
  );
}

/** The lens matched nothing in a view that holds documents. */
export function FilteredEmpty({
  issues,
  onClear,
}: {
  issues: readonly LensIssue[];
  onClear: () => void;
}) {
  return (
    <EmptyState
      icon={<SearchIcon size={20} />}
      title={FILTERED_EMPTY_TITLE}
      description="Change or clear the filters to see more."
    >
      <div className="flex flex-col items-center gap-3">
        <LensIssues issues={issues} />
        <Button size="sm" variant="secondary" onClick={onClear}>
          Clear filters
        </Button>
      </div>
    </EmptyState>
  );
}

/** The view's list could not be read; the lens stays as it was. */
export function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <EmptyState
      icon={<DocumentIcon />}
      title={LOAD_FAILED_TITLE}
      description="Check your connection, then try again."
    >
      <Button size="sm" onClick={onRetry}>
        Try again
      </Button>
    </EmptyState>
  );
}
