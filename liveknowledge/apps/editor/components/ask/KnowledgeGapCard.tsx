'use client';

// A Knowledge Gap (docs/specs/030-knowledgebase/search-and-ask.md "It does not guess"): a part of the question no
// page answers, with the way to start one. Draft a Page From What We Know is an Editor's; "Ask <owner> to Write It"
// waits for the knowledgebase's emails and is not drawn.
import { Spinner } from '@/components/palette/template-picker-icons';
import { Button } from '@liveknowledge/ui';
import { QuestionIcon } from './ask-icons';

export function KnowledgeGapCard({
  question,
  canDraft,
  drafting,
  busy,
  onDraft,
}: {
  question: string;
  canDraft: boolean;
  // This card's page is being drafted.
  drafting: boolean;
  // Another draft is running: one at a time.
  busy: boolean;
  onDraft: () => void;
}) {
  return (
    <section
      aria-label="Knowledge Gap"
      data-knowledge-gap=""
      className="rounded-2xl border border-dashed border-slate-300 p-4 dark:border-slate-700"
    >
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
        <QuestionIcon />
        Knowledge Gap
      </p>
      <p className="mt-2 break-words text-sm font-medium text-slate-900 dark:text-slate-100">
        {question}
      </p>
      <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">No page answers it.</p>
      {canDraft ? (
        <Button
          variant="secondary"
          size="xs"
          className="mt-3 gap-1.5"
          busy={drafting}
          disabled={busy && !drafting}
          onClick={onDraft}
        >
          {drafting ? <Spinner /> : null}
          {drafting ? 'Drafting…' : 'Draft a Page From What We Know'}
        </Button>
      ) : null}
    </section>
  );
}
