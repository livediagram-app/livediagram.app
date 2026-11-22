'use client';

// New Question and the person's chats with this knowledgebase (docs/specs/030-knowledgebase/search-and-ask.md "The
// Ask view"): kept in this browser, grouped Today, This Week and Earlier, then Completed Questions, a group closed by
// default with its count. Pressing a chat opens it; each has Delete at its end, on hover or focus (always on touch).
import { memo, useState } from 'react';
import { Button, CompactEmptyState, HoverCard } from '@liveknowledge/ui';
import {
  chatIdOf,
  completedQuestions,
  groupRecentQuestions,
  type RecentQuestion,
} from '@/lib/knowledge-ask/recent-questions';
import { ChevronIcon, DeleteIcon, NewQuestionIcon, RecentIcon } from './ask-icons';

const HEADING =
  'px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400';

function ChatRow({
  row,
  current,
  canAsk,
  onOpen,
  onDelete,
}: {
  row: RecentQuestion;
  current: boolean;
  canAsk: boolean;
  onOpen: (row: RecentQuestion) => void;
  onDelete: (row: RecentQuestion) => void;
}) {
  return (
    <li
      className={`group relative flex items-center rounded-md motion-safe:transition-colors motion-safe:duration-micro ${
        current
          ? 'bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700'
          : 'hover:bg-slate-200/70 dark:hover:bg-slate-800'
      }`}
    >
      <button
        type="button"
        disabled={!canAsk}
        aria-current={current ? 'true' : undefined}
        onClick={() => onOpen(row)}
        className={`block min-h-8 min-w-0 flex-1 cursor-pointer truncate rounded-md py-1.5 pl-2 pr-9 text-left text-[13px] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-default phone:min-h-11 phone:pr-12 ${
          current
            ? 'font-medium text-slate-900 dark:text-white'
            : 'text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
        }`}
      >
        {row.question}
      </button>
      <span className="absolute right-1 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
        <HoverCard title="Delete" description="Deletes this chat from this browser.">
          <button
            type="button"
            aria-label={`Delete “${row.question}”`}
            data-ask-delete=""
            onClick={() => onDelete(row)}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-2 focus-visible:outline-brand-600 phone:h-11 phone:w-11 dark:text-slate-400 dark:hover:bg-rose-500/15 dark:hover:text-rose-200"
          >
            <DeleteIcon />
          </button>
        </HoverCard>
      </span>
    </li>
  );
}

export const RecentQuestions = memo(function RecentQuestions({
  questions,
  now,
  canAsk,
  open,
  currentId,
  onToggle,
  onNew,
  onOpen,
  onDelete,
}: {
  questions: readonly RecentQuestion[];
  now: number;
  // Asking is on for this session: the rows are buttons. Off, they are the list alone.
  canAsk: boolean;
  // Below the three-column width the list folds under a Recent button; from there up it is always open.
  open: boolean;
  /** The chat the conversation shows. */
  currentId: string | null;
  onToggle: () => void;
  onNew: () => void;
  onOpen: (row: RecentQuestion) => void;
  onDelete: (row: RecentQuestion) => void;
}) {
  const groups = groupRecentQuestions(questions, now);
  const completed = completedQuestions(questions);
  // Closed by default, as an accordion is.
  const [completedOpen, setCompletedOpen] = useState(false);
  const row = (r: RecentQuestion) => (
    <ChatRow
      key={chatIdOf(r)}
      row={r}
      current={chatIdOf(r) === currentId}
      canAsk={canAsk}
      onOpen={onOpen}
      onDelete={onDelete}
    />
  );
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
        {groups.length === 0 && completed.length === 0 ? (
          <CompactEmptyState
            icon={<RecentIcon />}
            title="No Recent Questions"
            description="What you ask here is kept in this browser, for you alone."
          />
        ) : (
          groups.map((group) => (
            <section key={group.label} aria-label={group.label}>
              <h2 className={HEADING}>{group.label}</h2>
              <ul className="mt-1 flex flex-col">{group.questions.map(row)}</ul>
            </section>
          ))
        )}
        {completed.length > 0 ? (
          <section aria-label="Completed Questions" data-ask-completed="">
            <h2>
              <button
                type="button"
                aria-expanded={completedOpen}
                onClick={() => setCompletedOpen((was) => !was)}
                className={`${HEADING} flex min-h-8 w-full cursor-pointer items-center gap-1.5 rounded-md hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-600 phone:min-h-11 dark:hover:text-white`}
              >
                <span
                  aria-hidden
                  className={`flex motion-safe:transition-transform motion-safe:duration-short ${completedOpen ? 'rotate-90' : ''}`}
                >
                  <ChevronIcon />
                </span>
                Completed Questions
                <span className="ml-auto rounded-full bg-slate-200 px-1.5 py-px text-[11px] font-semibold normal-case tracking-normal tabular-nums text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {completed.length}
                </span>
              </button>
            </h2>
            {completedOpen ? <ul className="mt-1 flex flex-col">{completed.map(row)}</ul> : null}
          </section>
        ) : null}
      </div>
    </div>
  );
});
