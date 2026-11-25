// The Tab Style changes as pure tab transforms (docs/specs/011-theme/canvas-and-theme-dialog.md): what picking a
// typeface, a size, a finish or a pattern does to a tab, committed by the tab setters (useTabCanvas). Each applies to
// the whole tab: the tab's own setting, and every element following it again. The font and the finish live in
// @liveplanner/project (tab-theme-apply), where the api's style changeset applies them too.
import {
  isBoxed,
  type BackgroundPattern,
  type Element,
  type Tab,
  type TextSize,
} from '@liveplanner/project';

export { withTabFinish, withTabFont } from '@liveplanner/project';

// Every element that carries text of its own (a font or a size): boxed elements and arrows.
const carriesText = (el: Element) => isBoxed(el) || el.type === 'arrow';

/** The tab's text at `size`: the size new text takes, and every text-bearing element at it. */
export function withTabTextSize(tab: Tab, size: TextSize): Tab {
  return {
    ...tab,
    defaultTextSize: size,
    elements: tab.elements.map((el) =>
      carriesText(el) && (el as { textSize?: TextSize }).textSize !== size
        ? { ...el, textSize: size }
        : el,
    ),
  };
}

/** The tab's canvas in `pattern`. */
export function withTabPattern(tab: Tab, pattern: BackgroundPattern): Tab {
  return { ...tab, backgroundPattern: pattern };
}
