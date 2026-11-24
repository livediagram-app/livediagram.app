'use client';

// A suggestion on show (liveworkspace/docs/specs/016-notifications/suggestions.md "What it looks like"): a floating
// info callout in the editor's notice slot, bottom centre above the dock, its title what it would do, its line why now,
// its one action, a quiet Don't Suggest This Again and the × that dismisses it for this item. It fades in (not under
// reduced motion), never takes the focus and is announced politely. Each app mounts one per suggestion it offers,
// with its own trigger.
import { Callout } from '@liveworkspace/ui/callout';
import { useNoticeSlot } from '../../hooks/ui/useNoticeSlot';
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
  // A suggestion yields the slot to any other notice, so it never holds it itself.
  const bottom = useNoticeSlot(true, false);
  const s = SUGGESTIONS[id];
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[var(--z-overlay)] flex justify-center px-4"
      style={bottom === null ? { bottom: 0, visibility: 'hidden' } : { bottom }}
    >
      <div
        role="status"
        aria-live="polite"
        data-suggestion={id}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onDismiss();
          }
        }}
        className="pointer-events-auto w-full max-w-[400px] motion-safe:animate-fade-in"
      >
        <Callout
          tone="info"
          size="md"
          floating
          title={s.title}
          action={{ label: s.action, onSelect: onTake }}
          onClose={onDismiss}
        >
          <span className="block">{line}</span>
          <button
            type="button"
            onClick={onNever}
            className="touch-target relative mt-0.5 rounded text-xs font-medium text-slate-500 underline-offset-2 transition hover:text-slate-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Don’t Suggest This Again
          </button>
        </Callout>
      </div>
    </div>
  );
}
