// What the slash menu shows for what is typed after the `/` (docs/specs/030-knowledgebase/page-surface.md "The slash
// menu"): Recent first while nothing is typed, then the groups in order; filtered, the groups ordered by their best
// match, each entry with the letters of its name to draw bold. And the keys' moves: Tab to a group's first entry.
// Pure: the view and the writing's keys both read it.
import { SLASH_GROUPS, SLASH_ITEMS, type SlashItem } from './article-slash-items';
import { matchSlash } from './slash-match';

export type SlashEntry = { item: SlashItem; marks: readonly number[] };
export type SlashSection = { name: string; entries: readonly SlashEntry[] };

/** The sections in order and their entries flattened (the keys' order, an option's index into it), with the index
 *  each section starts at. */
export type SlashModel = {
  sections: readonly SlashSection[];
  items: readonly SlashItem[];
  starts: readonly number[];
};

export const RECENT = 'Recent';

/** Sections from a flat list, a section for each run of one group (the page picker's entries, already ranked). */
export function sectionsOfItems(items: readonly SlashItem[]): SlashSection[] {
  const out: { name: string; entries: SlashEntry[] }[] = [];
  for (const item of items) {
    const last = out[out.length - 1];
    if (last && last.name === item.group) last.entries.push({ item, marks: [] });
    else out.push({ name: item.group, entries: [{ item, marks: [] }] });
  }
  return out;
}

/** The model over `sections`. */
export function modelOf(sections: readonly SlashSection[]): SlashModel {
  const items: SlashItem[] = [];
  const starts: number[] = [];
  for (const s of sections) {
    starts.push(items.length);
    for (const e of s.entries) items.push(e.item);
  }
  return { sections, items, starts };
}

/** The slash menu for `query`: unfiltered, Recent (the `recent` ids) then every group; filtered, only the matching
 *  entries, each group ordered by its best match and its entries by theirs (the catalogue's order among equals). */
export function slashModel(
  query: string,
  recent: readonly string[] = [],
  items: readonly SlashItem[] = SLASH_ITEMS,
): SlashModel {
  const q = query.trim();
  if (!q) {
    const byId = new Map(items.map((i) => [i.id, i]));
    const recents = recent.flatMap((id) => {
      const item = byId.get(id);
      return item ? [{ item, marks: [] }] : [];
    });
    const groups = SLASH_GROUPS.map((name) => ({
      name,
      entries: items.filter((i) => i.group === name).map((item) => ({ item, marks: [] })),
    })).filter((s) => s.entries.length > 0);
    return modelOf(recents.length ? [{ name: RECENT, entries: recents }, ...groups] : groups);
  }
  const scored = items.flatMap((item, order) => {
    const m = matchSlash(item.label, item.keywords, q);
    return m ? [{ item, marks: m.marks, score: m.score, order }] : [];
  });
  const groups = SLASH_GROUPS.map((name) => {
    const entries = scored
      .filter((e) => e.item.group === name)
      .sort((a, b) => b.score - a.score || a.order - b.order);
    return {
      name,
      entries,
      best: entries[0]?.score ?? -Infinity,
      order: SLASH_GROUPS.indexOf(name),
    };
  })
    .filter((g) => g.entries.length > 0)
    .sort((a, b) => b.best - a.best || a.order - b.order);
  return modelOf(
    groups.map((g) => ({
      name: g.name,
      entries: g.entries.map(({ item, marks }) => ({ item, marks })),
    })),
  );
}

/** The index Tab (`+1`) or Shift+Tab (`-1`) moves to from `index`: the next or previous section's first entry,
 *  wrapping. */
export function groupJump(starts: readonly number[], index: number, dir: 1 | -1): number {
  if (starts.length === 0) return 0;
  let at = 0;
  for (let i = 0; i < starts.length; i++) if (starts[i]! <= index) at = i;
  return starts[(at + dir + starts.length) % starts.length]!;
}
