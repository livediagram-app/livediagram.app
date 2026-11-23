'use client';

// Send to Plan on a text toolbar (livedocuments' and liveknowledge's docs/specs/013-workspace/send-to-plan.md "What it
// sends"): the words picked (a sentence, a list item, a TODO, several lines), or the whole text when nothing is picked.
// A press never takes focus from the text, so the selection is still there to read when it lands.
import type { MouseEvent } from 'react';
import { HoverCard } from '@liveworkspace/ui';
import { canSendHere, sendFromHere } from './send-to-plan-entry';
import { SendToPlanMenuIcon } from './send-menu-item';

/** The words picked in the page, as the person sees them; '' when nothing is. */
export const pickedWords = (): string => window.getSelection()?.toString().trim() ?? '';

export function SendWordsButton({
  elementId,
  wholeText,
  className,
}: {
  // The element whose text is edited.
  elementId: string;
  // Its whole text, sent when nothing is picked.
  wholeText: string;
  // The toolbar's own button classes.
  className: string;
}) {
  if (!canSendHere()) return null;
  return (
    <HoverCard title="Send to Plan" description="Make a card in liveplanner from the words picked.">
      <button
        type="button"
        aria-label="Send the words to a plan"
        data-send-to-plan=""
        onMouseDown={(e: MouseEvent) => e.preventDefault()}
        onClick={() => {
          const text = pickedWords() || wholeText.trim();
          sendFromHere('text', 'words', [{ elementId, text }]);
        }}
        className={className}
      >
        <SendToPlanMenuIcon size={16} />
      </button>
    </HoverCard>
  );
}
