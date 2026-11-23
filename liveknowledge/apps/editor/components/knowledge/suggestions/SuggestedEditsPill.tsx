'use client';

// "2 Suggested Edits" beside Verified in the page's meta row (docs/specs/030-knowledgebase/insights.md "On the
// page"; page-surface.md "The meta row"): shown to everyone while any wait; a press opens the newest in its popover.
import { Tooltip } from '@liveknowledge/ui';
import { suggestionsView } from '@/lib/knowledge/page-suggestions-view';
import { suggestedEditsLabel } from '@/lib/knowledge/suggestion-passage';
import { track } from '@/lib/telemetry';
import { SuggestionMarkIcon } from './suggestion-icons';
import { usePageSuggestions } from './usePageSuggestions';

export function SuggestedEditsPillView({
  count,
  open,
  onOpen,
}: {
  count: number;
  open: boolean;
  onOpen: (anchor: HTMLElement) => void;
}) {
  if (count === 0) return null;
  const label = suggestedEditsLabel(count);
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-suggested-edits-pill=""
        onClick={(e) => onOpen(e.currentTarget)}
        className="inline-flex h-6 cursor-pointer items-center gap-1.5 rounded-full bg-violet-50 px-2.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200 motion-safe:transition-colors motion-safe:duration-micro hover:bg-violet-100 focus-visible:outline-2 focus-visible:outline-violet-700 phone:h-11 dark:bg-violet-500/15 dark:text-violet-200 dark:ring-violet-500/30 dark:hover:bg-violet-500/25"
      >
        <SuggestionMarkIcon />
        <span className="text-optical-centre">{label}</span>
      </button>
    </Tooltip>
  );
}

export function SuggestedEditsPill() {
  const { suggestions, view } = usePageSuggestions();
  const first = suggestions[0];
  return (
    <SuggestedEditsPillView
      count={suggestions.length}
      open={view.open !== null}
      onOpen={(anchor) => {
        if (!first) return;
        if (view.open) return suggestionsView.close();
        track('UI', 'Opened', 'SuggestedEditsPill');
        suggestionsView.open(first.id, anchor);
      }}
    />
  );
}
