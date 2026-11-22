// An image's alt text (docs/specs/009-elements/images.md "Alt text"): the words that describe its picture to someone
// who cannot see it. One cleaning rule for every path that writes it: the editor's field, a Participant's op, an
// Editor's op, a save, an agent's change and an import all store the same clean line.

import { cleanText } from '@liveworkspace/api-kit/typed-text';
import type { Element } from './index';

// One or two sentences. Screen-reader guidance keeps alt text short (about 150 characters); a longer description
// belongs in the page's own words. Safe range 125 to 1000.
export const IMAGE_ALT_MAX = 250;

// Every run of white space, a pasted line break and a tab included: one character class, one quantifier, linear.
const WHITE_SPACE_RUN = /\s+/g;

/** The alt text as it is stored: one line (each white-space run one space), bidi controls out, trimmed of spaces and
 *  invisible characters, at most IMAGE_ALT_MAX characters cut between whole characters. `''` means none. */
export function cleanImageAlt(value: string): string {
  return cleanText(value.replace(WHITE_SPACE_RUN, ' '), IMAGE_ALT_MAX);
}

/** The element with its `alt` cleaned: the same object when it is not an image or its `alt` is already clean, and
 *  without `alt` when the words clean to nothing (or are not a string). */
export function withCleanImageAlt<T extends Element>(el: T): T {
  if (el.type !== 'image' || !('alt' in el)) return el;
  const stored = (el as { alt?: unknown }).alt;
  if (stored === undefined) return el;
  const clean = typeof stored === 'string' ? cleanImageAlt(stored) : '';
  if (clean === stored) return el;
  const { alt: _drop, ...rest } = el as T & { alt?: unknown };
  void _drop;
  return (clean ? { ...rest, alt: clean } : rest) as T;
}

/** Every image's `alt` cleaned: the same list when nothing changed, so an untouched tab costs no allocation. */
export function cleanImageAlts(elements: Element[]): Element[] {
  let next: Element[] | null = null;
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i]!;
    const clean = withCleanImageAlt(el);
    if (clean === el) continue;
    next ??= elements.slice();
    next[i] = clean;
  }
  return next ?? elements;
}

/** The alt texts of the pictures among `ids`, in paint order, joined with "; ": a Word zone's description. `''` when
 *  none of them has any. */
export function imageAltTextOf(elements: readonly Element[], ids: ReadonlySet<string>): string {
  const parts: string[] = [];
  for (const el of elements) {
    if (el.type !== 'image' || !ids.has(el.id)) continue;
    const alt = typeof el.alt === 'string' ? el.alt.trim() : '';
    if (alt) parts.push(alt);
  }
  return parts.join('; ');
}
