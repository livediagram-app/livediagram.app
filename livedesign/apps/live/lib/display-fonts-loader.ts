// Loading the display library's faces (docs/specs/004-interface-design/fonts.md "The display library"): the editor's
// one stylesheet lists the eleven only, so a display face's stylesheet is linked once an element uses it, and the
// picker's rows preview from a few letters of each face. Nothing of the library's font bytes ships in the bundle.
import { DISPLAY_FONTS, googleFontsHref, isDisplayFont } from '@livedesign/design';

const LINK_ATTR = 'data-display-font';
const PREVIEW_ATTR = 'data-display-font-previews';

/** The display ids a set of elements uses, in one pass. */
export function displayFontIdsIn(elements: readonly { font?: unknown }[]): string[] {
  const ids = new Set<string>();
  for (const el of elements) {
    const id = el.font;
    if (typeof id === 'string' && isDisplayFont(id)) ids.add(id);
  }
  return [...ids];
}

/** Link each display family's stylesheet once (one `<link>` per family, never twice); the browser fetches its
 *  files when text uses it. Ids that are not display faces are ignored. */
export function loadDisplayFonts(ids: readonly string[]): void {
  if (typeof document === 'undefined') return;
  for (const id of ids) {
    if (!isDisplayFont(id) || document.head.querySelector(`link[${LINK_ATTR}="${id}"]`)) continue;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = googleFontsHref([id]);
    link.setAttribute(LINK_ATTR, id);
    document.head.appendChild(link);
  }
}

/** The family a picker row previews in: a subset of the face under a name of its own, so it never stands in for
 *  the full face on the canvas. */
export function displayPreviewFamily(id: string): string {
  return `${id} preview`;
}

/** Every letter of the library's names, once each, in a stable order: the subset the previews ask for. */
export function displayPreviewLetters(): string {
  const letters = new Set<string>();
  for (const f of DISPLAY_FONTS) for (const ch of f.label) if (ch !== ' ') letters.add(ch);
  return [...letters].sort().join('');
}

/** The one stylesheet that holds every face's preview subset (Google Fonts' `text=`). */
export function displayPreviewHref(): string {
  const families = DISPLAY_FONTS.map((f) => `family=${f.google.split(':')[0]}`).join('&');
  return `https://fonts.googleapis.com/css2?${families}&text=${encodeURIComponent(displayPreviewLetters())}&display=swap`;
}

/** Google's preview stylesheet with each family renamed to its preview family. */
export function renamePreviewFamilies(css: string): string {
  let out = css;
  for (const f of DISPLAY_FONTS) {
    out = out
      .split(`font-family: '${f.label}';`)
      .join(`font-family: '${displayPreviewFamily(f.id)}';`);
  }
  return out;
}

let previews: Promise<void> | null = null;

/** Fetch the preview subsets once and add them as a `<style>`; a failed fetch leaves the rows in their fallback
 *  face (and is tried again next time the library opens). */
export function loadDisplayPreviews(fetchImpl: typeof fetch = fetch): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  if (previews) return previews;
  previews = (async () => {
    try {
      const res = await fetchImpl(displayPreviewHref());
      if (!res.ok) throw new Error(`status ${res.status}`);
      const style = document.createElement('style');
      style.setAttribute(PREVIEW_ATTR, '');
      style.textContent = renamePreviewFamilies(await res.text());
      document.head.appendChild(style);
    } catch (e) {
      console.warn('[display-fonts] previews failed', e);
      previews = null;
    }
  })();
  return previews;
}

/** For tests: forget the preview stylesheet so the next call fetches again. */
export function resetDisplayPreviewsForTest(): void {
  previews = null;
}
