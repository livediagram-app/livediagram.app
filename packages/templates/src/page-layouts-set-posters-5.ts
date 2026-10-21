// Posters layouts, part four (docs/specs/007-editor/pages-mode.md "Layouts"): a big sale, a
// workplace notice and a motivational poster. Pure builders on the shared kit: the page's content
// box in, uncoloured elements out, a tall page stacking and a squarer or wide one side by side.
import type { Element } from '@liveplanner/document';
import { kit, type Kit, type LayoutBox } from './page-layout-kit';
import { iconDisc, iconRow } from './page-layout-parts';
import {
  accentRule,
  centredTitle,
  column,
  eyebrow,
  hairline,
  isSplit,
  matchedTitles,
  type Block,
} from './page-layouts-set-posters-kit';

const centre = { textAlignX: 'center' } as const;

// The sale's burst: a big disc with "Up to 50% off" set inside it and two stars at its edge.
function burst(k: Kit, cx: number, y: number, d: number): Element[] {
  const x = cx - d / 2;
  return [
    k.shape('circle', x, y, d, d, { label: '' }),
    k.shape('star', cx + d * 0.26, y, d * 0.22, d * 0.22, { label: '' }),
    k.shape('star', x, y + d * 0.76, d * 0.16, d * 0.16, { label: '' }),
    eyebrow(k, x, y + d * 0.2, d, 'UP TO', centre),
    centredTitle(k, x + d * 0.1, y + d * 0.28, d * 0.8, d * 0.34, '50%'),
    centredTitle(k, x + d * 0.2, y + d * 0.6, d * 0.6, d * 0.16, 'OFF'),
  ];
}

const DEPARTMENTS = ['Sofas', 'Beds', 'Lighting', 'Rugs'] as const;

function bigSale(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const split = isSplit(k);
  const x = split ? W * 0.5 + u * 4 : 0;
  const w = W - x;
  // The departments as pills: one row, or two of two in a narrow column.
  const perRow = w > u * 70 ? DEPARTMENTS.length : 2;
  const pillH = u * 10;
  const pills = (y: number): Element[] => {
    const gap = u * 2;
    const pw = (w - gap * (perRow - 1)) / perRow;
    return DEPARTMENTS.map((name, i) =>
      k.shape(
        'stadium',
        x + (i % perRow) * (pw + gap),
        y + Math.floor(i / perRow) * (pillH + gap),
        pw,
        pillH,
        { label: name, textBold: true },
      ),
    );
  };
  const words: Block[] = [
    {
      h: u * 10,
      grow: 0.3,
      max: u * 16,
      draw: (y, h) => [centredTitle(k, x, y, w, h, 'Everything must go')],
    },
    {
      h: w > u * 70 ? u * 7 : u * 12,
      gap: u * 2,
      draw: (y, h) => [
        k.text(x, y, w, h, 'Friday 1 to Sunday 10 August', {
          textSize: 'lg',
          textBold: true,
          ...centre,
        }),
      ],
    },
    {
      h: pillH * (DEPARTMENTS.length / perRow) + u * 2 * (DEPARTMENTS.length / perRow - 1),
      gap: u * 6,
      draw: pills,
    },
    {
      h: u * 15,
      gap: u * 6,
      draw: (y, h) => [
        k.shape('banner', x, y, w, h, {
          label: 'In store and online',
          pageSubtitle: 'homestead.co.uk/sale · While stocks last',
          borderRadius: 'md',
        }),
      ],
    },
  ];
  if (split) {
    const d = Math.min(H * 0.9, W * 0.46);
    return [
      ...burst(k, W * 0.25, (H - d) / 2, d),
      ...column(
        0,
        H,
        [{ h: u * 6, draw: (y) => [eyebrow(k, x, y, w, 'SUMMER SALE', centre)] }, ...words],
        u * 4,
        true,
      ),
    ];
  }
  return column(
    0,
    H,
    [
      { h: u * 6, draw: (y) => [eyebrow(k, 0, y, W, 'SUMMER SALE', centre)] },
      {
        h: u * 40,
        grow: 1,
        max: W * 0.82,
        gap: u * 3,
        draw: (y, h) => {
          const d = Math.min(h, W * 0.82);
          return burst(k, W / 2, y + (h - d) / 2, d);
        },
      },
      { ...words[0]!, gap: u * 5 },
      ...words.slice(1),
    ],
    u * 4,
  );
}

const RULES = [
  'Wear a hi-vis jacket at all times',
  'Sign in at the site office first',
  'Visitors must be escorted',
] as const;

function notice(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const split = isSplit(k);
  // The sign's head: a tinted band, a warning icon at each end and the word set large.
  const bandH = u * 22;
  const icon = u * 12;
  const band = [
    k.shape('square', 0, 0, W, bandH, { label: '', borderRadius: 'md' }),
    k.shape('icon', u * 6, (bandH - icon) / 2, icon, icon, { iconId: 'alert-triangle' }),
    k.shape('icon', W - u * 6 - icon, (bandH - icon) / 2, icon, icon, {
      iconId: 'alert-triangle',
    }),
    centredTitle(k, icon + u * 10, u * 3, W - 2 * (icon + u * 10), bandH - u * 6, 'CAUTION'),
  ];
  const top = bandH + u * 6;
  const x = split ? W * 0.36 + u * 6 : 0;
  const w = W - x;
  const align = split ? {} : centre;
  const headline: Block = {
    h: u * 18,
    grow: 1,
    max: u * 28,
    draw: (y, h) =>
      matchedTitles(
        k,
        [
          [x, y, w, h / 2, 'Hard hats must be worn'],
          [x, y + h / 2, w, h / 2, 'beyond this point'],
        ],
        align,
      ),
  };
  const rules: Block = {
    h: u * 27,
    gap: u * 6,
    draw: (y, h) => {
      const rowH = h / RULES.length;
      const ic = Math.min(u * 7, rowH * 0.8);
      const rx = split ? x : W * 0.12;
      return RULES.flatMap((line, i) =>
        iconRow(
          k,
          rx,
          y + i * rowH + (rowH - ic) / 2,
          split ? w : W * 0.8,
          ic,
          'check-circle',
          line,
          {
            textSize: 'lg',
          },
        ),
      );
    },
  };
  const foot: Block = {
    h: u * 10,
    gap: u * 6,
    draw: (y) => [
      hairline(k, x, y, w, u * 0.8),
      k.text(x, y + u * 3, w, u * 7, 'Site office: extension 214 · Emergency: 999', {
        textBold: true,
        ...align,
      }),
    ],
  };
  if (split) {
    const d = Math.min(W * 0.36, H - top);
    return [
      ...band,
      ...iconDisc(k, 0, top + (H - top - d) / 2, d, 'shield').els,
      ...column(top, H - top, [headline, rules, foot], u * 4, true),
    ];
  }
  return [
    ...band,
    ...column(
      top,
      H - top,
      [
        {
          h: u * 26,
          grow: 1,
          max: u * 50,
          draw: (y, h) => iconDisc(k, (W - h) / 2, y, h, 'shield').els,
        },
        { ...headline, gap: u * 6 },
        rules,
        foot,
      ],
      u * 4,
    ),
  ];
}

const MANTRA = [
  ['START', 'where you are.'],
  ['USE', 'what you have.'],
  ['DO', 'what you can.'],
] as const;

function motivational(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const pad = u * 8;
  const iw = W - pad * 2;
  const frame = k.shape('square', 0, 0, W, H, { label: '', borderRadius: 'none' });
  const sign: Block[] = [
    { h: u * 1.2, gap: u * 6, draw: (y) => [accentRule(k, (W - u * 14) / 2, y)] },
    { h: u * 6, gap: u * 4, draw: (y) => [eyebrow(k, pad, y, iw, 'ARTHUR ASHE', centre)] },
  ];
  if (k.wide) {
    // The three lines side by side, each a word set huge over its phrase.
    const gap = u * 4;
    const cw = (iw - gap * 2) / 3;
    // The words share one size, fitted with room to spare so the widest never wraps.
    const wordH = u * 36;
    const phraseH = u * 9;
    const pairs = (y: number): Element[] => {
      const xs = MANTRA.map((_, i) => pad + i * (cw + gap));
      const fit = (row: 0 | 1, ty: number, th: number) =>
        matchedTitles(
          k,
          MANTRA.map((m, i) => [xs[i]!, ty, cw, th, m[row]] as const),
          centre,
        );
      return [...fit(0, y, wordH), ...fit(1, y + wordH + u * 2, phraseH)];
    };
    return [
      frame,
      ...column(
        pad,
        H - pad * 2,
        [{ h: wordH + u * 2 + phraseH, draw: pairs }, ...sign],
        u * 4,
        true,
      ),
    ];
  }
  return [
    frame,
    ...column(
      pad,
      H - pad * 2,
      [
        ...MANTRA.flatMap(([word, phrase], i): Block[] => [
          {
            h: u * 12,
            grow: 1,
            max: u * 26,
            gap: i === 0 ? 0 : u * 4,
            draw: (y, h) => [centredTitle(k, pad, y, iw, h, word)],
          },
          {
            h: u * 7,
            grow: 0.2,
            max: u * 10,
            gap: 0,
            draw: (y, h) => [centredTitle(k, pad, y, iw, h, phrase)],
          },
        ]),
        ...sign,
      ],
      u * 4,
    ),
  ];
}

export const buildBigSale = (b: LayoutBox) => bigSale(kit(b));
export const buildNotice = (b: LayoutBox) => notice(kit(b));
export const buildMotivational = (b: LayoutBox) => motivational(kit(b));
