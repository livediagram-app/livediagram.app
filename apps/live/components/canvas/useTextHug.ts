// A whiteboard text box hugging its text while it is typed into (docs/specs/023-whiteboard/
// whiteboard.md "Text boxes"). The editor reports its live content; this measures it and holds
// the box they need, which the element view draws in place of the stored size until the edit
// commits. The size is local to the view and never written per keystroke: the commit writes the
// label and its hugged size together, as one step (useSelectionEditing.commitLabel).

import { useCallback, useState } from 'react';
import type { BoxedElement } from '@livediagram/document';
import { useCanvasStill } from '@/components/canvas/CanvasStillContext';
import {
  hugsText,
  hugTextSize,
  textHugFontPx,
  textHugPaddingCss,
  type BlockSize,
} from '@/lib/text-hug';
import { measureTextHug } from './text-hug-measure';

// What the label renderer needs to draw a hugging text box.
export type TextHugLabel = {
  padding: string;
  fontPx: number;
  onLiveText: (editor: HTMLElement) => void;
};

export function useTextHug(
  element: BoxedElement,
  isEditing: boolean,
  fontFamily: string | undefined,
): { box: BlockSize | null; label: TextHugLabel | undefined } {
  // The still canvas is the whiteboard's (CanvasStillContext).
  const whiteboard = useCanvasStill();
  const [live, setLive] = useState<BlockSize | null>(null);
  const onLiveText = useCallback(
    (editor: HTMLElement) => {
      if (element.type !== 'text') return;
      setLive(hugTextSize(element, measureTextHug(element, editor, fontFamily)));
    },
    [element, fontFamily],
  );
  if (!hugsText(element, whiteboard)) return { box: null, label: undefined };
  return {
    box: isEditing ? live : null,
    label: {
      padding: textHugPaddingCss(element),
      fontPx: textHugFontPx(element),
      onLiveText,
    },
  };
}
