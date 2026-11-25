// A Page Design saved to the Library (docs/specs/011-theme/page-designs.md "Saved designs";
// liveworkspace/docs/specs/006-media/libraries.md "Saved Page Designs"): an item whose one element carries the design
// and its tuning, of a kind no app places, and whose preview carries the same design in its `<metadata>`, so the list
// alone draws and applies every saved design. Pure.
import { compactPageDesign, parsePageDesign, type PageDesign } from './tuning';

/** The Library kind of a saved design's one element. */
export const SAVED_DESIGN_KIND = 'page-design';

/** A saved design's size as a Library item: a tile's. */
export const SAVED_DESIGN_WIDTH = 160;
export const SAVED_DESIGN_HEIGHT = 100;

/** The prefix an agent names a saved design by (`saved:<itemId>`), anywhere a design id is taken. */
export const SAVED_DESIGN_PREFIX = 'saved:';

export type SavedDesignElement = {
  id: 'design';
  type: typeof SAVED_DESIGN_KIND;
  design: PageDesign;
};

/** The one element a saved design is kept as. */
export function savedDesignElement(design: PageDesign): SavedDesignElement {
  return { id: 'design', type: SAVED_DESIGN_KIND, design: compactPageDesign(design) };
}

/** Whether a Library element is a saved design's, with a design the catalogue holds. */
export function isSavedDesignElement(value: unknown): value is SavedDesignElement {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.type === SAVED_DESIGN_KIND && parsePageDesign(v.design) !== undefined;
}

/** The design a saved item's elements carry, or undefined when they are not one saved design. */
export function savedDesignOf(elements: readonly unknown[]): PageDesign | undefined {
  if (elements.length !== 1) return undefined;
  const [el] = elements;
  return isSavedDesignElement(el) ? parsePageDesign(el.design) : undefined;
}

const xmlEscape = (text: string) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const xmlUnescape = (text: string) =>
  text.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');

/** A saved design's preview: a plain tile whose `<metadata>` holds the design as JSON. Builder markup. */
export function savedDesignPreview(design: PageDesign): string {
  const json = xmlEscape(JSON.stringify(compactPageDesign(design)));
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SAVED_DESIGN_WIDTH} ${SAVED_DESIGN_HEIGHT}">` +
    `<metadata>${json}</metadata>` +
    `<rect width="${SAVED_DESIGN_WIDTH}" height="${SAVED_DESIGN_HEIGHT}" rx="8" fill="#e2e8f0"/></svg>`
  );
}

/** The design a saved item's preview carries, or undefined when it holds none the catalogue knows. */
export function designFromPreview(preview: string | null | undefined): PageDesign | undefined {
  if (!preview) return undefined;
  const open = preview.indexOf('<metadata>');
  const close = preview.indexOf('</metadata>');
  if (open < 0 || close < open) return undefined;
  try {
    return parsePageDesign(JSON.parse(xmlUnescape(preview.slice(open + 10, close))));
  } catch {
    return undefined;
  }
}

/** The Library item id an agent's `saved:<id>` names, or null when it names no saved design. */
export function savedDesignId(value: unknown): string | null {
  const id =
    typeof value === 'string'
      ? value
      : typeof value === 'object' && value !== null
        ? (value as { id?: unknown }).id
        : undefined;
  return typeof id === 'string' &&
    id.startsWith(SAVED_DESIGN_PREFIX) &&
    id.length > SAVED_DESIGN_PREFIX.length
    ? id.slice(SAVED_DESIGN_PREFIX.length)
    : null;
}
