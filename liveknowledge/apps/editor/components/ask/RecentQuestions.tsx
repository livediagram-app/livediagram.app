'use client';

// New Question and the person's recent questions for this knowledgebase (docs/specs/030-knowledgebase/
// search-and-ask.md "Scope"): kept in this browser, grouped Today, This Week and Earlier. Pressing one asks it
// again as a new question.
import { memo } from 'react';
import { Button, CompactEmptyState } from '@liveknowledge/ui';
import { groupRecentQuestions, type RecentQuestion } from '@/lib/knowledge-ask/recent-questions';
import { NewQuestionIcon, RecentIcon } from './ask-icons';

export const RecentQuestions = memo(function RecentQuestions({
  questions,
  now,
  canAsk,
  open,
  onToggle,
  onNew,
  onAsk,
}: {
  questions: readonly RecentQuestion[];
  now: number;
  // Asking is on for this session: the rows are buttons. Off, they are the list alone.
  canAsk: boolean;
  // Below the three-column width the list folds under a Recent button; from there up it is always open.
  open: boolean;
  onToggle: () => void;
  onNew: () => void;
  onAsk: (question: string) => void;
}) {
  const groups = groupRecentQuestions(questions, now);
  return (
    <div data-ask-recent="" className="flex flex-col gap-4 p-4">
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={!canAsk}
          onClick={onNew}
          className="min-w-0 flex-1 justify-center phone:min-h-11"
        >
          <NewQuestionIcon />
          New Question
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={open}
          onClick={onToggle}
          className="shrink-0 phone:min-h-11 lg:hidden"
        >
          <RecentIcon />
          Recent
        </Button>
      </div>
      <div className={`${open ? 'flex' : 'hidden lg:flex'} flex-col gap-4`} data-ask-recent-list="">
        {groups.length === 0 ? (
          <CompactEmptyState
            icon={<RecentIcon />}
            title="No Recent Questions"
            description="What you ask here is kept in this browser, for you alone."
          />
        ) : (
          groups.map((group) => (
            <section key={group.label} aria-label={group.label}>
              <h2 className="px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                {group.label}
              </h2>
              <ul className="mt-1 flex flex-col">
                {group.questions.map((row) => (
                  <li key={`${row.askedAt}:${row.question}`}>
                    <button
                      type="button"
                      disabled={!canAsk}
                      onClick={() => onAsk(row.question)}
                      className="block min-h-8 w-full cursor-pointer truncate rounded-md px-2 py-1.5 text-left text-[13px] text-slate-700 motion-safe:transition-colors motion-safe:duration-micro hover:bg-slate-200/70 hover:text-slate-900 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-default disabled:hover:bg-transparent phone:min-h-11 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                    >
                      {row.question}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
});
