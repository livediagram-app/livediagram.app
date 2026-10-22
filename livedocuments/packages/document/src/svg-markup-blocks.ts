// Linear scans over our own renderers' SVG markup (svgSketchFace, svgMarkerFace). Regular expressions with a lazy
// `[\s\S]*?` up to a closing tag rescan the rest of the markup from every opening tag that has none, which CodeQL
// flags as polynomial (js/polynomial-redos); these walk the markup once with indexOf instead.

/** The first `<g ...>...</g>` whose opening tag carries `attr` (e.g. `data-finish="marker"`), as [start, end), or null.
 *  The hand-drawn bodies it finds hold no nested group, so the group ends at the first `</g>` after it. */
export function markedGroup(markup: string, attr: string): [number, number] | null {
  const at = markup.indexOf(attr);
  if (at < 0) return null;
  const start = markup.lastIndexOf('<g', at);
  const close = markup.indexOf('</g>', at);
  if (start < 0 || close < 0 || markup.indexOf('>', start) < at) return null;
  return [start, close + '</g>'.length];
}

/** Every `<tag ...>...</tag>` block of the given tags replaced by `hold(block)`, in one pass. An opening tag with no
 *  closing one is left as it is, and so is every later one of that tag (none of them can close either). Each tag's
 *  next opening and closing are remembered and only searched again past them, so the markup is read about once per
 *  tag. */
export function replaceBlocks(
  markup: string,
  tags: readonly string[],
  hold: (block: string) => string,
): string {
  const live = tags.map((tag) => ({ tag, open: openingAt(markup, tag, 0), close: -1 }));
  let out = '';
  let pos = 0;
  for (;;) {
    let next: (typeof live)[number] | null = null;
    for (const t of live) {
      if (t.open >= 0 && t.open < pos) t.open = openingAt(markup, t.tag, pos);
      if (t.open >= 0 && (!next || t.open < next.open)) next = t;
    }
    if (!next) break;
    if (next.close < next.open) next.close = markup.indexOf(`</${next.tag}>`, next.open);
    if (next.close < 0) {
      next.open = -1;
      continue;
    }
    const end = next.close + next.tag.length + 3;
    out += markup.slice(pos, next.open) + hold(markup.slice(next.open, end));
    pos = end;
  }
  return out + markup.slice(pos);
}

// Where `<tag` next opens at or after `from` as a whole tag name (followed by a space, `>`, `/` or a newline), or -1.
function openingAt(markup: string, tag: string, from: number): number {
  let i = markup.indexOf(`<${tag}`, from);
  while (i >= 0) {
    const after = markup[i + tag.length + 1];
    if (after === ' ' || after === '>' || after === '/' || after === '\n') return i;
    i = markup.indexOf(`<${tag}`, i + 1);
  }
  return -1;
}

/** One opening tag the walk found: its name, its attribute text (after the name, before the end), and whether it closes
 *  itself. */
export type MarkupTag = { name: string; attrs: string; selfClosing: boolean };

/** Every opening tag of the given names passed to `map`, its result written in its place, in one pass. A tag with no
 *  closing `>` ends the walk (no later tag can close either), and the rest is kept as it is. */
export function mapTags(
  markup: string,
  names: ReadonlySet<string>,
  map: (tag: MarkupTag, text: string) => string,
): string {
  let out = '';
  let pos = 0;
  for (let lt = markup.indexOf('<', pos); lt >= 0; lt = markup.indexOf('<', pos)) {
    let nameEnd = lt + 1;
    while (nameEnd < markup.length && /[\w-]/.test(markup[nameEnd]!)) nameEnd += 1;
    const name = markup.slice(lt + 1, nameEnd);
    if (!names.has(name)) {
      out += markup.slice(pos, lt + 1);
      pos = lt + 1;
      continue;
    }
    const gt = markup.indexOf('>', nameEnd);
    if (gt < 0) break;
    const selfClosing = markup[gt - 1] === '/';
    const attrs = markup.slice(nameEnd, selfClosing ? gt - 1 : gt);
    out += markup.slice(pos, lt) + map({ name, attrs, selfClosing }, markup.slice(lt, gt + 1));
    pos = gt + 1;
  }
  return out + markup.slice(pos);
}
