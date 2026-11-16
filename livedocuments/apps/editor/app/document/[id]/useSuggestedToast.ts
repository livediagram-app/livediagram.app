import { useEffect, useRef } from 'react';
import type { useToast } from '@/hooks/ui/useToast';
import { track } from '@/lib/telemetry';
import {
  onSuggested,
  requestSuggestionReview,
  type SuggestedNotice,
} from '@/lib/article/article-suggest-store';

// The toast an assistant's article write as suggestions raises (docs/specs/024-agents/pages-for-agents.md
// "Suggestions"): "Claude suggested 6 edits" with Review, which opens the article's tab and puts the caret in the
// change's first suggestion, its card open. Slides and canvas elements keep the changeset toast's Show and Undo.

/** "Claude suggested 6 edits". */
export function suggestedToastCopy(notice: Pick<SuggestedNotice, 'n' | 'count'>): string {
  return `${notice.n} suggested ${notice.count} edit${notice.count === 1 ? '' : 's'}`;
}

export function useSuggestedToast(opts: {
  toast: ReturnType<typeof useToast>;
  // Brings a tab into view (switching to it first when needed).
  revealInView: (tabId: string, ids: readonly string[]) => void;
}) {
  const latest = useRef(opts);
  useEffect(() => {
    latest.current = opts;
  });
  useEffect(
    () =>
      onSuggested((notice) => {
        const { toast } = latest.current;
        toast.action({
          key: `suggested:${notice.g}`,
          message: suggestedToastCopy(notice),
          actions: [
            {
              label: 'Review',
              ariaLabel: `Review ${notice.n}'s suggestions`,
              onSelect: () => {
                track('Agent', 'Opened', 'SuggestionsToast');
                latest.current.revealInView(notice.tabId, []);
                requestSuggestionReview(notice.flow, notice.g);
              },
            },
          ],
        });
      }),
    [],
  );
}
