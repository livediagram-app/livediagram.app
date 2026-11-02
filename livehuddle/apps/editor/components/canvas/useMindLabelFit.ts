// A mind node grows with its label while it is typed into (docs/specs/009-elements/mind-node.md
// "A node grows to fit its label"). The editor reports its live content; this measures it and
// holds the taller height the lines need, which the element view draws in place of the stored
// height until the edit commits. Never written per keystroke: the commit grows the node with its
// label, as one step (useSelectionEditing.commitLabel), the way a hugging text box does
// (useTextHug).

import { useCallback, useState } from 'react';
import { isMindNode, type BoxedElement } from '@livehuddle/document';
import { mindLabelFontPx, mindLabelHeight } from '@/lib/mind-label-fit';
import { measureLabelBlock } from './text-hug-measure';

export function useMindLabelFit(
  element: BoxedElement,
  isEditing: boolean,
  fontFamily: string | undefined,
): { height: number | null; onLiveText: ((editor: HTMLElement) => void) | undefined } {
  const [live, setLive] = useState<number | null>(null);
  const mind = isMindNode(element) ? element : null;
  const onLiveText = useCallback(
    (editor: HTMLElement) => {
      if (!mind) return;
      setLive(
        mindLabelHeight(mind, measureLabelBlock(mind, editor, fontFamily, mindLabelFontPx(mind))),
      );
    },
    [mind, fontFamily],
  );
  // A finished edit forgets its height, so the next one starts from the stored size.
  if (!isEditing && live !== null) setLive(null);
  if (!mind) return { height: null, onLiveText: undefined };
  return {
    height: isEditing && live !== null && live > mind.height ? live : null,
    onLiveText,
  };
}
