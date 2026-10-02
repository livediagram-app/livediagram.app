// Loading a text box saved with `autoWidth` (docs/specs/007-editor/editor-modes.md "A text box's
// sizing"). One field, `sizing`, now says how a text box sizes itself: `autoWidth: true` was a box
// whose width followed its words, so it becomes `'fit'`; `autoWidth: false` said nothing and is
// dropped. A sizing already stored wins. Runs where stored elements enter (./stored-elements).
import type { Element } from './index';

type LegacyText = { autoWidth?: unknown; sizing?: unknown };

const carriesAutoWidth = (el: Element): boolean => el.type === 'text' && 'autoWidth' in el;

export function migrateLegacyTextSizing(elements: Element[]): Element[] {
  if (!elements.some(carriesAutoWidth)) return elements;
  return elements.map((el) => {
    if (!carriesAutoWidth(el)) return el;
    const { autoWidth, ...rest } = el as Element & LegacyText;
    if (rest.sizing !== undefined || autoWidth !== true) return rest as Element;
    return { ...rest, sizing: 'fit' } as Element;
  });
}
