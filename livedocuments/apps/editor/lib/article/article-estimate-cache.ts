// A page's writing when its editor is not mounted (docs/specs/007-editor/flashcards.md "Long stacks stay quick"): a
// long flashcard stack mounts only the writing near the card in front, so the other cards are drawn where they show
// away from the canvas (an export, a thumbnail, the Map) from the headless estimate an export of a document that is
// not open uses (estimateArticle). Cached per stored writing object and page place: a card's estimate is made again
// only when its own writing, its place or the theme changes.
import {
  BOLD_EM,
  estimateArticle,
  getBuiltInTheme,
  laidOutPagesOf,
  themeAccent,
  type ArticleDrawOp,
  type LaidOutPage,
  type Tab,
} from '@livedocuments/document';

// An average glyph's advance as a share of the font size, as the estimate sets a line.
const CHAR_EM = 0.52;

type Entry = { key: string; ops: ReadonlyMap<string, ArticleDrawOp[]> };
const cache = new WeakMap<object, Entry>();

const rawFlow = (source: object, flow: string): object | undefined => {
  const articles = (source as { articles?: unknown }).articles;
  if (!articles || typeof articles !== 'object') return undefined;
  const raw = (articles as Record<string, unknown>)[flow];
  return raw && typeof raw === 'object' ? raw : undefined;
};

/** The estimated writing on `page` (its text operations at its place on the canvas), or undefined when it has none.
 *  `source` is the tab, or anything holding its `articles` (the Map's writing); `pages` its laid-out pages when the
 *  caller has them (else read off a tab, or the page alone). */
export function estimatedPageOps(
  source: object,
  page: LaidOutPage,
  pages?: readonly LaidOutPage[],
): ArticleDrawOp[] | undefined {
  const flow = page.flow;
  if (!flow) return undefined;
  const raw = rawFlow(source, flow);
  if (!raw) return undefined;
  const theme = (source as Partial<Tab>).theme;
  const r = page.rect;
  const key = `${r.x},${r.y},${r.width},${r.height}:${theme ?? ''}`;
  const hit = cache.get(raw);
  if (hit && hit.key === key) return hit.ops.get(page.id);
  const own =
    pages ?? ('pages' in source && 'elements' in source ? laidOutPagesOf(source as Tab) : [page]);
  const accent = themeAccent(getBuiltInTheme(theme, 'light'));
  const { ops } = estimateArticle(source, flow, own, accent);
  cache.set(raw, { key, ops });
  return ops.get(page.id);
}

/** Estimated writing as soft bars, one per line, as the editor's own bars (snapshotBars) draw it. */
export function estimatedBars(ops: readonly ArticleDrawOp[], ink: string): ArticleDrawOp[] {
  const out: ArticleDrawOp[] = [];
  for (const op of ops) {
    if (op.k !== 'text' || !op.text.trim()) continue;
    const em = CHAR_EM * (Number(op.weight) >= 600 ? BOLD_EM : 1);
    const lineHeight = op.size * 1.3;
    const top = op.y - op.size;
    const width = op.text.length * op.size * em;
    const x = op.anchor === 'end' ? op.x - width : op.anchor === 'middle' ? op.x - width / 2 : op.x;
    out.push({
      k: 'rect',
      x,
      y: top + lineHeight * 0.25,
      w: width,
      h: lineHeight * 0.5,
      fill: ink,
      r: 2,
    });
  }
  return out;
}
