'use client';

// A new thread's starter (docs/specs/026-plan/items.md "Where it shows"): the composer at the top of the list with
// your avatar, "Start a thread…", the title the thread will get shown live under the field, and Cancel and Start
// Thread. Escape cancels; ⌘ or Ctrl Enter starts it.

import { useEffect, useRef, useState } from 'react';
import { autoThreadTitle, type CommentMention } from '@liveplanner/project';
import { CommentComposer } from '@/components/panels/comment-thread-parts';
import { titlePreview } from './thread-words';

export function ThreadStarter({
  self,
  onStart,
  onCancel,
}: {
  self: { name: string; color: string } | null;
  onStart: (text: string, mentions: CommentMention[]) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState('');
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    field.current?.focus();
  }, []);
  const preview = draft.trim() ? autoThreadTitle(self?.name ?? '', draft) : '';
  return (
    <div
      data-thread-starter=""
      className="animate-card-rise rounded-xl border border-brand-200 bg-brand-50/40 p-3 motion-reduce:animate-none dark:border-brand-500/30 dark:bg-brand-500/5"
    >
      <CommentComposer
        density="comfortable"
        self={self}
        fieldRef={field}
        placeholder="Start a thread…"
        fieldLabel="Start a thread"
        submitLabel="Start Thread"
        onCancel={onCancel}
        onDraft={setDraft}
        onAddComment={onStart}
        className="relative flex gap-2.5"
        below={
          <p
            aria-live="polite"
            // No room taken until there is a title to show, so the row sits close under the field, as a reply's does.
            className="mt-1 truncate text-[11px] text-slate-500 empty:mt-0 dark:text-slate-400"
          >
            {preview ? titlePreview(preview) : ''}
          </p>
        }
      />
    </div>
  );
}
