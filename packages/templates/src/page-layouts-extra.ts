// More page layouts (docs/specs/007-editor/infographic-pages.md "Layouts"): a quote, a team, a
// facts grid, a checklist and an event poster. Same contract as page-layouts.ts: the page's
// content box in, uncoloured elements out, a tall page stacking and a wide one setting side by side.
import type { Element } from '@livediagram/document';
import { heading, kit, type Kit, type LayoutBox } from './page-layout-kit';

// An avatar: a round image placeholder.
function avatar(k: Kit, x: number, y: number, d: number): Element {
  return { ...k.image(x, y, d, d), borderRadius: 'full', aspectLocked: true };
}

export function quotePage(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const markH = u * 24;
  const quoteH = H * (k.wide ? 0.4 : 0.42);
  const d = u * 16;
  const attrY = markH + quoteH + u * 8;
  const textX = d + u * 5;
  return [
    k.title(0, 0, u * 20, markH, '“'),
    k.text(
      0,
      markH,
      k.wide ? W * 0.85 : W,
      quoteH,
      'Put the one line people should remember here, in the words of someone who said it.',
      { textSize: 'lg', textScale: k.wide ? 1.5 : 1.8 },
    ),
    avatar(k, 0, attrY, d),
    k.text(textX, attrY + u * 2, W - textX, u * 7, 'Alex Morgan', {
      textSize: 'lg',
      textBold: true,
    }),
    k.text(textX, attrY + u * 9, W - textX, u * 7, 'Head of Product, Acme'),
  ];
}

const TEAM = [
  ['Amara Okafor', 'Chief executive'],
  ['Tom Reyes', 'Engineering'],
  ['Lena Fischer', 'Design'],
  ['Sam Patel', 'Sales'],
  ['Mia Chen', 'Operations'],
  ['Jon Ade', 'Support'],
] as const;

export function teamPage(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = heading(k, 'Meet the team', 'The people behind the work.');
  // Three across unless the page is clearly taller than wide (a square takes three).
  const cols = W >= H * 0.9 ? 3 : 2;
  const rows = TEAM.length / cols;
  const cellW = W / cols;
  const cellH = (H - head.top) / rows;
  const d = Math.min(cellW * 0.5, cellH - u * 17, u * 28);
  return [
    ...head.els,
    ...TEAM.flatMap(([name, role], i) => {
      const x = (i % cols) * cellW;
      const y = head.top + Math.floor(i / cols) * cellH;
      return [
        avatar(k, x + (cellW - d) / 2, y, d),
        k.text(x, y + d + u * 3, cellW, u * 7, name, {
          textSize: 'lg',
          textBold: true,
          textAlignX: 'center',
        }),
        k.text(x, y + d + u * 10, cellW, u * 6, role, { textAlignX: 'center' }),
      ];
    }),
  ];
}

const FACTS = [
  ['users', '12k', 'People reached'],
  ['trending-up', '+38%', 'Growth this year'],
  ['clock', '4 min', 'Average reply'],
  ['star', '4.9', 'Average rating'],
  ['heart', '96%', 'Would recommend'],
  ['award', '7', 'Awards won'],
] as const;

export function factsGridPage(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = heading(k, 'By the numbers', 'Six facts worth knowing.');
  // Three across unless the page is clearly taller than wide (a square takes three).
  const cols = W >= H * 0.9 ? 3 : 2;
  const rows = FACTS.length / cols;
  const gap = u * 4;
  const cardW = (W - gap * (cols - 1)) / cols;
  const cardH = (H - head.top - gap * (rows - 1)) / rows;
  const pad = u * 4;
  const icon = Math.min(u * 10, cardH * 0.22);
  const figureH = Math.min(cardH * 0.34, u * 18);
  return [
    ...head.els,
    ...FACTS.flatMap(([iconId, figure, caption], i) => {
      const x = (i % cols) * (cardW + gap);
      const y = head.top + Math.floor(i / cols) * (cardH + gap);
      return [
        k.shape('square', x, y, cardW, cardH, { borderRadius: 'lg', label: '' }),
        k.shape('icon', x + pad, y + pad, icon, icon, { iconId }),
        k.title(x + pad, y + pad + icon + u * 2, cardW - 2 * pad, figureH, figure),
        k.text(x + pad, y + pad + icon + figureH + u * 3, cardW - 2 * pad, u * 7, caption),
      ];
    }),
  ];
}

const CHECKS = [
  ['Agree the date and the goal', true],
  ['Write the announcement', true],
  ['Design the page', true],
  ['Test with five real people', false],
  ['Brief the support team', false],
  ['Hit publish', false],
] as const;

// Each item a row at page type size: a ticked circle when done, an empty ring when not.
export function checklistPage(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = heading(k, 'Launch checklist', 'Everything to tick off before the big day.');
  const barH = u * 5;
  const listH = H - head.top - barH - u * 14;
  const rowH = Math.min(u * 20, listH / CHECKS.length);
  const mark = Math.min(u * 9, rowH * 0.6);
  const done = CHECKS.filter(([, d]) => d).length;
  return [
    ...head.els,
    ...CHECKS.flatMap(([line, isDone], i) => {
      const y = head.top + i * rowH;
      return [
        isDone
          ? k.shape('icon', 0, y, mark, mark, { iconId: 'check-circle' })
          : k.shape('circle', mark * 0.08, y + mark * 0.08, mark * 0.84, mark * 0.84, {
              label: '',
            }),
        k.text(mark + u * 5, y, W - mark - u * 5, mark, line, {
          textSize: 'lg',
          textAlignY: 'middle',
        }),
      ];
    }),
    k.text(0, H - barH - u * 8, W, u * 6, `${done} of ${CHECKS.length} done`, { textBold: true }),
    k.shape('progress-bar', 0, H - barH, W, barH, {
      progress: Math.round((done / CHECKS.length) * 100),
    }),
  ];
}

const DETAILS = [
  ['calendar', 'Saturday 14 November'],
  ['clock', '6pm until late'],
  ['flag', 'The Old Library, Market Street'],
] as const;

export function eventPage(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const ctaH = u * 20;
  const titleW = k.wide ? W * 0.52 : W;
  const intro = [
    k.text(0, 0, titleW, u * 6, "YOU'RE INVITED", { textBold: true }),
    k.title(0, u * 7, titleW, u * 18, 'Summer Meetup'),
  ];
  const rows = (x: number, y: number, w: number, rowH: number) =>
    DETAILS.flatMap(([iconId, line], i) => {
      const ry = y + i * rowH;
      const icon = Math.min(u * 9, rowH * 0.7);
      return [
        k.shape('icon', x, ry, icon, icon, { iconId }),
        k.text(x + icon + u * 4, ry, w - icon - u * 4, icon, line, {
          textSize: 'lg',
          textAlignY: 'middle',
        }),
      ];
    });
  const cta = k.shape('banner', 0, H - ctaH, W, ctaH, {
    label: 'Save your spot',
    pageSubtitle: 'Reply by 1 November',
  });
  if (k.wide) {
    const imgX = W * 0.56;
    return [
      ...intro,
      ...rows(0, u * 30, titleW, (H - ctaH - u * 34) / DETAILS.length),
      k.image(imgX, 0, W - imgX, H - ctaH - u * 5),
      cta,
    ];
  }
  const imgY = u * 28;
  const imgH = (H - ctaH - imgY) * 0.5;
  const rowsY = imgY + imgH + u * 6;
  return [
    ...intro,
    k.image(0, imgY, W, imgH),
    ...rows(0, rowsY, W, (H - ctaH - u * 5 - rowsY) / DETAILS.length),
    cta,
  ];
}

// The builders by id, for the catalogue in page-layouts.ts.
export const buildQuote = (b: LayoutBox) => quotePage(kit(b));
export const buildTeam = (b: LayoutBox) => teamPage(kit(b));
export const buildFactsGrid = (b: LayoutBox) => factsGridPage(kit(b));
export const buildChecklist = (b: LayoutBox) => checklistPage(kit(b));
export const buildEvent = (b: LayoutBox) => eventPage(kit(b));
