// One drawing set inside another (a component's instances and its palette tiles, a tab drawn as its pages): its ids
// prefixed so it never shares a gradient, pattern, marker or clip with the drawing around it.

/** Every id in `markup` (and every `url(#…)` and `href="#…"` reaching one) prefixed, so a drawing set inside another
 *  never shares a gradient, pattern, marker or clip with it. */
export function prefixSvgIds(markup: string, prefix: string): string {
  const ids = new Set<string>();
  for (const m of markup.matchAll(/\sid="([^"]+)"/g)) ids.add(m[1]!);
  if (ids.size === 0) return markup;
  const p = (id: string) => (ids.has(id) ? `${prefix}${id}` : id);
  return markup
    .replace(/(\sid=")([^"]+)(")/g, (_, a: string, id: string, b: string) => `${a}${p(id)}${b}`)
    .replace(/url\(#([^)]+)\)/g, (_, id: string) => `url(#${p(id)})`)
    .replace(/(href=")#([^"]+)(")/g, (_, a: string, id: string, b: string) => `${a}#${p(id)}${b}`);
}
