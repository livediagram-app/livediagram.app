'use client';

import type { ComponentProps } from 'react';
import { ModifierHint as SharedModifierHint } from '@liveworkspace/workbench/components/chrome/ModifierHintBanner';
import { useInsertionDragInHand } from '@/lib/insertion-preview';
import { usePaletteDragPreview } from '@/lib/palette-drag-preview';

// The modifier hint (docs/specs/008-canvas/canvas-and-palette.md, docs/specs/021-event-storming/event-storming.md) is
// workbench's; this binding adds livediagram's one offer, Alt's insert between, while a sticky is on the move on an
// event-storming board, from the palette or from the board itself (the shared banner stands it down while Shift is
// held, as drag-duplicate owns that gesture).
export function ModifierHint({
  esBoard,
  ...hint
}: {
  // Insert between is an event-storming gesture only. The existing-note half carries its own board check in the
  // store; a palette drag knows only what it is dragging, so the board comes from here.
  esBoard: boolean;
} & Omit<ComponentProps<typeof SharedModifierHint>, 'altHint'>) {
  const movingNote = useInsertionDragInHand();
  const palette = usePaletteDragPreview();
  const insertBetween = movingNote || (esBoard && palette?.note === true);
  return (
    <SharedModifierHint
      {...hint}
      altHint={insertBetween ? 'Press to insert it between two notes' : null}
    />
  );
}
