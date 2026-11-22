'use client';

// Show in Page's bar (docs/specs/030-knowledgebase/ai-knowledge.md "On the page"): while one suggested edit is drawn in
// the writing (struck text goes, underlined text arrives), a bar at the top centre says so, with Accept and Dismiss for
// an Editor and Done to go back to reading. Nothing changes until it is accepted.
import type { KnowledgeSuggestion } from '@liveknowledge/api-schema';
import { Button } from '@liveknowledge/ui';

export function SuggestionReviewBar({
  suggestion,
  canDecide,
  accepting,
  dismissing,
  onAccept,
  onDismiss,
  onDone,
}: {
  suggestion: KnowledgeSuggestion;
  canDecide: boolean;
  accepting: boolean;
  dismissing: boolean;
  onAccept: () => void;
  onDismiss: () => void;
  onDone: () => void;
}) {
  return (
    <div
      role="region"
      aria-label="Reviewing a Suggested Edit"
      data-suggestion-review={suggestion.id}
      className="pointer-events-auto fixed left-1/2 top-16 z-[var(--z-toolbar)] flex w-[min(720px,calc(100vw-32px))] -translate-x-1/2 flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-[13px] leading-5 text-violet-900 shadow-lg motion-safe:transition-[opacity,translate] motion-safe:duration-200 motion-safe:starting:-translate-y-1 motion-safe:starting:opacity-0 phone:top-auto phone:bottom-4 dark:border-violet-500/30 dark:bg-violet-950 dark:text-violet-100"
    >
      <p className="min-w-0 flex-1">
        <span className="font-semibold">Reviewing {suggestion.agent}&rsquo;s suggestion.</span>{' '}
        <span className="text-violet-800 dark:text-violet-200">
          Struck text goes, underlined text arrives. Nothing changes until you accept.
        </span>
      </p>
      <div className="flex shrink-0 items-center gap-2">
        {canDecide ? (
          <>
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
          </>
        ) : null}
        <Button variant="secondary" size="xs" onClick={onDone} className="phone:min-h-11">
          Done
        </Button>
      </div>
    </div>
  );
}
