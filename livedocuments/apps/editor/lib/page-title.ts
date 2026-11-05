// A page's own title (docs/specs/007-editor/pages-mode.md "Contents"), the name Contents gives a page
// nobody has named: on a slide, an infographic or a poster, its biggest words, the topmost of
// those where two are as big (a title sits above its subtitle and body). Pure: elements in, words out.
import { labelTextScale, type Element } from '@livedocuments/document';
import { labelFontPx } from '@liveworkspace/model-core/label-font';

// Longer is cut short with an ellipsis: a row has room for a line, and a name is not a paragraph.
export const PAGE_TITLE_MAX = 60;

/** The page's title from its own elements (one page's, as elementsByPage gives them): the first line
 *  of its biggest text, the topmost (then leftmost) where sizes tie; none when no text has words. */
export function pageTitleOf(elements: readonly Element[]): string | undefined {
  let best: { px: number; y: number; x: number; line: string } | undefined;
  for (const el of elements) {
    if (el.type !== 'text' || !el.label) continue;
    const line = firstLine(el.label);
    if (!line) continue;
    const px = labelFontPx(el.textSize) * labelTextScale(el);
    if (
      !best ||
      px > best.px ||
      (px === best.px && (el.y < best.y || (el.y === best.y && el.x < best.x)))
    ) {
      best = { px, y: el.y, x: el.x, line };
    }
  }
  return best ? clip(best.line) : undefined;
}

function firstLine(label: string): string {
  for (const raw of label.split('\n')) {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (line) return line;
  }
  return '';
}

function clip(line: string): string {
  return line.length > PAGE_TITLE_MAX ? `${line.slice(0, PAGE_TITLE_MAX - 1).trimEnd()}…` : line;
}
