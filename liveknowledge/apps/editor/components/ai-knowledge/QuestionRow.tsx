'use client';

// A question nobody could answer, as a row of Needs Attention (docs/specs/030-knowledgebase/ai-knowledge.md
// "Questions nobody could answer"): what Ask, an agent's empty search or its `report_gap` logged, grouped, with how
// often and by whom. Draft a Page and Dismiss are a writer's.
import type { KnowledgeQuestion } from '@liveknowledge/api-schema';
import { Button, HoverCard } from '@liveknowledge/ui';
import { askedByText } from '@/lib/knowledge-ask/overview-words';
import { DismissIcon } from './ai-knowledge-icons';
import { AI_MUTED } from './AiSection';

/** One question nobody could answer, as Needs Attention draws it. */
export function QuestionRow({
  question,
  canDraft,
  canDismiss,
  drafting,
  busy,
  onDraft,
  onDismiss,
}: {
  question: KnowledgeQuestion;
  canDraft: boolean;
  canDismiss: boolean;
  // The question a page is being drafted for now.
  drafting: string | null;
  busy: ReadonlySet<string>;
  onDraft: (question: KnowledgeQuestion) => void;
  onDismiss: (key: string) => void;
}) {
  return (
    <div data-question={question.key} className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div className="min-w-0 flex-1 basis-56">
        <p className="break-words text-sm font-medium text-slate-900 dark:text-slate-100">
          {question.question}
        </p>
        <p className={`text-xs ${AI_MUTED}`}>{askedByText(question)}</p>
      </div>
      {canDraft ? (
        <Button
          variant="secondary"
          size="xs"
          busy={drafting === question.question}
          disabled={drafting !== null && drafting !== question.question}
          onClick={() => onDraft(question)}
          className="shrink-0 phone:min-h-11"
        >
          Draft a Page
        </Button>
      ) : null}
      {canDismiss ? (
        <HoverCard title="Dismiss" description="Removes this question from the list.">
          <Button
            variant="ghost"
            size="xs"
            aria-label={`Dismiss: ${question.question}`}
            busy={busy.has(question.key)}
            onClick={() => onDismiss(question.key)}
            className="shrink-0 !px-2 phone:min-h-11 phone:min-w-11"
          >
            <DismissIcon />
          </Button>
        </HoverCard>
      ) : null}
    </div>
  );
}
