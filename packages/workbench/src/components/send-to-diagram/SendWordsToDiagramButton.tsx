'use client';

// Send to Diagram on a text toolbar (liveworkspace/docs/specs/004-index/send-to-diagram.md; each app's
// 013-workspace/send-to-diagram.md): the words picked, or the whole text when nothing is picked, beside Send to Plan.
// A press never takes focus from the text, so the selection is still there to read when it lands.
import type { MouseEvent } from 'react';
import { HoverCard } from '@liveworkspace/ui';
import { pickedWords } from '../send-to-plan/SendWordsButton';
import { canSendDiagramHere, sendWordsToDiagram } from './send-to-diagram-entry';
import { SendToDiagramIcon } from './SendToDiagramIcon';

export function SendWordsToDiagramButton({
  elementId,
  wholeText,
  className,
}: {
  elementId: string;
  wholeText: string;
  className: string;
}) {
  if (!canSendDiagramHere()) return null;
  return (
    <HoverCard
      title="Send to Diagram"
      description="AI draws the words picked as a diagram in livediagram."
    >
      <button
        type="button"
        aria-label="Send the words to a diagram"
        data-send-to-diagram=""
        onMouseDown={(e: MouseEvent) => e.preventDefault()}
        onClick={() => sendWordsToDiagram({ elementId, text: pickedWords() || wholeText })}
        className={className}
      >
        <SendToDiagramIcon size={16} />
      </button>
    </HoverCard>
  );
}
