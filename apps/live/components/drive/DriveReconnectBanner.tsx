'use client';

// The quiet banner for a paused mirror (docs/specs/022-drive-mirror/drive-mirror.md,
// "Tokens"): Google stopped accepting the grant (**Reconnect**), or a
// browser-only token lapsed (**Resume sync**). Bottom-left, dismissible for
// the session (D10). Nothing is deleted either way.

import { useState } from 'react';
import { CloseIcon } from '@livediagram/ui';
import { useDriveMirror } from './drive-mirror-context';

const DISMISS_KEY = 'livediagram:v2:drive-banner-dismissed';

export function DriveReconnectBanner() {
  const { status, connect, resume } = useDriveMirror();
  const [dismissed, setDismissed] = useState(() =>
    typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(DISMISS_KEY) === '1' : false,
  );
  const reconnect = status.state === 'needs_reconnect';
  const resumeSync = status.state === 'needs_resume';
  if (dismissed || (!reconnect && !resumeSync)) return null;
  return (
    <div
      role="status"
      className="fixed bottom-16 left-3 z-[var(--z-chrome)] flex max-w-[22rem] items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:shadow-black/30"
    >
      <span className="min-w-0 flex-1">Google Drive sync is paused.</span>
      <button
        type="button"
        onClick={() => void (reconnect ? connect() : resume())}
        className="shrink-0 rounded-md px-2 py-1 font-medium text-brand-700 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-slate-800"
      >
        {reconnect ? 'Reconnect' : 'Resume sync'}
      </button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          sessionStorage.setItem(DISMISS_KEY, '1');
          setDismissed(true);
        }}
        className="shrink-0 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
      >
        <CloseIcon />
      </button>
    </div>
  );
}
