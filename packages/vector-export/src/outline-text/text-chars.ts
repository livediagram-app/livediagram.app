// The characters of an SVG `<text>` as the browser addresses them (livedesign/docs/specs/007-editor/logo-pages.md "Outlined
// text"): `getStartPositionOfChar(i)` counts the characters left once white space collapses (xml:space default:
// newlines dropped, tabs as spaces, a run of spaces as one, the ends trimmed), so each typed character is mapped to
// its index there, or to none.

/** One character of a text node: its UTF-16 unit, the node holding it, and its browser index (-1: not drawn). */
export type TextChar = { ch: string; holder: Element; index: number };

/** The characters of `nodes` (a `<text>`'s text nodes in order), each mapped to its addressable index. */
export function addressableChars(nodes: readonly Text[], count: number): TextChar[] | null {
  const raw: { ch: string; holder: Element }[] = [];
  for (const node of nodes) {
    const holder = node.parentElement;
    if (!holder) continue;
    for (const ch of node.data) {
      // A surrogate pair is one string here; spread it back to its two UTF-16 units, the first carrying the place.
      for (let u = 0; u < ch.length; u++) raw.push({ ch: u === 0 ? ch : '', holder });
    }
  }
  // Collapse as xml:space default does, then check against what the browser counts.
  const kept: boolean[] = raw.map(() => true);
  let prevSpace = true;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]!.ch;
    if (c === '\n' || c === '\r') {
      kept[i] = false;
      continue;
    }
    const space = c === ' ' || c === '\t';
    if (space && prevSpace) kept[i] = false;
    prevSpace = space;
  }
  for (let i = raw.length - 1; i >= 0; i--) {
    if (!kept[i]) continue;
    if (raw[i]!.ch === ' ' || raw[i]!.ch === '\t') kept[i] = false;
    else break;
  }
  const collapsed = kept.filter(Boolean).length;
  const identity = collapsed !== count;
  if (identity && raw.length !== count) return null;
  let next = 0;
  return raw.map((r, i) => ({
    ch: r.ch,
    holder: r.holder,
    index: identity || kept[i] ? next++ : -1,
  }));
}

/** Characters that draw nothing and need no face: white space and invisible format characters (bidi marks). */
export function drawsNothing(ch: string): boolean {
  return ch === '' || /^[\s\p{Cf}]$/u.test(ch);
}
