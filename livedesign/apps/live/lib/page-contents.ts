// The Contents popover's list (docs/specs/007-editor/pages-mode.md "Contents"): a row per
// page in row order, what each says about itself, which page is in view, and the Find a Page
// narrowing. Pure: pages and the view in, rows out.
import {
  pageHasOrientation,
  pageKindOf,
  pageSizeLabel,
  pageUnits,
  type Page,
  type LaidOutPage,
  type PageKind,
} from '@livedesign/document';
import { rowDropIndex, type RowDrop } from '@/hooks/ui/useRowReorderDrag';

export type ContentsRow = {
  id: string;
  // Its place in the row, from 1.
  number: number;
  // Its own name, else "Page n".
  name: string;
  // What it is: "Logo", "Wireframe · iPhone", "Page · A4 Portrait" for one whose kind is not chosen yet.
  line: string;
  locked: boolean;
  // Its shape on the sheet, for the thumbnail's frame.
  aspect: number;
  kind: PageKind | null;
};

// More pages than this show the Find a Page box.
export const CONTENTS_FIND_AFTER = 6;

const KIND_NAME = {
  logo: 'Logo',
  wireframe: 'Wireframe',
  photo: 'Photo',
} as const;

export function contentsRows(pages: readonly LaidOutPage[]): ContentsRow[] {
  return pages.map((p, i) => {
    const kind = pageKindOf(p);
    let line: string = kind ? KIND_NAME[kind] : 'Page';
    if (!kind) {
      const size = pageSizeLabel(p);
      const turn = pageHasOrientation(p) && (p.size ?? 'a4') === 'a4';
      line += ` · ${size}${turn ? ` ${p.orientation === 'portrait' ? 'Portrait' : 'Landscape'}` : ''}`;
    } else if (kind === 'wireframe') {
      line += ` · ${pageSizeLabel(p)}${p.orientation === 'landscape' && pageHasOrientation(p) ? ' Landscape' : ''}`;
    }
    return {
      id: p.id,
      number: i + 1,
      name: p.name?.trim() || `Page ${i + 1}`,
      line,
      locked: p.locked === true,
      aspect: p.rect.width / p.rect.height,
      kind,
    };
  });
}

/** The rows a Find a Page query keeps: every word found in the name, the line or the number. */
export function filterContents(
  rows: readonly ContentsRow[],
  query: string,
  // The words on each page (lib/page-texts.ts), searched as its name is.
  texts?: ReadonlyMap<string, string>,
): ContentsRow[] {
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
  pages: readonly LaidOutPage[],
  view: { zoom: number; offset: { x: number; y: number } },
  screen: { width: number; height: number },
  insets: { left: number; right: number } = { left: 0, right: 0 },
): string | undefined {
  if (pages.length === 0) return undefined;
  const cx = screen.width / 2 - view.offset.x + (insets.left - insets.right) / (2 * view.zoom);
  const cy = screen.height / 2 - view.offset.y;
  let best: LaidOutPage | undefined;
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

/** The place (among the row's units, 0 first) a page dropped beside the row at `drop.index` moves
 *  to, or null when it stays put (docs/specs/007-editor/pages-mode.md "Contents"). */
export function contentsDropUnit(
  pages: readonly Pick<Page, 'id'>[],
  pageId: string,
  drop: RowDrop,
): number | null {
  const units = pageUnits(pages as Page[]);
  const unitOf = (id: string) => units.findIndex((u) => u.pageIds.includes(id));
  const from = unitOf(pageId);
  const target = pages[drop.index];
  if (from < 0 || !target) return null;
  const at = unitOf(target.id);
  if (at === from) return null;
  // Among units, the list's own rule (rowDropIndex): the caret sits between units.
  return rowDropIndex(from, { index: at, side: drop.side }, units.length);
}
