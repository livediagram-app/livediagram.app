// Posters layouts, part three (docs/specs/007-editor/pages-mode.md "Layouts"): a travel
// poster and a workshop with a tear-off strip. Pure builders on the shared kit: the page's content
// box in, uncoloured elements out, a tall page stacking and a squarer or wide one side by side.
import type { Element } from '@liveplanner/document';
import { kit, type Kit, type LayoutBox } from './page-layout-kit';
import { iconRow } from './page-layout-parts';
import {
  centredTitle,
  column,
  eyebrow,
  fitTitle,
  hairline,
  isSplit,
} from './page-layouts-set-posters-kit';

const centre = { textAlignX: 'center' } as const;

const TRAVEL_FACTS = [
  ['sun', '300', 'sunny days'],
  ['map-pin', '7', 'hills to climb'],
  ['clock', '2h 40', 'from London'],
] as const;

// The destination's three facts: across in a row, or (`down`) one under another, each an icon
// beside its figure, the caption under the figure.
function travelFacts(k: Kit, x: number, y: number, w: number, h: number, down = false) {
  const { u } = k;
  const n = TRAVEL_FACTS.length;
  const cw = down ? w : w / n;
  const ch = down ? h / n : h;
  const icon = Math.min(u * 8, ch * 0.4);
  const figH = Math.min(u * 11, ch * 0.5);
  return TRAVEL_FACTS.flatMap(([iconId, figure, caption], i): Element[] => {
    const cx = x + (down ? 0 : i * cw);
    const cy = y + (down ? i * ch : 0);
    const tx = cx + icon + u * 3;
    const tw = cw - icon - u * 4;
    return [
      k.shape('icon', cx, cy + (figH - icon) / 2, icon, icon, { iconId }),
      fitTitle(k, tx, cy, tw, figH, figure),
      k.text(tx, cy + figH, tw, Math.max(u * 5, ch - figH), caption),
    ];
  });
}

// The offer as a round stamp: a disc with the fare set large, laid over the photo's corner.
function fareStamp(k: Kit, x: number, y: number, d: number): Element[] {
  return [
    k.shape('circle', x, y, d, d, { label: '' }),
    eyebrow(k, x, y + d * 0.2, d, 'FLY FROM', { ...centre, letterSpacing: 0.15 }),
    centredTitle(k, x + d * 0.15, y + d * 0.36, d * 0.7, d * 0.36, '£79'),
  ];
}

// The foot: a hairline, where to book on the left and by when on the right.
function travelFoot(k: Kit, x: number, y: number, w: number): Element[] {
  const { u } = k;
  const site = 'skyway.com/lisbon';
  const by = 'Book by 31 January';
  // A narrow column stacks the two; a wide one sets them at either end.
  if (w < u * 80) {
    return [
      hairline(k, x, y, w, u * 0.8),
      k.text(x, y + u * 3, w, u * 6, site, { textBold: true, textSize: 'lg' }),
      k.text(x, y + u * 10, w, u * 6, by, { textSize: 'lg' }),
    ];
  }
  return [
    hairline(k, x, y, w, u * 0.8),
    k.text(x, y + u * 3, w * 0.6, u * 6, site, { textBold: true, textSize: 'lg' }),
    k.text(x + w * 0.4, y + u * 3, w * 0.6, u * 6, by, { textSize: 'lg', textAlignX: 'right' }),
  ];
}

function travel(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const footH = u * 10;
  if (isSplit(k)) {
    // The name across the top, the photo down the left with the stamp on its corner, the line
    // and the facts down the right, the foot under them.
    const titleH = u * 20;
    const top = u * 6 + titleH + u * 5;
    const imgW = W * 0.56;
    const rightX = imgW + u * 8;
    const rightW = W - rightX;
    const d = Math.min(u * 30, (H - top) * 0.45);
    return [
      eyebrow(k, 0, 0, W, 'VISIT'),
      fitTitle(k, 0, u * 6, W, titleH, 'LISBON'),
      k.image(0, top, imgW, H - top),
      ...fareStamp(k, imgW - d * 0.8, H - d - u * 3, d),
      ...column(
        top,
        H - top,
        [
          {
            h: u * 12,
            draw: (y, h) => [
              k.text(rightX, y, rightW, h, 'Seven hills, one ocean and endless light', {
                textSize: 'lg',
              }),
            ],
          },
          {
            h: u * 30,
            grow: 1,
            max: u * 48,
            draw: (y, h) => travelFacts(k, rightX, y, rightW, h, true),
          },
          { h: rightW < u * 80 ? u * 17 : footH, draw: (y) => travelFoot(k, rightX, y, rightW) },
        ],
        u * 5,
      ),
    ];
  }
  const d = Math.min(u * 30, W * 0.3);
  let stamp: Element[] = [];
  const body = column(
    0,
    H,
    [
      {
        h: u * 30,
        grow: 1,
        draw: (y, h) => {
          stamp = fareStamp(k, W - d - u * 4, y + h - d * 0.6, d);
          return [k.image(0, y, W, h)];
        },
      },
      { h: u * 6, gap: u * 5, draw: (y) => [eyebrow(k, 0, y, W - d, 'VISIT')] },
      {
        h: u * 20,
        grow: 0.25,
        max: u * 28,
        gap: u * 1,
        draw: (y, h) => [fitTitle(k, 0, y, W - d - u * 8, h, 'LISBON')],
      },
      {
        h: u * 7,
        gap: u * 1,
        draw: (y, h) => [
          k.text(0, y, W, h, 'Seven hills, one ocean and endless light', { textSize: 'lg' }),
        ],
      },
      { h: u * 18, gap: u * 6, draw: (y, h) => travelFacts(k, 0, y, W, h) },
      { h: footH, gap: u * 5, draw: (y) => travelFoot(k, 0, y, W) },
    ],
    u * 4,
  );
  return [...body, ...stamp];
}

const WORKSHOP_POINTS = [
  'All clay, glazes and firing included',
  'Six people a class, one wheel each',
  'Take home everything you make',
] as const;

// The tear-off strip: a dashed tab per contact, its words turned to run up the tab. A turned
// label's own box runs across its neighbours, so the strip is inset by that overhang at each end.
function tearOffStrip(k: Kit, y: number, h: number): Element[] {
  const { width: W } = k.box;
  const { u } = k;
  const tabW = u * 12;
  const textW = h - u * 3;
  const overhang = Math.max(0, (textW - tabW) / 2);
  const n = Math.max(3, Math.floor((W - overhang * 2) / tabW));
  const x0 = (W - n * tabW) / 2;
  return [
    k.text(0, y - u * 7, W, u * 5, 'Tear one off and book your place', {
      textBold: true,
      ...centre,
    }),
    ...Array.from({ length: n }, (_, i) => {
      const tx = x0 + i * tabW;
      return [
        k.shape('square', tx, y, tabW, h, {
          label: '',
          borderRadius: 'none',
          strokeStyle: 'dashed',
        }),
        k.text(
          tx + tabW / 2 - textW / 2,
          y + h / 2 - (tabW - u * 2) / 2,
          textW,
          tabW - u * 2,
          'Pottery class\n07700 900123',
          {
            rotation: -90,
            textAlignX: 'center',
            textAlignY: 'middle',
          },
        ),
      ];
    }).flat(),
  ];
}

function workshop(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const split = isSplit(k);
  const stripH = u * 28;
  const stripY = H - stripH;
  // The room above the strip and its line.
  const room = stripY - u * 10;
  const points = (x: number, y: number, w: number, h: number): Element[] => {
    const rowH = h / WORKSHOP_POINTS.length;
    const icon = Math.min(u * 7, rowH * 0.7);
    return WORKSHOP_POINTS.flatMap((line, i) =>
      iconRow(k, x, y + i * rowH + (rowH - icon) / 2, w, icon, 'check-circle', line, {
        lineH: Math.min(rowH, u * 11),
      }),
    );
  };
  const stats = (x: number, y: number, w: number, h: number) =>
    k.shape('stat-row', x, y, w, h, {
      borderRadius: 'md',
      stats: [
        { value: '7pm', caption: 'Tuesdays' },
        { value: '4', caption: 'Evenings' },
        { value: '£120', caption: 'All in' },
      ],
    });
  const intro = (w: number): Parameters<typeof column>[2] => [
    { h: u * 6, draw: (y) => [eyebrow(k, 0, y, w, 'EVENING CLASS · 4 WEEKS')] },
    {
      h: u * 12,
      grow: 1,
      max: u * 18,
      gap: u * 2,
      draw: (y, h) => [fitTitle(k, 0, y, w, h, 'Pottery for')],
    },
    {
      h: u * 12,
      grow: 1,
      max: u * 18,
      gap: 0,
      draw: (y, h) => [fitTitle(k, 0, y, w, h, 'beginners')],
    },
    {
      h: u * 12,
      gap: u * 2,
      draw: (y, h) => [
        k.text(0, y, w * 0.95, h, 'Throw, trim and glaze your own set of bowls on the wheel.', {
          textSize: 'lg',
        }),
      ],
    },
  ];
  if (split) {
    const leftW = W * 0.54;
    const rightX = leftW + u * 6;
    return [
      ...column(
        0,
        room,
        [...intro(leftW), { h: u * 17, gap: u * 5, draw: (y, h) => [stats(0, y, leftW, h)] }],
        u * 4,
      ),
      ...column(
        0,
        room,
        [
          { h: 0, grow: 1, draw: (y, h) => [k.image(rightX, y, W - rightX, h)] },
          {
            h: u * 27,
            optional: true,
            min: u * 27,
            gap: u * 4,
            draw: (y, h) => points(rightX, y, W - rightX, h),
          },
        ],
        u * 4,
      ),
      ...tearOffStrip(k, stripY, stripH),
    ];
  }
  const imgW = W * 0.44;
  return [
    ...column(
      0,
      room,
      [
        ...intro(W),
        {
          h: u * 30,
          grow: 1,
          gap: u * 5,
          draw: (y, h) => [k.image(0, y, imgW, h), ...points(imgW + u * 6, y, W - imgW - u * 6, h)],
        },
        { h: u * 17, gap: u * 5, draw: (y, h) => [stats(0, y, W, h)] },
      ],
      u * 4,
    ),
    ...tearOffStrip(k, stripY, stripH),
  ];
}

export const buildTravel = (b: LayoutBox) => travel(kit(b));
export const buildWorkshop = (b: LayoutBox) => workshop(kit(b));
