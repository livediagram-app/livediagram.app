// Landed text boxes hug their text in our fonts (docs/specs/020-import-export/board-scene.md "In
// the editor"; docs/specs/023-whiteboard/whiteboard.md "Text boxes"): a source measured its text in
// its own font, so each box is re-hugged with the measurer the canvas uses, once its face loads.
import type { Element, TextElement } from '@livediagram/document';
import { hugTextSize, type MeasureTextBlock } from '@/lib/text-hug';

/** Every text box sized to hug its text; everything else as it is. */
export function hugLandedText(
  elements: readonly Element[],
  measure: (el: TextElement) => MeasureTextBlock,
): Element[] {
  return elements.map((el) =>
    el.type === 'text' ? { ...el, ...hugTextSize(el, measure(el)) } : el,
  );
}

/** The distinct font ids the text boxes draw in (the tab's for those with none). */
export function landedTextFonts(
  elements: readonly Element[],
  tabFont: string | undefined,
): string[] {
  const fonts = new Set<string>();
  for (const el of elements) {
    const font = el.type === 'text' ? (el.font ?? tabFont) : undefined;
    if (font) fonts.add(font);
  }
  return [...fonts];
}
