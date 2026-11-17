// Which items Home's Most Used and Recent show (liveworkspace/docs/specs/004-index/one-explorer.md "Each item shows
// once"): an item is in the first of New, Most Used and Recent it qualifies for. Most Used leaves out what New shows,
// Recent leaves out both, and each fills to its size from the next items in its own order. Home's read asks for New's
// four more of each than it shows (homeOpenedLoader), so leaving items out never shrinks a section that has more.

import type { Item } from '@liveworkspace/index-client';
import { isMostUsed } from '../data/viewLists';
import type { ThisBrowserItem } from '../this-browser';
import { mergeOpened } from './ThisBrowser';

type Opened = Pick<Item, 'id' | 'useDays' | 'useOpens' | 'lastOpenedAt'>;

/** A most used item shown in Recent: its line says when it was opened, as Recent's do, not how often. */
const asRecent = <T extends Opened>(item: T): T => ({
  ...item,
  useDays: undefined,
  useOpens: undefined,
});

/**
 * Home's Most Used and Recent from its one read (the most used first, in their order, then the recent ones not among
 * them, in theirs), with what New shows (`inNew`: the index's and this browser's) left out of both. Most Used is the
 * first `max` most used not in New; Recent the first `max` of the rest by last open, this browser's opened ones merged
 * in. A most used item past Most Used's `max` joins Recent by its last open, as any opened item does.
 */
export function homeSections<T extends Opened>(
  opened: readonly T[],
  inNew: readonly { id: string }[],
  localOpened: readonly ThisBrowserItem[],
  max: number,
): { mostUsed: T[]; recent: (T | ThisBrowserItem)[] } {
  const shownInNew = new Set(inNew.map((i) => i.id));
  const notNew = opened.filter((i) => !shownInNew.has(i.id));
  const used = notNew.filter(isMostUsed);
  const mostUsed = used.slice(0, max);
  const spare = used.slice(max).map(asRecent);
  const indexRecent = notNew.filter((i) => !isMostUsed(i));
  const pool = spare.length
    ? [...indexRecent, ...spare].sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))
    : indexRecent;
  const local = localOpened.filter((i) => !shownInNew.has(i.id));
  return { mostUsed, recent: mergeOpened(pool, local, max).slice(0, max) };
}
