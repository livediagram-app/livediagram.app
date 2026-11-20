'use client';

// Edits Suggested by Agents (docs/specs/030-knowledgebase/ai-knowledge.md "Edits suggested by agents"): an agent
// with Suggests Edits never changes a page; its edit waits here with its reason, as the lines it takes out and puts
// in. Accept applies it as one undo step in the acceptor's name and does not verify the page. The lines are text.
import type { KnowledgeSuggestion } from '@liveknowledge/api-schema';
import { Button, CompactEmptyState } from '@liveknowledge/ui';
import { suggestionLines } from '@/lib/knowledge-ask/overview-words';
import { SuggestionIcon } from './ai-knowledge-icons';
import { AI_CHIP, AI_MUTED, AiSection } from './AiSection';

// A removed and an added line differ by their sign and their strike as well as their colour.
const LINE = 'flex gap-2 px-3 py-1 font-mono text-[12.5px] leading-5 no-underline';
const REMOVED = `${LINE} bg-rose-100/70 text-rose-900 dark:bg-rose-500/15 dark:text-rose-200`;
const ADDED = `${LINE} bg-emerald-100/70 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-200`;

export function SuggestionCard({
  suggestion,
  canResolve,
  accepting,
  dismissing,
  onAccept,
  onOpenPage,
  onDismiss,
}: {
  suggestion: KnowledgeSuggestion;
  canResolve: boolean;
  accepting: boolean;
  dismissing: boolean;
  onAccept: () => void;
  onOpenPage: () => void;
  onDismiss: () => void;
}) {
  const { removed, added } = suggestionLines(suggestion);
  return (
    <li
      data-suggestion={suggestion.id}
      className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900 dark:text-white">
          {suggestion.title || 'Untitled Page'}
        </p>
        <span className={AI_CHIP}>{suggestion.agent}</span>
      </div>
      <p className={`mt-1 break-words text-[13px] leading-5 ${AI_MUTED}`}>
        {suggestion.summary || suggestion.reason}
      </p>
      <div
        role="group"
        aria-label="The change"
        className="mt-3 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800"
      >
        {removed.map((line, at) => (
          <del key={`r${at}`} className={REMOVED}>
            <span aria-hidden className="select-none">
              −
            </span>
            <span className="sr-only">Removed: </span>
            <span className="min-w-0 whitespace-pre-wrap break-words line-through">{line}</span>
          </del>
        ))}
        {added.map((line, at) => (
          <ins key={`a${at}`} className={ADDED}>
            <span aria-hidden className="select-none">
              +
            </span>
            <span className="sr-only">Added: </span>
            <span className="min-w-0 whitespace-pre-wrap break-words">{line}</span>
          </ins>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {canResolve ? (
          <Button
            variant="primary"
            size="xs"
            busy={accepting}
            disabled={dismissing}
            onClick={onAccept}
            className="phone:min-h-11"
          >
            Accept
          </Button>
        ) : null}
        <Button variant="secondary" size="xs" onClick={onOpenPage} className="phone:min-h-11">
          Open the Page
        </Button>
        {canResolve ? (
          <Button
            variant="ghost"
            size="xs"
            busy={dismissing}
            disabled={accepting}
            onClick={onDismiss}
            className="phone:min-h-11"
          >
            Dismiss
          </Button>
        ) : null}
      </div>
    </li>
  );
}

export function SuggestionsSection({
  suggestions,
  canResolve,
  busy,
  onAccept,
  onOpenPage,
  onDismiss,
}: {
  suggestions: readonly KnowledgeSuggestion[];
  canResolve: boolean;
  busy: ReadonlySet<string>;
  onAccept: (suggestion: KnowledgeSuggestion) => void;
  onOpenPage: (tab: string) => void;
  onDismiss: (suggestion: KnowledgeSuggestion) => void;
}) {
  return (
    <AiSection
      id="ai-suggestions"
      title="Edits Suggested by Agents"
      about="An agent never changes a page itself. Its edit waits here for an Editor, with its reason."
      count={suggestions.length}
    >
      {suggestions.length === 0 ? (
        <CompactEmptyState
          icon={<SuggestionIcon />}
          title="No Suggested Edits Yet"
          description="When an agent suggests a change to a page, it shows here to accept or dismiss."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {suggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              canResolve={canResolve}
              accepting={busy.has(`accept:${suggestion.id}`)}
              dismissing={busy.has(`dismiss:${suggestion.id}`)}
              onAccept={() => onAccept(suggestion)}
              onOpenPage={() => onOpenPage(suggestion.tab)}
              onDismiss={() => onDismiss(suggestion)}
            />
          ))}
        </ul>
      )}
    </AiSection>
  );
}
