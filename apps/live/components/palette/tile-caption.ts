// The short name a palette tile shows, derived from its action label.
//
// One definition shared by both layouts — the 3-column grid (PaletteIconButton)
// and the Tools tab's rows (PaletteToolRows) — because a tool called "Text" in
// one and "Add text" in the other is the kind of drift that makes a palette
// feel unfinished.
//
// The rule: drop a leading "Add ", drop any parenthetical, sentence-case what's
// left. "Add web browser" → "Web browser", "Pencil (freehand)" → "Pencil". A
// tile's explicit `caption` always wins, for the names this rule would mangle.
export function tileCaption(label: string, override?: string): string {
  if (override) return override;
  const base = label
    .replace(/^add\s+/i, '')
    .replace(/\s*\([^)]*\)/g, '')
    .trim();
  return base.charAt(0).toUpperCase() + base.slice(1);
}
