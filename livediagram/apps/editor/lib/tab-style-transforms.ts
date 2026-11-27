// The Tab Style changes as pure tab transforms (docs/specs/011-theme/canvas-and-theme-dialog.md): what picking a
// typeface, a size, a finish or a pattern does to a tab, committed by the tab setters (useTabCanvas). Each applies to
// the whole tab: the tab's own setting, and every element following it again.
import {
  carriesText,
  type BackgroundPattern,
  type Tab,
  type TextSize,
} from '@livediagram/document';

// The typeface and finish live in the package, which the api's `style` changeset runs too.
export { withTabFinish, withTabFont } from '@livediagram/document';

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
