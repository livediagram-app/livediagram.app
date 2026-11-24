'use client';

// Send to Plan on a text toolbar (livedocuments' and liveknowledge's docs/specs/013-workspace/send-to-plan.md "What it
// sends"): the words picked (a sentence, a list item, a TODO, several lines), or the whole text when nothing is picked.
// A press never takes focus from the text, so the selection is still there to read when it lands. A tap on a touch
// screen clears it first, so the words are read as the press starts (press-hold.ts).
import { useState, type MouseEvent } from 'react';
import { HoverCard } from '@liveworkspace/ui';
import { canSendHere, sendFromHere } from './send-to-plan-entry';
import { SendToPlanMenuIcon } from './send-menu-item';
import { pressHold } from './press-hold';

/** The words picked in the page, as the person sees them; '' when nothing is. */
export const pickedWords = (): string => window.getSelection()?.toString().trim() ?? '';

/** The words a press on a text toolbar's send entry started on, for its click (press-hold.ts). */
export function usePickedOnPress() {
  const [held] = useState(() => pressHold<string>());
  return {
    onPointerDown: () => held.hold(pickedWords()),
    // The words the press held, else those picked now, else the whole text.
    words: (wholeText: string) => held.take() || pickedWords() || wholeText.trim(),
  };
}

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
  const press = usePickedOnPress();
  if (!canSendHere()) return null;
  return (
    <HoverCard title="Send to Plan" description="Make a card in liveplanner from the words picked.">
      <button
        type="button"
        aria-label="Send the words to a plan"
        data-send-to-plan=""
        onPointerDown={press.onPointerDown}
        onMouseDown={(e: MouseEvent) => e.preventDefault()}
        onClick={() => sendFromHere('text', 'words', [{ elementId, text: press.words(wholeText) }])}
        className={className}
      >
        <SendToPlanMenuIcon size={16} />
      </button>
    </HoverCard>
  );
}
