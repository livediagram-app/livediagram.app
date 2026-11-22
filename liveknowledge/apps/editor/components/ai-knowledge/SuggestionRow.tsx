'use client';

// An edit suggested by an agent, as a row of Needs Attention (docs/specs/030-knowledgebase/ai-knowledge.md "Edits
// suggested by agents"): an agent with Suggests Edits never changes a page; its edit waits here with its reason, as
// the lines it takes out and puts in. Accept applies it as one undo step in the acceptor's name and does not verify the page. The lines are text.
import type { KnowledgeSuggestion } from '@liveknowledge/api-schema';
import { Button } from '@liveknowledge/ui';
import { suggestionLines } from '@/lib/knowledge-ask/overview-words';
import { AI_CHIP, AI_MUTED } from './AiSection';

// A removed and an added line differ by their sign and their strike as well as their colour.
const LINE = 'flex gap-2 px-3 py-1 font-mono text-[12.5px] leading-5 no-underline';
const REMOVED = `${LINE} bg-rose-100/70 text-rose-900 dark:bg-rose-500/15 dark:text-rose-200`;
const ADDED = `${LINE} bg-emerald-100/70 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-200`;

export function SuggestionRow({
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
    <div data-suggestion={suggestion.id}>
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
        className="mt-3 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"
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
    </div>
  );
}
