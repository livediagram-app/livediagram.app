// Text in a stack the page embeds no face of (liveworkspace/docs/specs/013-export/vector-pdf.md "Text"): a system
// stack such as livediagram's default `system-ui, sans-serif`. Its letters can't be drawn from a face the browser
// won't hand over, so, as the Logo Kit does, it is set in the fallback face (Inter) in the mounted copy before it is
// measured, and drawn in it. Without the fallback face (offline) it stays as it was and falls back to a picture.
import { FALLBACK_FAMILY, stackFamilies } from '../outline-text/outline-element';
import { parseFontFaces } from '../outline-text/font-face-css';

/** The elements of `root`'s text whose font stack names none of `families` (lower case). */
export function unembeddedText(root: Element, families: ReadonlySet<string>): SVGElement[] {
  const out: SVGElement[] = [];
  for (const t of root.querySelectorAll('text')) {
    for (const el of [t, ...t.querySelectorAll('*')]) {
      const stack = stackFamilies(getComputedStyle(el).fontFamily);
      if (!stack.some((f) => families.has(f.toLowerCase()))) out.push(el as SVGElement);
    }
  }
  return out;
}

/** The page's faces, with the fallback face added and the text without a face of its own set in it, when the page
 *  has such text and `load` gives the fallback face's CSS. */
export async function withFallbackFace(
  root: Element,
  css: string,
  load: (() => Promise<string>) | undefined,
): Promise<string> {
  if (!load) return css;
  const families = new Set(parseFontFaces(css).map((f) => f.family.toLowerCase()));
  const bare = unembeddedText(root, families);
  if (bare.length === 0) return css;
  const extra = await load();
  if (!parseFontFaces(extra).some((f) => f.family.toLowerCase() === FALLBACK_FAMILY.toLowerCase()))
    return css;
  for (const el of bare) el.style.fontFamily = FALLBACK_FAMILY;
  return css + extra;
}
