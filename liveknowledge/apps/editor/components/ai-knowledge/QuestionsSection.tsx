'use client';

// Questions Nobody Could Answer (docs/specs/030-knowledgebase/ai-knowledge.md "Questions nobody could answer"):
// what Ask, an agent's empty search or its `report_gap` logged, grouped, with how often and by whom. Draft a Page
// and Dismiss are an Editor's.
import type { KnowledgeQuestion } from '@liveknowledge/api-schema';
import { Button, CompactEmptyState, HoverCard } from '@liveknowledge/ui';
import { askedByText } from '@/lib/knowledge-ask/overview-words';
import { DismissIcon, QuestionIcon } from './ai-knowledge-icons';
import { AI_MUTED, AiSection } from './AiSection';

export function QuestionsSection({
  questions,
  canDraft,
  canDismiss,
  drafting,
  busy,
  onDraft,
  onDismiss,
}: {
  questions: readonly KnowledgeQuestion[];
  canDraft: boolean;
  canDismiss: boolean;
  // The question a page is being drafted for now.
  drafting: string | null;
  busy: ReadonlySet<string>;
  onDraft: (question: KnowledgeQuestion) => void;
  onDismiss: (key: string) => void;
}) {
  return (
    <AiSection
      id="ai-questions"
      title="Questions Nobody Could Answer"
      about="Asked by people or agents, and not covered by any page. Each is a page waiting to be written."
      count={questions.length}
    >
      {questions.length === 0 ? (
        <CompactEmptyState
          icon={<QuestionIcon />}
          title="No Unanswered Questions Yet"
          description="A question the pages do not cover is kept here, with how often it was asked."
        />
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {questions.map((question) => (
            <li
              key={question.key}
              data-question={question.key}
              className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 py-2.5"
            >
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
            </li>
          ))}
        </ul>
      )}
    </AiSection>
  );
}
