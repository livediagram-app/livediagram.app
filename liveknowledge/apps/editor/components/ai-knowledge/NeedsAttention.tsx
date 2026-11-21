'use client';

// Needs Attention (docs/specs/030-knowledgebase/ai-knowledge.md "The view, as built"): the work waiting for someone
// in one list, most urgent first (attentionItems): pages that disagree, edits agents suggested, questions nobody
// could answer. A switch shows one kind; the figure tiles set it too. At most NEEDS_ATTENTION_CAP rows show until
// Show All. Each row keeps its own actions, gated by role as before.
import { useEffect, type ReactNode } from 'react';
import type {
  KnowledgeOverviewResponse,
  KnowledgeQuestion,
  KnowledgeSuggestion,
} from '@liveknowledge/api-schema';
import { CompactEmptyState, SegmentedToggle } from '@liveknowledge/ui';
import { attentionItems, type AttentionFilter } from '@/lib/knowledge-ask/dashboard-figures';
import {
  AttentionIcon,
  ConflictIcon,
  ConflictSmallIcon,
  QuestionIcon,
  QuestionSmallIcon,
  SuggestionIcon,
  SuggestionSmallIcon,
} from './ai-knowledge-icons';
import { AiSection } from './AiSection';
import { ConflictKeyNote, ConflictRow } from './ConflictRow';
import { QuestionRow } from './QuestionRow';
import { SuggestionRow } from './SuggestionRow';
import { useShowAll } from './useShowAll';

export const NEEDS_ATTENTION_CAP = 4;

const FILTERS = [
  { value: 'all', label: 'All', description: 'Everything waiting, most urgent first.' },
  { value: 'questions', label: 'Questions', description: 'Questions no page could answer.' },
  {
    value: 'conflicts',
    label: 'Disagreements',
    description: 'Pairs of pages that state opposite facts.',
  },
  {
    value: 'suggestions',
    // "Edits", so the four fit a phone's width; its hover card and the tile say the rest.
    label: 'Edits',
    description: "Agents' edits waiting to be accepted or dismissed.",
  },
] as const satisfies readonly { value: AttentionFilter; label: string; description: string }[];

const EMPTY: Record<AttentionFilter, { icon: ReactNode; title: string; description: string }> = {
  all: {
    icon: <AttentionIcon />,
    title: 'Nothing Needs Attention',
    description:
      'Questions nobody could answer, pages that disagree and edits agents suggest land here, most urgent first.',
  },
  questions: {
    icon: <QuestionIcon />,
    title: 'No Unanswered Questions Yet',
    description:
      'One is logged when Ask finds no page that answers, an agent’s search comes back empty, or an agent reports a gap.',
  },
  conflicts: {
    icon: <ConflictIcon />,
    title: 'No Disagreements Yet',
    description:
      'Pages are compared when one is verified or saved. A pair that states opposite facts shows here to settle.',
  },
  suggestions: {
    icon: <SuggestionIcon />,
    title: 'No Suggested Edits Yet',
    description:
      'An agent allowed to suggest edits sends its change here with its reason, to accept or dismiss.',
  },
};

// Each kind's eyebrow: its glyph in its tone and its word.
const KIND: Record<
  'conflict' | 'suggestion' | 'question',
  { icon: ReactNode; word: string; tone: string }
> = {
  conflict: {
    icon: <ConflictSmallIcon />,
    word: 'Pages Disagree',
    tone: 'text-amber-800 dark:text-amber-300',
  },
  suggestion: {
    icon: <SuggestionSmallIcon />,
    word: 'Suggested Edit',
    tone: 'text-brand-700 dark:text-brand-300',
  },
  question: {
    icon: <QuestionSmallIcon />,
    word: 'Unanswered Question',
    tone: 'text-slate-700 dark:text-slate-300',
  },
};

export type NeedsAttentionProps = {
  overview: Pick<KnowledgeOverviewResponse, 'conflicts' | 'suggestions' | 'questions' | 'hasAi'>;
  filter: AttentionFilter;
  onFilter: (filter: AttentionFilter) => void;
  canResolve: boolean;
  canDraft: boolean;
  canManageAi: boolean;
  canAskOwners: boolean;
  busy: ReadonlySet<string>;
  drafting: string | null;
  now: number;
  onOpenPage: (tab: string, block?: string) => void;
  onDismissConflict: (id: string) => void;
  onAskOwners: (id: string) => void;
  onDraft: (question: KnowledgeQuestion) => void;
  onDismissQuestion: (key: string) => void;
  onAccept: (suggestion: KnowledgeSuggestion) => void;
  onDismissSuggestion: (suggestion: KnowledgeSuggestion) => void;
  onOpenAiSettings: () => void;
};

export function NeedsAttention(props: NeedsAttentionProps) {
  const { overview, filter, onFilter, busy, now } = props;
  const items = attentionItems(overview, filter);
  const { shown, toggle, fold } = useShowAll(items, NEEDS_ATTENTION_CAP);
  // Another kind starts folded.
  useEffect(fold, [filter, fold]);
  const total = overview.conflicts.length + overview.suggestions.length + overview.questions.length;
  const empty = EMPTY[filter];
  return (
    <AiSection
      id="ai-attention"
      title="Needs Attention"
      icon={<AttentionIcon />}
      about="What people and agents are waiting on, most urgent first."
      count={total}
      action={
        <SegmentedToggle
          label="Show"
          value={filter}
          onChange={onFilter}
          options={FILTERS}
          className="max-w-full overflow-x-auto [&_button]:whitespace-nowrap"
        />
      }
    >
      {filter === 'conflicts' && !overview.hasAi ? (
        <ConflictKeyNote
          canManageAi={props.canManageAi}
          onOpenAiSettings={props.onOpenAiSettings}
        />
      ) : null}
      {items.length === 0 ? (
        <CompactEmptyState icon={empty.icon} title={empty.title} description={empty.description} />
      ) : (
        <>
          <ul
            className="-my-1 divide-y divide-slate-100 dark:divide-slate-800"
            data-attention-list=""
          >
            {shown.map((item) => {
              const kind = KIND[item.kind];
              return (
                <li
                  key={item.id}
                  data-attention-item={item.kind}
                  className="py-4 first:pt-1 last:pb-1"
                >
                  <p
                    className={`mb-1.5 flex items-center gap-1.5 text-xs font-semibold ${kind.tone}`}
                  >
                    <span aria-hidden className="flex">
                      {kind.icon}
                    </span>
                    {kind.word}
                  </p>
                  {item.kind === 'conflict' ? (
                    <ConflictRow
                      conflict={item.conflict}
                      canResolve={props.canResolve}
                      canAskOwners={props.canAskOwners}
                      busy={busy}
                      now={now}
                      onOpenPage={props.onOpenPage}
                      onDismiss={props.onDismissConflict}
                      onAskOwners={props.onAskOwners}
                    />
                  ) : item.kind === 'suggestion' ? (
                    <SuggestionRow
                      suggestion={item.suggestion}
                      canResolve={props.canResolve}
                      accepting={busy.has(`accept:${item.suggestion.id}`)}
                      dismissing={busy.has(`dismiss:${item.suggestion.id}`)}
                      onAccept={() => props.onAccept(item.suggestion)}
                      onOpenPage={() => props.onOpenPage(item.suggestion.tab)}
                      onDismiss={() => props.onDismissSuggestion(item.suggestion)}
                    />
                  ) : (
                    <QuestionRow
                      question={item.question}
                      canDraft={props.canDraft}
                      canDismiss={props.canResolve}
                      drafting={props.drafting}
                      busy={busy}
                      onDraft={props.onDraft}
                      onDismiss={props.onDismissQuestion}
                    />
                  )}
                </li>
              );
            })}
          </ul>
          {toggle}
        </>
      )}
    </AiSection>
  );
}
