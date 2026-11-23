'use client';

// Suggested Edits in the page's rail (docs/specs/030-knowledgebase/insights.md "On the page"; page-surface.md
// "The rail"): between Page Health and AI Context, only while any wait. A row a suggestion (why, who, when, how many
// lines), the press opening its popover; a passage no longer in the page is marked "The page has changed since", the
// rail and the popover being where it shows. Review All in Insights opens Needs Attention at Suggested Edits.
import type { KnowledgeSuggestion } from '@liveknowledge/api-schema';
import { askAttentionFilter } from '@/lib/knowledge-ask/attention-filter-ask';
import { showKnowledgeView } from '@/lib/knowledge-ask/knowledge-view';
import { suggestionsView } from '@/lib/knowledge/page-suggestions-view';
import { changeCounts, reasonLine } from '@/lib/knowledge/suggestion-passage';
import { formatRelativeTimeShort, useRelativeNow } from '@/lib/relative-time';
import { track } from '@/lib/telemetry';
import { RAIL_LABEL } from '../PageHealthCard';
import { usePageSuggestions } from './usePageSuggestions';

// The rail shows the newest few; the rest wait in Insights.
export const RAIL_SUGGESTIONS_MAX = 5;

export function PageRailSuggestionsView({
  suggestions,
  now,
  missing,
  openId,
  onOpen,
  onReviewAll,
}: {
  suggestions: readonly KnowledgeSuggestion[];
  now: number;
  missing: (id: string) => boolean;
  openId: string | null;
  onOpen: (s: KnowledgeSuggestion, anchor: HTMLElement) => void;
  onReviewAll: () => void;
}) {
  if (suggestions.length === 0) return null;
  const shown = suggestions.slice(0, RAIL_SUGGESTIONS_MAX);
  return (
    <section
      aria-label="Suggested Edits"
      data-page-rail-suggestions=""
      data-rail-suggestions=""
      className="text-[13px] leading-5 text-slate-700 dark:text-slate-300"
    >
      <div className="flex items-center gap-2">
        <h2 className={RAIL_LABEL}>Suggested Edits</h2>
        <span className="rounded-full bg-violet-100 px-1.5 text-[11px] font-semibold tabular-nums text-violet-700 dark:bg-violet-500/20 dark:text-violet-200">
          {suggestions.length.toLocaleString('en')}
        </span>
      </div>
      <ul className="mt-3 flex flex-col gap-1">
        {shown.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={openId === s.id}
              data-rail-suggestion={s.id}
              onClick={(e) => onOpen(s, e.currentTarget)}
              className="-mx-2 flex w-[calc(100%+1rem)] cursor-pointer flex-col items-start rounded-lg px-2 py-1.5 text-left motion-safe:transition-colors motion-safe:duration-micro hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-violet-700 aria-expanded:bg-violet-50 phone:min-h-11 dark:hover:bg-violet-500/10 dark:aria-expanded:bg-violet-500/10"
            >
              <span className="line-clamp-2 font-medium text-slate-900 dark:text-slate-100">
                {reasonLine(s) || 'Suggested Edit'}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {s.agent}, {formatRelativeTimeShort(now - s.createdAt)} · {changeCounts(s)}
              </span>
              {missing(s.id) ? (
                <span
                  data-rail-suggestion-missing=""
                  className="mt-0.5 text-xs font-medium text-amber-800 dark:text-amber-300"
                >
                  The page has changed since
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        data-rail-suggestions-all=""
        onClick={onReviewAll}
        className="mt-2 cursor-pointer text-xs font-medium text-violet-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-violet-700 phone:min-h-11 dark:text-violet-300"
      >
        Review All in Insights
      </button>
    </section>
  );
}

export function PageRailSuggestions() {
  const { suggestions, missing, view } = usePageSuggestions();
  const now = useRelativeNow();
  return (
    <PageRailSuggestionsView
      suggestions={suggestions}
      now={now}
      missing={missing}
      openId={view.open?.id ?? null}
      onOpen={(s, anchor) => {
        if (view.open?.id === s.id) return suggestionsView.close();
        track('UI', 'Opened', 'RailSuggestion');
        suggestionsView.open(s.id, anchor);
      }}
      onReviewAll={() => {
        track('UI', 'Used', 'ReviewAllSuggestions');
        askAttentionFilter('suggestions');
        showKnowledgeView('insights');
      }}
    />
  );
}
