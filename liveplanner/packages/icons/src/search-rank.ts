// How a palette search ranks an item against what was typed (docs/specs/007-editor/toolbar-layout.md), shared by
// every search in the editor, so a query finds the same icons first wherever it is typed.

// Case-insensitive substring match. An empty query matches everything, which mirrors the picker's "show me the
// list first, narrow with typing" behaviour.
export function matches(needle: string, hay: string): boolean {
  if (!needle) return true;
  return hay.toLowerCase().includes(needle.toLowerCase());
}

// 0 exact name, 1 name prefix, 2 name substring, 3 keyword only, 4 no match.
export function paletteRank(q: string, item: { name: string; keywords: string }): number {
  const needle = q.toLowerCase();
  const name = item.name.toLowerCase();
  if (name === needle) return 0;
  if (name.startsWith(needle)) return 1;
  if (name.includes(needle)) return 2;
  return matches(q, item.keywords) ? 3 : 4;
}
