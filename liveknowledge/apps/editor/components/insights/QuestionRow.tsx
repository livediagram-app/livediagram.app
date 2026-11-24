'use client';

// A question nobody could answer, as a row of Needs Attention (docs/specs/030-knowledgebase/insights.md
// "Questions nobody could answer"): what Ask, an agent's empty search or its `report_gap` logged, grouped, with how
// often and by whom. Draft a Page and Dismiss are a writer's. A question likely answered in an item of another app
// that isn't connected says so ("Likely answered elsewhere"), with Connect for an Editor.
import type { KnowledgeLikelySource, KnowledgeQuestion } from '@liveknowledge/api-schema';
import { Spinner } from '@/components/palette/template-picker-icons';
import { AppMark, Button, HoverCard } from '@liveknowledge/ui';
import { askedByText } from '@/lib/knowledge-ask/overview-words';
import { DismissIcon } from './insights-icons';
import { INSIGHTS_MUTED } from './InsightsSection';

/** One question nobody could answer, as Needs Attention draws it. */
export function QuestionRow({
  question,
  canDraft,
  canDismiss,
  drafting,
  busy,
  onDraft,
  onDismiss,
  connecting = null,
  onConnect,
}: {
  question: KnowledgeQuestion;
  canDraft: boolean;
  canDismiss: boolean;
  // The question a page is being drafted for now.
  drafting: string | null;
  busy: ReadonlySet<string>;
  onDraft: (question: KnowledgeQuestion) => void;
  onDismiss: (key: string) => void;
  /** The likely item being connected now. */
  connecting?: string | null;
  /** Connect the likely item: an Editor's, absent otherwise. */
  onConnect?: ((likely: KnowledgeLikelySource) => void) | undefined;
}) {
  const likely = question.likely;
  return (
    <div data-question={question.key} className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div className="min-w-0 flex-1 basis-56">
        <p className="break-words text-sm font-medium text-slate-900 dark:text-slate-100">
          {question.question}
        </p>
        <p className={`text-xs ${INSIGHTS_MUTED}`}>{askedByText(question)}</p>
        {likely ? (
          <p
            data-question-likely={likely.app}
            className="mt-1.5 flex items-start gap-1.5 text-xs leading-5 text-slate-700 dark:text-slate-300"
          >
            <AppMark app={likely.app} className="mt-[3px] size-3.5 shrink-0" />
            <span className="min-w-0 flex-1">
              Likely answered in{' '}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {likely.title || 'Untitled'}
              </span>
              , which isn&apos;t connected.
              {onConnect ? (
                <Button
                  variant="ghost"
                  size="xs"
                  busy={connecting === likely.itemId}
                  disabled={connecting !== null && connecting !== likely.itemId}
                  aria-label={`Connect ${likely.title || 'Untitled'}`}
                  onClick={() => onConnect(likely)}
                  className="ml-1 !inline-flex !h-auto !px-1.5 !py-0 align-baseline font-semibold text-brand-700 dark:text-brand-300 phone:min-h-11 phone:-my-3"
                >
                  Connect
                </Button>
              ) : null}
            </span>
          </p>
        ) : null}
      </div>
      {canDraft ? (
        <Button
          variant="secondary"
          size="xs"
          busy={drafting === question.question}
          disabled={drafting !== null && drafting !== question.question}
          onClick={() => onDraft(question)}
          className="shrink-0 gap-1.5 phone:min-h-11"
        >
          {drafting === question.question ? <Spinner /> : null}
          {drafting === question.question ? 'Drafting…' : 'Draft a Page'}
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
