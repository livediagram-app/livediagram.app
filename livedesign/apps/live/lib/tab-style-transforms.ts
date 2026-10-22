// The Tab Style changes as pure tab transforms (docs/specs/011-theme/canvas-and-theme-dialog.md): what picking a
// typeface, a size, a finish or a pattern does to a tab, committed by the tab setters (useTabCanvas). Each applies to
// the whole tab: the tab's own setting, and every element following it again.
import {
  isBoxed,
  supportsFinish,
  type BackgroundPattern,
  type Element,
  type Finish,
  type Tab,
  type TextSize,
} from '@livedesign/document';

// Every element that carries text of its own (a font or a size): boxed elements and arrows.
const carriesText = (el: Element) => isBoxed(el) || el.type === 'arrow';

/** The tab lettered in `font` (null: the editor's default), every element following it again (its own font
 *  cleared). */
export function withTabFont(tab: Tab, font: string | null): Tab {
  const elements = tab.elements.map((el) => {
    if (!carriesText(el) || !('font' in el)) return el;
    const next = { ...el };
    delete next.font;
    return next;
  });
  const next: Tab = { ...tab, elements };
  if (font) next.font = font;
  else delete next.font;
  return next;
}

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

/** The tab drawn in `finish`, every element following it again (its own finish cleared). */
export function withTabFinish(tab: Tab, finish: Finish): Tab {
  const elements = tab.elements.map((el) => {
    if (!supportsFinish(el) || !('finish' in el)) return el;
    const next = { ...el } as Element & { finish?: Finish };
    delete next.finish;
    return next;
  });
  return { ...tab, finish, elements };
}

/** The tab's canvas in `pattern`. */
export function withTabPattern(tab: Tab, pattern: BackgroundPattern): Tab {
  return { ...tab, backgroundPattern: pattern };
}
