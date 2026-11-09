// Linear scans over our own renderers' SVG markup (svgSketchFace, svgMarkerFace). Regular expressions with a lazy
// `[\s\S]*?` up to a closing tag rescan the rest of the markup from every opening tag that has none, which CodeQL
// flags as polynomial (js/polynomial-redos); these walk the markup once with indexOf instead.

/** The first `<g ...>...</g>` whose opening tag carries `attr` (e.g. `data-finish="marker"`), as [start, end), or null.
 *  Groups nested inside it are counted, so it ends at its own `</g>`: cutting at the first `</g>` left the rest of a
 *  body that held a group (a face's pencil shading) behind as an unmatched `</g>`, and the whole SVG failed to parse.
 *  Null when it never closes. */
export function markedGroup(markup: string, attr: string): [number, number] | null {
  const at = markup.indexOf(attr);
  if (at < 0) return null;
  const start = markup.lastIndexOf('<g', at);
  if (start < 0 || markup.indexOf('>', start) < at) return null;
  const end = groupEnd(markup, markup.indexOf('>', at) + 1);
  return end < 0 ? null : [start, end];
}

// Where the group opened just before `from` ends (past its `</g>`), counting the groups nested in it; -1 if it never
// closes. One pass: each `<g` and `</g>` is found once (the next `</g>` is searched again only once it is passed).
function groupEnd(markup: string, from: number): number {
  let depth = 1;
  let pos = from;
  let open = openingAt(markup, 'g', pos);
  let close = -1;
  for (;;) {
    if (close < pos) close = markup.indexOf('</g>', pos);
    if (close < 0) return -1;
    if (open >= 0 && open < close) {
      const gt = markup.indexOf('>', open);
      if (gt < 0) return -1;
      if (markup[gt - 1] !== '/') depth += 1;
      pos = gt + 1;
      open = openingAt(markup, 'g', pos);
      continue;
    }
    depth -= 1;
    pos = close + '</g>'.length;
    if (depth === 0) return pos;
  }
}

// Blocks a face pass never redraws as they stand (clips, masks, patterns, markers, definitions, symbols), a
// foreignObject's HTML.
const FACE_HELD_BLOCKS = [
  'clipPath',
  'mask',
  'defs',
  'pattern',
  'marker',
  'symbol',
  'foreignObject',
] as const;
// The hand-drawn bodies (each product's svgSketchDrawing and svgMarkerDrawing): already drawn and shaded by hand.
const HAND_DRAWN_BODIES = ['data-finish="marker"', 'data-finish="sketch"'] as const;

/** A face's markup with every block a face pass leaves whole (FACE_HELD_BLOCKS, then each hand-drawn body) swapped
 *  for a `<!--lvd-held-N-->` comment, its markup pushed onto `held`. A face holds at most one body. */
export function holdFaceBlocks(markup: string, held: string[]): string {
  const hold = (block: string) => `<!--lvd-held-${held.push(block) - 1}-->`;
  let out = replaceBlocks(markup, FACE_HELD_BLOCKS, hold);
  for (const attr of HAND_DRAWN_BODIES) {
    const body = markedGroup(out, attr);
    if (body) out = out.slice(0, body[0]) + hold(out.slice(body[0], body[1])) + out.slice(body[1]);
  }
  return out;
}

/** Every `<!--lvd-held-N-->` put back as the block `holdFaceBlocks` held. */
export function restoreFaceBlocks(markup: string, held: readonly string[]): string {
  return markup.replace(/<!--lvd-held-(\d+)-->/g, (_, i: string) => held[Number(i)]!);
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
