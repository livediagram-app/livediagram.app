'use client';

// The comment threads at a page's foot, after Linked From (docs/specs/030-knowledgebase/page-comments.md): a Comments
// heading in small capitals with the open count, the open threads oldest first, the resolved ones folded under
// "2 Resolved", then a composer to start one. A writer with no threads sees the composer under an empty state; a
// Viewer with none sees nothing at all. Outside the writing: never in the draft, search or what agents read of it.
import { useMemo, useState } from 'react';
import { lucideGlyph } from '@liveknowledge/ui';
import { lucidePlus } from '@liveworkspace/icons/lucide';
import type { PageThread, PageThreadChange } from '@liveknowledge/api-schema';
import { useRelativeNow } from '@/lib/relative-time';
import { useEditorChrome } from '@/app/document/[id]/EditorContext';
import { CommentsIcon } from '@/components/knowledge/approval/feedback-icons';
import { PageCommentComposer } from './PageCommentComposer';
import { PageThreadCard } from './PageThreadCard';
import { usePageComments } from './usePageComments';

const PlusIcon = lucideGlyph(lucidePlus, 14);

export type PageCommentsViewProps = {
  status: 'loading' | 'ready' | 'failed';
  threads: readonly PageThread[];
  canWrite: boolean;
  ownKey: string | null;
  now: number;
  change: (change: PageThreadChange) => Promise<boolean>;
  /** The writer, for the composer's disc. */
  me?: { name: string; color: string } | undefined;
};

export function PageCommentsView({
  status,
  threads,
  canWrite,
  ownKey,
  now,
  change,
  me,
}: PageCommentsViewProps) {
  // A new thread's composer, opened from Start a New Thread while there are threads to reply to.
  const [starting, setStarting] = useState(false);
  const { open, resolved } = useMemo(
    () => ({
      open: threads.filter((t) => !t.resolved),
      resolved: threads.filter((t) => t.resolved),
    }),
    [threads],
  );
  // Nothing drawn before the read lands (the foot holds no skeleton), nor for a reader with nothing to read.
  if (status === 'loading') return null;
  if (!canWrite && threads.length === 0) return null;
  const card = (thread: PageThread) => (
    <PageThreadCard
      key={thread.id}
      thread={thread}
      ownKey={ownKey}
      canWrite={canWrite}
      now={now}
      change={change}
      me={me}
    />
  );
  return (
    <section
      aria-labelledby="page-comments-heading"
      data-page-comments=""
      // After Linked From's rule, a breath apart; first in the foot, flush.
      className="mt-8 font-sans first:mt-0 motion-safe:animate-fade-in"
    >
      <h2
        id="page-comments-heading"
        className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
      >
        Comments
        {open.length > 0 ? (
          <span
            data-open-count=""
            className="rounded-full bg-slate-100 px-1.5 py-px text-[11px] font-semibold tabular-nums tracking-normal text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          >
            {open.length}
          </span>
        ) : null}
      </h2>
      <div className="mt-3 flex flex-col gap-3">
        {open.map(card)}
        {resolved.length > 0 ? (
          <details data-resolved-threads="" className="group/resolved">
            <summary className="flex min-h-8 cursor-pointer list-none items-center gap-1.5 rounded-md text-[13px] font-medium text-slate-600 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-600 phone:min-h-11 dark:text-slate-400 dark:hover:text-slate-100 [&::-webkit-details-marker]:hidden">
              <span
                aria-hidden
                className="inline-block transition-transform group-open/resolved:rotate-90 motion-reduce:transition-none"
              >
                ›
              </span>
              {resolved.length} Resolved
            </summary>
            <div className="mt-2 flex flex-col gap-3">{resolved.map(card)}</div>
          </details>
        ) : null}
        {canWrite ? (
          <>
            {/* No threads yet: no empty-state box, one quiet line and the composer resting as a line beside the
                writer's disc (owner 2026-11-21: "make it amazing"). */}
            {threads.length === 0 ? (
              <p
                data-comments-empty=""
                className="-mt-1 flex items-center gap-1.5 text-[13px] text-slate-500 dark:text-slate-400"
              >
                <CommentsIcon />
                Questions, corrections and context for this page go here.
              </p>
            ) : null}
            {threads.length === 0 || starting ? (
              <PageCommentComposer
                placeholder={
                  threads.length === 0
                    ? 'Start the conversation about this page…'
                    : 'Start a new thread…'
                }
                submitLabel="Comment"
                label="Add a comment"
                me={me}
                autoFocus={starting}
                {...(starting ? { onCancel: () => setStarting(false) } : {})}
                onSubmit={async (text) => {
                  const done = await change({ op: 'start', text });
                  if (done) setStarting(false);
                  return done;
                }}
              />
            ) : (
              // With threads to answer, a new one is a quiet second choice: replying sits in each thread
              // (owner 2026-11-21: the UI led people to start threads rather than reply).
              <button
                type="button"
                data-start-thread=""
                onClick={() => setStarting(true)}
                className="flex min-h-9 cursor-pointer items-center gap-1.5 self-start rounded-lg px-2 text-[13px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-brand-600 phone:min-h-11 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <PlusIcon />
                Start a New Thread
              </button>
            )}
          </>
        ) : null}
        {status === 'failed' ? (
          <p role="status" className="text-[13px] text-slate-500 dark:text-slate-400">
            The comments could not be loaded. Open the page again to retry.
          </p>
        ) : null}
      </div>
    </section>
  );
}

/** The current page's comments, from the editor's stores. */
export function PageComments() {
  const view = usePageComments();
  const now = useRelativeNow();
  const name = useEditorChrome((s) => s.selfParticipant.name);
  const color = useEditorChrome((s) => s.selfParticipant.color);
  const me = useMemo(() => ({ name: name || 'Guest', color }), [name, color]);
  if (view.hidden) return null;
  return (
    <PageCommentsView
      // Keyed by page, so a half-written comment never carries to the next page.
      key={view.pageId}
      status={view.entry.status}
      threads={view.entry.threads}
      canWrite={view.canWrite}
      ownKey={view.ownKey}
      now={now}
      change={view.change}
      me={me}
    />
  );
}
