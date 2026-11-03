// Contents' rows (docs/specs/007-editor/pages-mode.md "Contents"): a row per page in row order, what
// each says about itself, and where a dropped page lands. Pure: pages in, rows out. Which page is in
// view and the Find a Page narrowing read the same in every editor with pages, so they are shared
// (@liveworkspace/workbench/lib/page-contents) and re-exported here for the editor's own callers.
import {
  pageHasOrientation,
  pageKindOf,
  pageSizeLabel,
  pageUnits,
  type Page,
  type LaidOutPage,
  type PageKind,
} from '@livedesign/design';
import { rowDropIndex, type RowDrop } from '@liveworkspace/workbench/hooks/ui/useRowReorderDrag';
import type { ContentsRowBase } from '@liveworkspace/workbench/lib/page-contents';

export { filterContents, pageInView } from '@liveworkspace/workbench/lib/page-contents';

// The shared row (its number, name, kind line, lock and shape), with what this editor adds.
export type ContentsRow = ContentsRowBase & {
  kind: PageKind | null;
};

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
