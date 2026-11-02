'use client';

// A thread's title, renamed in place (docs/specs/026-plan/items.md "Where it shows"): the title becomes a field with
// its text selected; Enter or leaving the field keeps it, Escape leaves it as it was, and an emptied title goes back
// to the automatic one (the api works it out again from the starter's name and first comment).

import { useEffect, useRef, useState } from 'react';
import { THREAD_TITLE_MAX } from '@liveplanner/project';

export function ThreadTitleEditor({
  title,
  onDone,
}: {
  title: string;
  // The new title ('' for the automatic one), or null when cancelled.
  onDone: (title: string | null) => void;
}) {
  const [draft, setDraft] = useState(title);
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const finish = (value: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(value === null ? null : value.replace(/\s+/g, ' ').trim());
  };
  return (
    <input
      ref={ref}
      value={draft}
      maxLength={THREAD_TITLE_MAX}
      aria-label="Thread title"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => finish(draft)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          finish(draft);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          finish(null);
        }
      }}
      className="min-w-0 flex-1 rounded-md border border-brand-300 bg-white px-2 py-1 text-[13px] font-semibold text-slate-900 outline-none ring-2 ring-brand-400/30 dark:border-brand-500/60 dark:bg-slate-800 dark:text-slate-50"
    />
  );
}
