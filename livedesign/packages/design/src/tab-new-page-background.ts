// The background new pages start on (docs/specs/007-editor/pages-mode.md "A new page's background";
// docs/specs/011-theme/canvas-and-theme-dialog.md "New Page Background"): a tab's own default, set in Tab Style. While
// a tab has one, every page made on it (added, added like another, the first page's kind chosen) starts on it rather
// than carrying over the page before it; a logo page takes its fill alone, a photo page none (it is its picture). A
// fill and a pattern only: a picture is a page's own choice, so a stored one is dropped. Pure.
import { parsePageBackground, type PageBackground } from './page';

type DefaultTab = { newPageBackground?: unknown };

/** The tab's own new-page background, valid and without a picture: `{}` is the plain paper, chosen; undefined
 *  when the tab has none (new pages carry over the page before). */
export function newPageBackgroundOf(tab: DefaultTab): PageBackground | undefined {
  const stored = tab.newPageBackground;
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return undefined;
  const { fill, pattern } = parsePageBackground(stored) ?? {};
  return {
    ...(fill && fill.kind !== 'image' ? { fill } : {}),
    ...(pattern ? { pattern } : {}),
  };
}

/** The tab with its new-page background patched (a fill or pattern given as undefined clears that part, leaving the
 *  plain paper `{}` when both go), or cleared with `null`, so new pages carry over the page before again. The same
 *  tab when nothing changes. */
export function withNewPageBackground<T extends DefaultTab>(
  tab: T,
  patch: Partial<PageBackground> | null,
): T {
  const was = newPageBackgroundOf(tab);
  const merged =
    patch === null ? undefined : newPageBackgroundOf({ newPageBackground: { ...was, ...patch } });
  if (merged && JSON.stringify(merged) === JSON.stringify(was)) return tab;
  if (!merged && tab.newPageBackground === undefined) return tab;
  const { newPageBackground: _drop, ...rest } = tab;
  return (merged ? { ...rest, newPageBackground: merged } : rest) as T;
}
