// A knowledgebase page's icon (docs/specs/030-knowledgebase/page-surface.md "The page icon"): one emoji, or one icon
// of the line-art catalogue the drawings use, stored on the tab (`Tab.icon`). Shown large above the Title and small
// before the page's name in the page tree and the breadcrumb. Settled on every read, as the cover is.

/** A page's icon: an emoji as the system draws it, or a line-art catalogue icon by its id. */
export type TabIcon = { emoji: string } | { iconId: string };

/** The longest emoji kept, in UTF-16 code units: a family or a flag with its joiners fits, a sentence does not. */
export const PAGE_ICON_EMOJI_MAX = 32;
const ICON_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
// What an emoji starts with: a pictograph, a flag's regional letter, or a keycap's digit, # or *.
const EMOJI_START = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[#*0-9]️?⃣)/u;
const SPACE = /\s/u;

let segmenter: Intl.Segmenter | null | undefined;
function graphemes(s: string): number {
  if (segmenter === undefined)
    segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter() : null;
  if (!segmenter) return 1;
  let n = 0;
  for (const _ of segmenter.segment(s)) if (++n > 1) break;
  return n;
}

/** Whether `s` is one emoji: a pictograph (with its modifiers and joiners), a flag or a keycap, and nothing else. */
export function isPageEmoji(s: unknown): s is string {
  return (
    typeof s === 'string' &&
    s.length > 0 &&
    s.length <= PAGE_ICON_EMOJI_MAX &&
    !SPACE.test(s) &&
    EMOJI_START.test(s) &&
    graphemes(s) === 1
  );
}

/** Whether `s` could name a catalogue icon (kebab-case); an id the catalogue does not hold draws its placeholder. */
export const isPageIconId = (s: unknown): s is string => typeof s === 'string' && ICON_ID.test(s);

/** A page's icon as stored: what of it is valid, or none. An emoji wins over an icon id. */
export function parseTabIcon(v: unknown): TabIcon | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const raw = v as Record<string, unknown>;
  if (isPageEmoji(raw.emoji)) return { emoji: raw.emoji };
  if (isPageIconId(raw.iconId)) return { iconId: raw.iconId };
  return undefined;
}

/** The icon as one plain string a reader compares by value (a tree row, a breadcrumb): `e:` and the emoji, or `i:`
 *  and the icon id; null for none. */
export function pageIconKey(icon: unknown): string | null {
  const parsed = parseTabIcon(icon);
  if (!parsed) return null;
  return 'emoji' in parsed ? `e:${parsed.emoji}` : `i:${parsed.iconId}`;
}

/** The icon a key names back (pageIconKey's inverse); undefined for null or a key that is not one. */
export function pageIconOfKey(key: string | null | undefined): TabIcon | undefined {
  if (!key) return undefined;
  if (key.startsWith('e:')) return parseTabIcon({ emoji: key.slice(2) });
  if (key.startsWith('i:')) return parseTabIcon({ iconId: key.slice(2) });
  return undefined;
}

export const samePageIcon = (a: TabIcon | undefined, b: TabIcon | undefined): boolean =>
  pageIconKey(a) === pageIconKey(b);

/** The tab as a reader takes it: its icon settled (none when nothing of it is valid). The same tab when there is
 *  nothing to settle, so a tab without an icon costs one property read. */
export function withSettledIcon<T extends object>(tab: T): T {
  if (!('icon' in tab)) return tab;
  const stored = (tab as { icon?: unknown }).icon;
  const icon = parseTabIcon(stored);
  if (icon && JSON.stringify(icon) === JSON.stringify(stored)) return tab;
  const { icon: _dropped, ...rest } = tab as T & { icon?: unknown };
  return (icon ? { ...rest, icon } : rest) as T;
}
