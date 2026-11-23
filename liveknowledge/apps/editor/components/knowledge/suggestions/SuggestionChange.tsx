// The lines a suggested edit takes out and puts in (docs/specs/030-knowledgebase/ai-knowledge.md "Edits suggested by
// agents"): Insights' Needs Attention row and the page's popover draw the same change. Text, never Markdown made
// into markup. A removed and an added line differ by their sign and their strike as well as their colour.
import type { KnowledgeSuggestion } from '@liveknowledge/api-schema';
import { suggestionLines } from '@/lib/knowledge-ask/overview-words';

const LINE = 'flex gap-2 px-3 py-1 font-mono text-[12.5px] leading-5 no-underline';
const REMOVED = `${LINE} bg-rose-100/70 text-rose-900 dark:bg-rose-500/15 dark:text-rose-200`;
const ADDED = `${LINE} bg-blue-50 text-blue-900 dark:bg-blue-500/15 dark:text-blue-200`;

export function SuggestionChange({
  suggestion,
  className = '',
}: {
  suggestion: Pick<KnowledgeSuggestion, 'kind' | 'before' | 'after'>;
  className?: string;
}) {
  const { removed, added } = suggestionLines(suggestion);
  return (
    <div
      role="group"
      aria-label="The change"
      className={`overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 ${className}`}
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
  );
}
