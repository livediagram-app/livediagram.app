// Fixture tabs for the office export tests (docs/specs/020-import-export/blueprints/office-export.md "Testing"): a
// slide tab with every element kind on its pages, an article tab with every block kind, and the long deck and
// article the speed tests time. Test-only.

import {
  createArrow,
  createFreehand,
  createImage,
  createLinkCard,
  createShape,
  createSticky,
  createTable,
  createText,
  createVideo,
  layOutPages,
  newSlidePage,
  SHAPE_KINDS,
  withArticleFlow,
  withPageKindChosen,
  pagesOf,
  type ArticleBlock,
  type Deck,
  type Element,
  type LaidOutPage,
  type ShapeKind,
  type Tab,
} from '@livedocuments/document';
import type { PageDrawer } from './pptx-build';

// The smallest valid PNG (one transparent pixel): what the fake drawer hands back.
export const ONE_PIXEL_PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  ),
  (c) => c.charCodeAt(0),
);

/** A drawer that records what it was asked to draw and hands back one pixel. */
export function fakeDrawer(): PageDrawer & {
  regions: {
    page: string;
    ids: string[];
    rect: { x: number; y: number; width: number; height: number };
  }[];
  backgrounds: string[];
} {
  const regions: {
    page: string;
    ids: string[];
    rect: { x: number; y: number; width: number; height: number };
  }[] = [];
  const backgrounds: string[] = [];
  return {
    regions,
    backgrounds,
    region: async (page, ids, rect) => {
      regions.push({ page: page.id, ids: [...ids], rect });
      return ONE_PIXEL_PNG;
    },
    background: async (page) => {
      backgrounds.push(page.id);
      return ONE_PIXEL_PNG;
    },
  };
}

const at = <T extends Element>(el: T, page: LaidOutPage, x: number, y: number): T => ({
  ...el,
  id: `${el.type}-${'shape' in el ? el.shape : ''}-${page.id}-${x}-${y}`,
  x: page.rect.x + x,
  y: page.rect.y + y,
});

/** Every shape kind and element kind, twelve to a slide. */
export function everyKindDeck(): { tab: Tab; pages: LaidOutPage[]; deck: Deck } {
  const kinds = [...SHAPE_KINDS] as ShapeKind[];
  const others = ['text', 'sticky', 'table', 'image', 'link-card', 'video', 'freehand', 'arrow'];
  const count = Math.ceil((kinds.length + others.length) / 12);
  const pages = Array.from({ length: count }, (_, i) => newSlidePage(`page-${i + 1}`));
  const laid = layOutPages(pages);
  const elements: Element[] = [];
  const all = [...kinds.map((k) => ({ shape: k })), ...others.map((o) => ({ other: o }))];
  all.forEach((item, i) => {
    const page = laid[Math.floor(i / 12)]!;
    const x = 80 + (i % 4) * 440;
    const y = 80 + Math.floor((i % 12) / 4) * 320;
    if ('shape' in item) {
      elements.push(at({ ...createShape(item.shape, 0, 0), label: item.shape }, page, x, y));
      return;
    }
    const make: Record<string, () => Element> = {
      text: () => ({ ...createText(0, 0), label: 'Every word\nand a second line', textBold: true }),
      sticky: () => ({ ...createSticky(0, 0), label: 'A sticky note' }),
      table: () => createTable(0, 0),
      image: () => createImage(0, 0),
      'link-card': () => createLinkCard(0, 0),
      video: () => createVideo(0, 0),
      freehand: () =>
        createFreehand(
          [
            { x: 0, y: 0 },
            { x: 40, y: 30 },
            { x: 80, y: 0 },
          ],
          false,
        ),
    };
    if (item.other === 'arrow') {
      const ox = page.rect.x + x;
      const oy = page.rect.y + y;
      elements.push({ ...createArrow(ox, oy, ox + 200, oy + 120), id: `arrow-${page.id}` });
      return;
    }
    elements.push(at(make[item.other]!(), page, x, y));
  });
  const tab: Tab = { id: 'deck', name: 'Deck', elements, pages, templateChosen: true };
  const deck: Deck = {
    slides: [
      {
        id: `page:deck:page-1`,
        tabId: 'deck',
        elementIds: [],
        pageId: 'page-1',
        notes: 'Open with the numbers.',
      },
      { id: `page:deck:page-2`, tabId: 'deck', elementIds: [], pageId: 'page-2', hidden: true },
    ],
  };
  return { tab, pages: laid, deck };
}

/** One of every article block, with every run format, and a zone of each kind and wrap. */
export function everyBlockArticle(): { tab: Tab; pages: LaidOutPage[] } {
  const blank: Tab = {
    id: 'article',
    name: 'Article',
    elements: [],
    pages: [{ id: 'a-1', orientation: 'portrait' }],
    templateChosen: true,
  };
  const chosen = withPageKindChosen(blank, 'a-1', 'article', 'flow-1')!;
  const laid = layOutPages(pagesOf(chosen));
  const page = laid[0]!;
  const image = {
    ...createImage(0, 0),
    id: 'zone-image',
    x: page.rect.x + 120,
    y: page.rect.y + 400,
    width: 300,
    height: 200,
  };
  const shape = {
    ...createShape('square', 0, 0),
    id: 'zone-shape',
    x: page.rect.x + 120,
    y: page.rect.y + 700,
  };
  const blocks: ArticleBlock[] = [
    { id: 'b1', type: 'paragraph', style: 'title', runs: [{ text: 'The Report' }] },
    { id: 'b2', type: 'paragraph', style: 'subtitle', runs: [{ text: 'A subtitle' }] },
    { id: 'b3', type: 'paragraph', style: 'h1', runs: [{ text: 'Heading one' }] },
    { id: 'b4', type: 'paragraph', style: 'h2', runs: [{ text: 'Heading two' }] },
    { id: 'b5', type: 'paragraph', style: 'h3', runs: [{ text: 'Heading three' }] },
    {
      id: 'b6',
      type: 'paragraph',
      align: 'justify',
      runs: [
        { text: 'Bold ', b: true },
        { text: 'italic ', i: true },
        { text: 'under ', u: true },
        { text: 'struck ', s: true },
        { text: 'code ', code: true },
        { text: 'up', sup: true },
        { text: 'down', sub: true },
        { text: ' a link', href: 'https://example.com/a?b=1&c=2' },
        { text: ' red', color: '#dc2626' },
        { text: ' lit', hl: '#fef08a' },
        { text: '\nafter a break' },
      ],
    },
    { id: 'b7', type: 'paragraph', style: 'quote', runs: [{ text: 'A quote' }] },
    { id: 'b8', type: 'list', list: 'bullet', runs: [{ text: 'Bullet' }] },
    { id: 'b9', type: 'list', list: 'bullet', level: 1, runs: [{ text: 'Nested bullet' }] },
    { id: 'b10', type: 'list', list: 'numbered', runs: [{ text: 'First' }] },
    { id: 'b11', type: 'list', list: 'numbered', runs: [{ text: 'Second' }] },
    { id: 'b12', type: 'list', list: 'todo', runs: [{ text: 'To do' }] },
    { id: 'b13', type: 'list', list: 'todo', checked: true, runs: [{ text: 'Done' }] },
    { id: 'b14', type: 'code', text: 'const a = 1;\n  return a;' },
    { id: 'b15', type: 'divider' },
    {
      id: 'z1',
      type: 'zone',
      zone: 'object',
      width: 300,
      height: 200,
      at: { page: page.id, x: 120, y: 400 },
    },
    { id: 'b16', type: 'pageBreak' },
    {
      id: 'z2',
      type: 'zone',
      zone: 'drawing',
      wrap: 'left',
      width: 400,
      height: 240,
      at: { page: page.id, x: 100, y: 680 },
    },
    { id: 'b17', type: 'paragraph', runs: [{ text: 'Text beside the drawing' }] },
    // A zone never laid out has nothing to draw.
    { id: 'z3', type: 'zone', zone: 'object', width: 100, height: 100 },
    { id: 'b18', type: 'paragraph', style: 'h1', runs: [] },
    { id: 'b19', type: 'paragraph', runs: [] },
  ];
  const tab = { ...withArticleFlow(chosen, 'flow-1', { blocks }), elements: [image, shape] };
  return { tab, pages: laid };
}

/** A deck of `n` slides, each with a title, a body, two shapes and a chart. */
export function longDeckTab(n: number): { tab: Tab; pages: LaidOutPage[] } {
  const pages = Array.from({ length: n }, (_, i) => newSlidePage(`page-${i + 1}`));
  const laid = layOutPages(pages);
  const elements: Element[] = laid.flatMap((page, i) => [
    at({ ...createText(0, 0), label: `Slide ${i + 1}`, width: 1600, height: 120 }, page, 160, 80),
    at(
      { ...createText(0, 0), label: 'A line of body text\nand another', width: 1600, height: 300 },
      page,
      160,
      260,
    ),
    at({ ...createShape('square', 0, 0), label: 'One' }, page, 160, 640),
    at({ ...createShape('circle', 0, 0), label: 'Two' }, page, 560, 640),
    at({ ...createShape('pie-chart', 0, 0) }, page, 1100, 600),
  ]);
  return { tab: { id: 'long', name: 'Long', elements, pages, templateChosen: true }, pages: laid };
}

/** An article of `pages` pages' worth of writing: a heading, five paragraphs, a list and a zone a page. */
export function longArticleTab(pages: number): { tab: Tab; pages: LaidOutPage[] } {
  const { tab: base, pages: laid } = everyBlockArticle();
  const page = laid[0]!;
  const blocks: ArticleBlock[] = [];
  for (let p = 0; p < pages; p++) {
    blocks.push({
      id: `h${p}`,
      type: 'paragraph',
      style: 'h1',
      runs: [{ text: `Section ${p + 1}` }],
    });
    for (let k = 0; k < 5; k++)
      blocks.push({
        id: `p${p}-${k}`,
        type: 'paragraph',
        runs: [{ text: 'A sentence of the article that runs long enough to wrap. '.repeat(4) }],
      });
    blocks.push({ id: `l${p}`, type: 'list', list: 'numbered', runs: [{ text: 'An item' }] });
    blocks.push({
      id: `z${p}`,
      type: 'zone',
      zone: 'object',
      width: 300,
      height: 200,
      at: { page: page.id, x: 120, y: 400 },
    });
  }
  return { tab: withArticleFlow(base, 'flow-1', { blocks }), pages: laid };
}
