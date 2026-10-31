// An article tab built into a Word document (docs/specs/020-import-export/blueprints/office-export.md "buildDocx"):
// every article in the order its pages run (a page break between two), each zone drawn as an image of its elements
// as the page shows them, the article's style resolved to the document's look, and its first page's paper. The
// drawing is injected, so everything else runs in Node.

import {
  ARTICLE_LINE_HEIGHT,
  ARTICLE_PARAGRAPH_SPACE,
  ARTICLE_TEXT_SIZE_PX,
  articleMarginPx,
  articlesOf,
  articleTopMarginPx,
  legibleOn,
  nextArticleBlockId,
  pageDimensions,
  pageUnits,
  pagesOf,
  resolveArticleStyle,
  resolveFontStack,
  zoneCanvasRect,
  zoneMemberIds,
  type ArticleBlock,
  type ArticleStyle,
  type LaidOutPage,
  type Tab,
} from '@livedocuments/document';
import { fontFaceName } from './ooxml-colour';
import type { PageDrawer } from './pptx-build';
import type { DocxBlock, DocxDocument, DocxLook } from './docx-types';
import { throwIfCancelled, yieldToBrowser, type ExportProgress } from './progress';

// The ink and muted text of a light page (docs/specs/007-editor/article-pages.md "Type"): Word's page is white.
const INK = '1E293B';
const MUTED = '64748B';
const PAPER = '#ffffff';
// The faces when a font id is unknown, and code's (the article's own monospace).
const FALLBACK_FACE = 'Inter';
const CODE_FACE = 'Roboto Mono';

const hex6 = (c: string) => c.replace(/^#/, '').toUpperCase();

/** The article's style as the document's look, its accent (else the theme's) kept legible on white. */
export function docxLook(style: ArticleStyle | undefined, themeAccent: string): DocxLook {
  const r = resolveArticleStyle(style);
  const face = (id: string) => fontFaceName(resolveFontStack(id)) ?? FALLBACK_FACE;
  return {
    headingFont: face(r.headingFont),
    bodyFont: face(r.bodyFont),
    codeFont: fontFaceName(resolveFontStack('roboto-mono')) ?? CODE_FACE,
    bodyPx: ARTICLE_TEXT_SIZE_PX[r.textSize],
    lineHeight: ARTICLE_LINE_HEIGHT[r.lineSpacing],
    paragraphSpace: ARTICLE_PARAGRAPH_SPACE[r.paragraphSpacing],
    accent: hex6(legibleOn(r.accent ?? themeAccent, PAPER)),
    accentHeadings: r.accentHeadings,
    ink: INK,
    muted: MUTED,
    rules: r.rules,
    pageNumbers: r.pageNumbers,
  };
}

/** The tab's articles, in the order their pages run. */
export function articleFlowsInOrder(tab: Tab): string[] {
  const articles = articlesOf(tab);
  return pageUnits(pagesOf(tab)).flatMap((u) => (u.flow && articles[u.flow] ? [u.flow] : []));
}

export type DocxInput = {
  tab: Tab;
  pages: readonly LaidOutPage[];
  title: string;
  themeAccent: string;
};

/** How many zones the export draws, for its progress. */
export function zoneCount(tab: Tab): number {
  const articles = articlesOf(tab);
  return articleFlowsInOrder(tab).reduce(
    (n, flow) => n + articles[flow]!.blocks.filter((b) => b.type === 'zone').length,
    0,
  );
}

async function zoneImage(
  input: DocxInput,
  block: Extract<ArticleBlock, { type: 'zone' }>,
  drawer: PageDrawer,
): Promise<DocxBlock | null> {
  const rect = zoneCanvasRect(input.pages, block);
  const page = block.at ? input.pages.find((p) => p.id === block.at!.page) : undefined;
  if (!rect || !page) return null;
  const ids = zoneMemberIds(input.tab.elements, rect);
  if (ids.size === 0) return null;
  const png = await drawer.region(page, ids, rect);
  if (!png) return null;
  return {
    type: 'image',
    png,
    widthPx: rect.width,
    heightPx: rect.height,
    wrap: block.wrap ?? 'inline',
    align: block.align ?? 'center',
  };
}

export async function buildDocx(
  input: DocxInput,
  drawer: PageDrawer,
  progress: ExportProgress,
): Promise<DocxDocument> {
  const { tab } = input;
  const articles = articlesOf(tab);
  const flows = articleFlowsInOrder(tab);
  const first = flows[0] ? input.pages.find((p) => p.flow === flows[0]) : input.pages[0];
  const style = flows[0] ? articles[flows[0]]!.style : undefined;
  const total = Math.max(1, zoneCount(tab));
  let drawn = 0;
  const blocks: DocxBlock[] = [];
  for (const [i, flow] of flows.entries()) {
    // A second article starts on a new page, as it does in the row.
    if (i > 0) blocks.push({ id: nextArticleBlockId(), type: 'pageBreak' });
    for (const b of articles[flow]!.blocks) {
      throwIfCancelled(progress.signal);
      if (b.type !== 'zone') {
        blocks.push(b);
        continue;
      }
      const image = await zoneImage(input, b, drawer);
      if (image) blocks.push(image);
      drawn += 1;
      progress.onProgress?.(drawn / total);
      await yieldToBrowser();
    }
  }
  const dims = first ? pageDimensions(first) : { width: 794, height: 1123 };
  progress.onProgress?.(1);
  return {
    title: input.title,
    look: docxLook(style, input.themeAccent),
    page: {
      widthPx: dims.width,
      heightPx: dims.height,
      landscape: dims.width > dims.height,
      marginPx: articleMarginPx(style),
      topMarginPx: articleTopMarginPx(style),
    },
    blocks,
  };
}
