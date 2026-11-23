'use client';

// Send to Plan on a selection's toolbar (liveworkspace/docs/specs/004-index/send-to-plan.md "Where it is"): the
// selected elements with words, one card each or one with a checklist. Shown only while this session may send and
// something selected has words. Beside Export: both take the selection somewhere else.
import { HoverCard } from '@liveworkspace/ui';
import { canSendElements, sendElements, SendToPlanMenuIcon } from './send-menu-item';

type Sendable = Parameters<typeof sendElements>[0][number];

export function SendToPlanButton({
  elements,
  className,
}: {
  elements: readonly Sendable[];
  // The toolbar's own button classes.
  className: string;
}) {
  if (!canSendElements(elements)) return null;
  return (
    <HoverCard title="Send to Plan" description="Make cards in liveplanner from these.">
      <button
        type="button"
        onClick={() => sendElements(elements)}
        aria-label="Send selected elements to a plan"
        data-send-to-plan=""
        className={className}
      >
        <SendToPlanMenuIcon size={14} />
      </button>
    </HoverCard>
  );
}
