'use client';

// A suggestion on show (liveworkspace/docs/specs/016-notifications/suggestions.md "What it looks like"): a notice in
// the toast stack, bottom centre, in the toast's stacked card: its title what it would do, its line why now at the
// card's full width, a foot row with a quiet Don't Suggest This Again and its one action, and the × that dismisses it
// for this item. It enters as a toast does, never takes the focus and is announced politely. Each app mounts one per
// suggestion it offers, with its own trigger.
import { ToastCard, ToastNotice } from '@liveworkspace/ui/toast';
import { SUGGESTIONS, type SuggestionId } from './suggestions';
import { useSuggestion, type SuggestionCheck } from './useSuggestion';

export function NextAppSuggestion({
  id,
  itemId,
  allowed,
  check,
  wake,
}: {
  id: SuggestionId;
  itemId: string | null;
  allowed: boolean;
  check: SuggestionCheck;
  wake?: unknown;
}) {
  const { find, take, dismiss, never } = useSuggestion({ id, itemId, allowed, check, wake });
  if (!find) return null;
  return (
    <SuggestionCallout id={id} line={find.line} onTake={take} onDismiss={dismiss} onNever={never} />
  );
}

/** The callout itself, in the slot. */
export function SuggestionCallout({
  id,
  line,
  onTake,
  onDismiss,
  onNever,
}: {
  id: SuggestionId;
  line: string;
  onTake: () => void;
  onDismiss: () => void;
  onNever: () => void;
}) {
  const s = SUGGESTIONS[id];
  // A suggestion yields the slot to any other notice, so it never holds it itself.
  return (
    <ToastNotice hold={false}>
      <ToastCard
        tone="info"
        role="status"
        aria-live="polite"
        data-suggestion={id}
        title={s.title}
        message={line}
        actions={[
          { label: 'Don’t Suggest This Again', onSelect: onNever, quiet: true },
          { label: s.action, onSelect: onTake, primary: true },
        ]}
        onClose={onDismiss}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onDismiss();
          }
        }}
      />
    </ToastNotice>
  );
}
