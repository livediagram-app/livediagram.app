// livedesign's typefaces (docs/specs/004-interface-design/fonts.md): the eleven every product shares
// (@liveworkspace/model-core/fonts) and the display library a logo page adds (display-fonts.ts, "The display
// library"). The three helpers below shadow the shared ones for this product, so the canvas, every export and the
// previews resolve a display face exactly as they resolve one of the eleven. The other products never import the
// library.
import {
  FONTS,
  fontIdsUsed as sharedFontIdsUsed,
  googleFontsHref as sharedGoogleFontsHref,
  resolveFontStack as sharedResolveFontStack,
} from '@liveworkspace/model-core/fonts';
import { DISPLAY_FONTS, type DisplayFont } from './display-fonts';

export { FONTS };
export {
  DISPLAY_FONT_CATEGORIES,
  DISPLAY_FONTS,
  type DisplayFont,
  type DisplayFontCategory,
} from './display-fonts';

const DISPLAY_BY_ID = new Map(DISPLAY_FONTS.map((f) => [f.id, f] as const));

/** Whether an id names a face of the display library (not one of the eleven). */
export function isDisplayFont(id: string | undefined | null): boolean {
  return !!id && DISPLAY_BY_ID.has(id);
}

/** The display face an id names, if any. */
export function displayFontById(id: string | undefined | null): DisplayFont | undefined {
  return id ? DISPLAY_BY_ID.get(id) : undefined;
}

/** Every font id an element may store: the eleven, then the display library. */
export const FONT_IDS: readonly string[] = [
  ...FONTS.map((f) => f.id),
  ...DISPLAY_FONTS.map((f) => f.id),
];

/** A stored id's CSS stack, from either list; undefined for an unset or unknown id, so callers fall back. */
export function resolveFontStack(id: string | undefined | null): string | undefined {
  return sharedResolveFontStack(id) ?? (id ? DISPLAY_BY_ID.get(id)?.stack : undefined);
}

/** The Google Fonts stylesheet href: with no ids the eleven (the editor's one stylesheet never lists the
 *  library); with ids, the families of those ids from either list. */
export function googleFontsHref(ids?: readonly string[]): string {
  if (!ids) return sharedGoogleFontsHref();
  const display = DISPLAY_FONTS.filter((f) => ids.includes(f.id));
  if (display.length === 0) return sharedGoogleFontsHref(ids);
  const shared = FONTS.filter((f) => ids.includes(f.id));
  const families = [...shared, ...display].map((f) => `family=${f.google}`).join('&');
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

/** The font ids a set of elements and their tab use, from either list: the eleven in catalogue order, then the
 *  display faces in theirs. */
export function fontIdsUsed(
  elements: readonly { font?: string }[],
  tabFont?: string,
  extra?: readonly (string | null | undefined)[],
): string[] {
  const shared = sharedFontIdsUsed(elements, tabFont, extra);
  const used = new Set<string>();
  const add = (id: string | null | undefined) => {
    if (id && DISPLAY_BY_ID.has(id)) used.add(id);
  };
  add(tabFont);
  for (const el of elements) add(el.font);
  for (const id of extra ?? []) add(id);
  if (used.size === 0) return shared;
  return [...shared, ...DISPLAY_FONTS.filter((f) => used.has(f.id)).map((f) => f.id)];
}
