// Posters layouts, part one (docs/specs/007-editor/illustrate-pages.md "Layouts"): a gig poster, a
// film's coming soon and an exhibition. Pure builders on the shared kit: the page's content box in,
// uncoloured elements out. A page taller than SPLIT_RATIO times its width stacks; a squarer or wide
// one sets the words beside the image.
import type { Element } from '@livediagram/document';
import { kit, type Kit, type LayoutBox } from './page-layout-kit';
import {
  accentRule,
  centredTitle,
  column,
  eyebrow,
  fitTitle,
  hairline,
  isSplit,
} from './page-layouts-set-posters-kit';

const centre = { textAlignX: 'center' } as const;

function gigPoster(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const split = isSplit(k);
  const imgW = W * 0.46;
  // The words: down the whole page, or down the left beside the image.
  const x = 0;
  const w = split ? W - imgW - u * 6 : W;
  const details = (y: number, h: number): Element[] => {
    const cells = [
      ['14 NOV', 'Friday'],
      ['7PM', 'Doors'],
      ['£18', 'Advance'],
    ] as const;
    const cw = w / cells.length;
    return [
      hairline(k, x, y, w),
      hairline(k, x, y + h - u * 0.5, w),
      ...[1, 2].map((i) => hairline(k, x + i * cw, y + u * 3, u * 0.5, h - u * 6)),
      ...cells.flatMap(([value, caption], i) => [
        centredTitle(k, x + i * cw + u * 2, y + u * 2.5, cw - u * 4, h * 0.5, value),
        k.text(x + i * cw, y + u * 2.5 + h * 0.5, cw, u * 6, caption, { ...centre }),
      ]),
    ];
  };
  const blocks = [
    { h: u * 6, draw: (y: number) => [eyebrow(k, x, y, w, 'THE FORUM PRESENTS', centre)] },
    {
      h: u * 13,
      grow: 1,
      max: u * 24,
      gap: u * 2,
      draw: (y: number, h: number) => [centredTitle(k, x, y, w, h, 'NIGHT')],
    },
    {
      h: u * 13,
      grow: 1,
      max: u * 24,
      gap: 0,
      draw: (y: number, h: number) => [centredTitle(k, x, y, w, h, 'SWIMMING')],
    },
    {
      h: split ? u * 12 : u * 7,
      gap: u * 2,
      draw: (y: number, h: number) => [
        k.text(x, y, w, h, 'with Lola Grey + The Tides', { textSize: 'lg', ...centre }),
      ],
    },
    ...(split
      ? []
      : [{ h: 0, grow: 4, gap: u * 5, draw: (y: number, h: number) => [k.image(0, y, W, h)] }]),
    { h: u * 19, gap: u * 5, draw: details },
    {
      h: u * 15,
      gap: u * 4,
      draw: (y: number, h: number) => [
        k.shape('banner', x, y, w, h, {
          label: 'Tickets on sale now',
          pageSubtitle: 'The Forum, Kentish Town · forumlive.co.uk · 14+',
          borderRadius: 'md',
        }),
      ],
    },
  ];
  const words = column(0, H, blocks, u * 4);
  return split ? [...words, k.image(W - imgW, 0, imgW, H)] : words;
}

const BILLING =
  'NORTHLIGHT PICTURES PRESENTS · AVA STONE · DEV KAPOOR · MUSIC BY ELENA RUIZ · WRITTEN AND DIRECTED BY SAM OKORO';

function comingSoon(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const split = isSplit(k);
  const imgW = W * 0.5;
  const x = split ? imgW + u * 6 : 0;
  const w = W - x;
  const blocks = [
    ...(split ? [] : [{ h: 0, grow: 5, draw: (y: number, h: number) => [k.image(0, y, W, h)] }]),
    { h: u * 6, gap: u * 5, draw: (y: number) => [eyebrow(k, x, y, w, 'THIS WINTER', centre)] },
    {
      h: u * 11,
      grow: 1,
      max: u * 17,
      gap: u * 1,
      draw: (y: number, h: number) => [centredTitle(k, x, y, w, h, 'THE LAST')],
    },
    {
      h: u * 11,
      grow: 1,
      max: u * 17,
      gap: 0,
      draw: (y: number, h: number) => [centredTitle(k, x, y, w, h, 'LIGHTHOUSE')],
    },
    {
      h: split ? u * 12 : u * 7,
      gap: u * 2,
      draw: (y: number, h: number) => [
        k.text(x, y, w, h, 'Some lights are never meant to go out.', {
          textSize: 'lg',
          textItalic: true,
          ...centre,
        }),
      ],
    },
    {
      h: u * 1.2,
      gap: u * 4,
      draw: (y: number) => [accentRule(k, x + (w - u * 14) / 2, y)],
    },
    {
      h: u * 12,
      grow: 1,
      max: u * 18,
      gap: u * 4,
      draw: (y: number, h: number) => [centredTitle(k, x, y, w, h, '12 . 12 . 26')],
    },
    {
      h: u * 7,
      gap: u * 1,
      draw: (y: number, h: number) => [
        k.text(x, y, w, h, 'In cinemas and on Lumen+', {
          textSize: 'lg',
          textBold: true,
          ...centre,
        }),
      ],
    },
    {
      h: split ? u * 16 : u * 11,
      gap: u * 5,
      draw: (y: number, h: number) => [k.text(x, y, w, h, BILLING, centre)],
    },
  ];
  const words = column(0, H, blocks, u * 4);
  return split ? [k.image(0, 0, imgW, H), ...words] : words;
}

const EXHIBITION_INFO = [
  ['Dates', '12 March\nto 30 June'],
  ['Open', 'Tue to Sun\n10am to 6pm'],
  ['Where', '14 Quay St\nBristol'],
] as const;

// Three columns of facts, each under a hairline: its name in bold and its value.
function infoGrid(k: Kit, x: number, y: number, w: number, h: number): Element[] {
  const { u } = k;
  const gap = u * 4;
  const cw = (w - gap * 2) / 3;
  const size = cw > u * 30 ? 'lg' : 'md';
  return EXHIBITION_INFO.flatMap(([name, value], i) => {
    const cx = x + i * (cw + gap);
    return [
      hairline(k, cx, y, cw, u * 0.8),
      k.text(cx, y + u * 3, cw, u * 6, name, { textBold: true }),
      k.text(cx, y + u * 9, cw, h - u * 9, value, { textSize: size }),
    ];
  });
}

function exhibition(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const split = isSplit(k);
  const header = [
    k.text(0, 0, W * 0.6, u * 6, 'MODERN ART GALLERY', { textBold: true }),
    k.text(W * 0.5, 0, W * 0.5, u * 6, 'FREE ENTRY', { textBold: true, textAlignX: 'right' }),
    hairline(k, 0, u * 8, W, u * 0.8),
  ];
  const top = u * 14;
  const colW = split ? W * 0.48 : W;
  const discD = split ? colW * 0.4 : Math.min(W * 0.42, u * 46);
  let disc: Element | undefined;
  // The title in three steps: two words set huge, "and" small and pushed right between them.
  const words: Parameters<typeof column>[2] = [
    { h: u * 16, grow: 1, max: u * 24, draw: (y, h) => [fitTitle(k, 0, y, colW, h, 'Form')] },
    {
      h: u * 10,
      grow: 0.3,
      max: u * 12,
      gap: 0,
      // "and" set inside a big disc on the right: the one bold shape a Swiss poster leans on.
      draw: (y, h) => {
        const cx = colW - discD / 2;
        disc = k.shape('circle', colW - discD, y + h / 2 - discD / 2, discD, discD, { label: '' });
        return [centredTitle(k, cx - discD * 0.3, y, discD * 0.6, h, 'and')];
      },
    },
    {
      h: u * 16,
      grow: 1,
      max: u * 24,
      gap: 0,
      draw: (y, h) => [fitTitle(k, 0, y, colW, h, 'Colour')],
    },
    {
      h: u * 12,
      gap: u * 3,
      draw: (y, h) => [
        k.text(0, y, colW * 0.9, h, 'Abstract painting in Europe, 1950 to 1975', {
          textSize: 'lg',
        }),
      ],
    },
  ];
  // The image with its caption: under it on a split page, else to one side.
  const artwork = (x: number, y: number, w: number, h: number): Element[] => {
    if (split) {
      return [
        k.image(x, y, w, h - u * 8),
        k.text(x, y + h - u * 6, w, u * 6, 'Ines Varga, Study in Blue, 1968', { textBold: true }),
      ];
    }
    const imgW = w * 0.64;
    const capW = w - imgW - u * 4;
    return [
      hairline(k, x, y, capW, u * 0.8),
      k.text(x, y + u * 3, capW, u * 6, 'Ines Varga', { textBold: true }),
      k.text(x, y + u * 9, capW, u * 14, 'Study in Blue, 1968. Oil on canvas.'),
      k.image(x + capW + u * 4, y, imgW, h),
    ];
  };
  if (split) {
    const rightX = W * 0.52;
    const rightW = W - rightX;
    const title = column(top, H - top, words, u * 4);
    return [
      ...header,
      ...(disc ? [disc] : []),
      ...title,
      ...column(
        top,
        H - top,
        [
          { h: 0, grow: 1, draw: (y, h) => artwork(rightX, y, rightW, h) },
          { h: u * 20, gap: u * 6, draw: (y, h) => infoGrid(k, rightX, y, rightW, h) },
        ],
        u * 4,
      ),
    ];
  }
  const body = column(
    top,
    H - top,
    [
      ...words,
      { h: 0, grow: 4, gap: u * 6, draw: (y, h) => artwork(0, y, W, h) },
      { h: u * 20, gap: u * 6, draw: (y, h) => infoGrid(k, 0, y, W, h) },
    ],
    u * 4,
  );
  return [...header, ...(disc ? [disc] : []), ...body];
}

export const buildGigPoster = (b: LayoutBox) => gigPoster(kit(b));
export const buildComingSoon = (b: LayoutBox) => comingSoon(kit(b));
export const buildExhibition = (b: LayoutBox) => exhibition(kit(b));
