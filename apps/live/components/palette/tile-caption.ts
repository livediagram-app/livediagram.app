import { headlineCase } from '@livediagram/api-schema';

// The short name a palette tile shows, derived from its action label.
//
// One definition shared by both layouts — the 3-column grid (PaletteIconButton)
// and the Tools tab's rows (PaletteToolRows) — because a tool called "Text" in
// one and "Add Text" in the other is the kind of drift that makes a palette
// feel unfinished.
//
// The rule: drop a leading "Add ", drop any parenthetical, Title Case what's
// left (docs/specs/004-interface-design/menus.md "Item labels"). "Add Web Browser" → "Web Browser",
// "Pencil (freehand)" → "Pencil". A tile's explicit `caption` always wins, for the names this rule
// would mangle.
export function tileCaption(label: string, override?: string): string {
  if (override) return override;
  const base = label
    .replace(/^add\s+/i, '')
    .replace(/\s*\([^)]*\)/g, '')
    .trim();
  return headlineCase(base);
}
