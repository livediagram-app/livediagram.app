import { headlineCase } from '@liveworkspace/api-schema/title-case';

// The short name a palette tile shows, derived from its action label.
//
// One definition shared by both layouts — the tile grid (PaletteIconButton)
// and the Tools tab's rows (PaletteToolRows) — because a tool called "Text" in
// one and "Add Text" in the other is the kind of drift that makes a palette
// feel unfinished.
//
// The rule: drop a leading "Add ", drop any parenthetical, Title Case what's
// left (docs/specs/004-interface-design/menus.md "Item labels"). "Add Web Browser" → "Web Browser",
// "Pencil (freehand)" → "Pencil". A tile's explicit `caption` always wins, for the names this rule
// would mangle.
// Drops each "(...)" in one pass: a regex would rescan the rest of the label from every unclosed bracket.
function withoutParentheticals(text: string): string {
  let out = '';
  let from = 0;
  for (let open = text.indexOf('('); open !== -1; open = text.indexOf('(', from)) {
    const close = text.indexOf(')', open);
    if (close === -1) break;
    out += text.slice(from, open);
    from = close + 1;
  }
  return out + text.slice(from);
}

export function tileCaption(label: string, override?: string): string {
  if (override) return override;
  const base = withoutParentheticals(label.replace(/^add\s+/i, ''))
    .replace(/\s+/g, ' ')
    .trim();
  return headlineCase(base);
}
