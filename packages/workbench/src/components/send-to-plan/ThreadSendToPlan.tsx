'use client';

// Send to Plan in a comment thread's header (liveworkspace/docs/specs/004-index/send-to-plan.md "Where it is"): beside
// Resolve, the thread's first comment as the card's words (its mention the assignee). Once sent, the thread's chip
// stands in its place, live, opening the card; sending again goes through the element's own menu.
import { HoverCard } from '@liveworkspace/ui';
import { useSends } from './send-store';
import { canSendHere, sendFromHere } from './send-to-plan-entry';
import { SendToPlanMenuIcon } from './send-menu-item';
import { SentChip } from './SentChip';

export function ThreadSendToPlan({
  elementId,
  words,
}: {
  // The element the thread is on.
  elementId: string;
  // The thread's first comment, as the person sees it.
  words: string;
}) {
  const sends = useSends(elementId, 'thread');
  if (sends.length > 0) return <SentChip sends={sends} className="max-w-36" />;
  if (!words.trim() || !canSendHere()) return null;
  return (
    <HoverCard title="Send to Plan" description="Make a card in liveplanner from this thread.">
      <button
        type="button"
        aria-label="Send this thread to a plan"
        data-send-to-plan=""
        onClick={() => sendFromHere('thread', 'thread', [{ elementId, text: words }])}
        className="relative touch-target-y cursor-pointer rounded p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      >
        <SendToPlanMenuIcon size={14} />
      </button>
    </HoverCard>
  );
}
