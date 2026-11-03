// Pages mode's Contents (docs/specs/007-editor/pages-mode.md "Contents"), the part every editor
// with pages reads the same: what a row says about its page, the Find a Page narrowing, and which
// page is in view. Pure: pages and the view in, rows out. Each editor builds its own rows (what a
// page of its kinds says about itself) on ContentsRowBase.

/** A page's row: what both of Contents' homes show for it. An editor's rows add their own facts. */
export type ContentsRowBase = {
  id: string;
  // Its place in the row, from 1.
  number: number;
  // Its own name, else "Page n".
  name: string;
  // What it is ("Infographic · A4 Portrait", "Wireframe · iPhone"), searched with its name.
  line: string;
  locked: boolean;
  // Its shape on the sheet, for the thumbnail's frame.
  aspect: number;
};

/** A page's picture: an SVG of the page, drawn by the editor's own renderer. */
export type ContentsThumb = { markup: string; viewBox: string };

/** A laid-out page, as far as Contents reads one: its id and its rectangle on the canvas. */
export type ContentsPageRect = {
  id: string;
  rect: { x: number; y: number; width: number; height: number };
};

// More pages than this show the Find a Page box.
export const CONTENTS_FIND_AFTER = 6;

/** The rows a Find a Page query keeps: every word found in the name, the line or the number. */
export function filterContents<R extends ContentsRowBase>(
  rows: readonly R[],
  query: string,
  // The words on each page (the editor's lib/page-texts.ts), searched as its name is.
  texts?: ReadonlyMap<string, string>,
): R[] {
  const words = normalise(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...rows];
  return rows.filter((r) => {
    const hay = normalise(`${r.number} ${r.name} ${r.line} ${texts?.get(r.id) ?? ''}`);
    return words.every((w) => hay.includes(w));
  });
}

// Case and width folded, as the editor's find folds them (normaliseFind in document-views).
const normalise = (text: string) => text.normalize('NFKC').toLowerCase();

/** The page in view: the one whose rectangle holds the middle of the screen, else the nearest to
 *  it. `view` is the canvas's (the centred transform: a canvas x lands at screen
 *  `w/2 + zoom(x + offset.x - w/2)`, lib/viewport.ts) and `screen` the canvas area's size in screen
 *  px. `insets` are the screen px the Contents panel covers at the canvas's sides: the middle is the
 *  middle of what shows beside it. */
export function pageInView(
  pages: readonly ContentsPageRect[],
  view: { zoom: number; offset: { x: number; y: number } },
  screen: { width: number; height: number },
  insets: { left: number; right: number } = { left: 0, right: 0 },
): string | undefined {
  if (pages.length === 0) return undefined;
  const cx = screen.width / 2 - view.offset.x + (insets.left - insets.right) / (2 * view.zoom);
  const cy = screen.height / 2 - view.offset.y;
  let best: ContentsPageRect | undefined;
  let bestD = Infinity;
  for (const p of pages) {
    const dx = Math.max(p.rect.x - cx, 0, cx - (p.rect.x + p.rect.width));
    const dy = Math.max(p.rect.y - cy, 0, cy - (p.rect.y + p.rect.height));
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best?.id;
}
