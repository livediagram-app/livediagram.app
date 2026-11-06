// A blank tab (docs/specs/009-elements/avatar-pad.md "Every Space and blank tab has one"): one whose only elements are
// Avatar Pads, the entrance a blank tab is started with. It is still blank: it opens no walk for its Editor
// (walk-entrance.ts), and its entry does not fit the view to the pad but opens with the pad BLANK_PAD_DROP below the
// middle (useEditorState's entry fit), as the pad lands when a tab is started blank in the editor. Pure.
import type { Element } from '@livehuddle/document';
import { BLANK_PAD_DROP } from '@livehuddle/templates';

const isPad = (el: Element) => el.type === 'shape' && el.shape === 'avatar-pad';

/** True when the tab holds something, and all of it is Avatar Pads. */
export function holdsOnlyPads(elements: readonly Element[]): boolean {
  return elements.length > 0 && elements.every(isPad);
}

/** Where a pad-only tab's view is centred on entry: BLANK_PAD_DROP above its first pad's middle. Null for any other
 *  tab, which its entry fits instead. */
export function padOnlyTabCentre(elements: readonly Element[]): { x: number; y: number } | null {
  if (!holdsOnlyPads(elements)) return null;
  const pad = elements[0]!;
  if (pad.type !== 'shape') return null;
  return { x: pad.x + pad.width / 2, y: pad.y + pad.height / 2 - BLANK_PAD_DROP };
}
