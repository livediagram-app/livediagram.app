// Logo-design template (docs/specs/008-canvas/canvas-and-palette.md "Templates on pages"): a
// brand exploration for a made-up coffee roaster that opens in Illustrate, one Square page per
// artboard. Six lockup pages show the compositions a designer actually weighs up: horizontal and
// stacked lockups with and without a tagline, the mark alone as an app icon, and a one-colour
// version, each captioned with its number and where it gets used. A seventh page records the brand
// palette with names, roles and hex codes, so the exploration reads as a finished deliverable and
// the user edits rather than invents.
//
// Every lockup shares one mark (a sunrise disc) and one wordmark, built by the private helpers
// below at page scale, so the six variants stay consistent when the spacing constants change.
//
// Pure: () -> Element[], placed on the exploration's pages (logoDesignPages) whatever centre is
// passed.

import { createShape, createText, type Element, type IllustratePage } from '@livediagram/document';
import { heading, type Kit } from './page-layout-kit';
import { pageKits, templatePage } from './template-page-kit';

// The brand palette. Fills that carry the identity set `themeLockFill` so a
// theme switch can't flatten them into the theme's single element fill.
const ESPRESSO = '#3b1f14';
const SUNRISE = '#f59e0b';
const CREMA = '#fef3c7';
const INK = '#1f2937';
const TAGLINE = '#92400e';

const BRAND = 'Sunny Side';
const TAG = 'Small-batch, roasted at dawn';

// The lockups are drawn at this multiple of their artboard-sheet size: page scale on a Square.
const S = 2.5;

// The mark: a sunrise disc with a sun glyph, sized per lockup.
function mark(x: number, y: number, size: number, fill: string, glyph: string): Element[] {
  const inset = size * 0.2;
  return [
    {
      ...createShape('circle', x, y),
      width: size,
      height: size,
      label: '',
      fillColor: fill,
      strokeColor: fill,
      themeLockFill: true,
    },
    {
      ...createShape('icon', x + inset, y + inset),
      width: size - inset * 2,
      height: size - inset * 2,
      label: '',
      iconId: 'sun',
      iconWeight: 'bold',
      strokeColor: glyph,
    },
  ];
}

function wordmark(
  x: number,
  y: number,
  w: number,
  color: string,
  align: 'left' | 'center',
): Element {
  return {
    ...createText(x, y),
    width: w,
    height: 44 * S,
    label: BRAND,
    textSize: 'lg',
    textScale: S,
    textBold: true,
    textColor: color,
    textAlignX: align,
  };
}

function tagline(x: number, y: number, w: number, align: 'left' | 'center'): Element {
  return {
    ...createText(x, y),
    width: w,
    height: 24 * S,
    label: TAG,
    textSize: 'sm',
    textScale: S,
    textColor: TAGLINE,
    textAlignX: align,
  };
}

type Variant = 'horizontal' | 'stacked' | 'app-icon' | 'horizontal-tag' | 'stacked-tag' | 'mono';

// One lockup composed around the artboard centre (bx, by). Widths are the
// measured ink of the Inter wordmark at `lg` (about 170px, times S) plus a
// little slack, so the horizontal lockups sit optically centred instead of
// trailing an empty text box.
function lockup(variant: Variant, bx: number, by: number): Element[] {
  const wordW = 176 * S;
  const wordH = 44 * S;
  if (variant === 'horizontal' || variant === 'horizontal-tag' || variant === 'mono') {
    const size = 72 * S;
    const gap = 18 * S;
    const withTag = variant === 'horizontal-tag';
    const textW = withTag ? 236 * S : wordW;
    const left = bx - (size + gap + textW) / 2;
    const blockH = withTag ? wordH + 26 * S : wordH;
    const textTop = by - blockH / 2;
    const mono = variant === 'mono';
    const els = [
      ...mark(left, by - size / 2, size, mono ? INK : SUNRISE, mono ? '#ffffff' : ESPRESSO),
      wordmark(left + size + gap, textTop, textW, mono ? INK : ESPRESSO, 'left'),
    ];
    if (withTag) els.push(tagline(left + size + gap, textTop + 46 * S, textW, 'left'));
    return els;
  }
  if (variant === 'app-icon') {
    // The mark alone on a rounded app-icon tile: the favicon / avatar test.
    const tile = 150 * S;
    const size = 96 * S;
    return [
      {
        ...createShape('square', bx - tile / 2, by - tile / 2),
        width: tile,
        height: tile,
        label: '',
        borderRadius: 'lg',
        fillColor: ESPRESSO,
        strokeColor: ESPRESSO,
        themeLockFill: true,
      },
      ...mark(bx - size / 2, by - size / 2, size, SUNRISE, ESPRESSO),
    ];
  }
  const size = 80 * S;
  const gap = 12 * S;
  const withTag = variant === 'stacked-tag';
  const blockH = size + gap + wordH + (withTag ? 26 * S : 0);
  const top = by - blockH / 2;
  const textW = 240 * S;
  const els = [
    ...mark(bx - size / 2, top, size, SUNRISE, ESPRESSO),
    wordmark(bx - textW / 2, top + size + gap, textW, ESPRESSO, 'center'),
  ];
  if (withTag) els.push(tagline(bx - textW / 2, top + size + gap + 46 * S, textW, 'center'));
  return els;
}

type Board = { variant: Variant; name: string; use: string };

const BOARDS: Board[] = [
  {
    variant: 'horizontal',
    name: 'Horizontal',
    use: 'Use it on the website header, email signatures and the menu board.',
  },
  { variant: 'stacked', name: 'Stacked', use: 'Use it on bags, cups and anywhere square.' },
  {
    variant: 'app-icon',
    name: 'App Icon',
    use: 'Use it as the app icon, the favicon and every social avatar.',
  },
  {
    variant: 'horizontal-tag',
    name: 'Horizontal + Tagline',
    use: 'Use it on the shop front and printed ads, where there is room to read.',
  },
  {
    variant: 'stacked-tag',
    name: 'Stacked + Tagline',
    use: 'Use it on posters and the about page.',
  },
  {
    variant: 'mono',
    name: 'One Colour',
    use: 'Use it on stamps, receipts and engraving, wherever there is one ink.',
  },
];

const SWATCHES = [
  { name: 'Espresso', role: 'Primary: the wordmark and the app tile', hex: ESPRESSO },
  { name: 'Sunrise', role: 'Accent: the mark, and nothing else', hex: SUNRISE },
  { name: 'Crema', role: 'Background: packaging and the shop walls', hex: CREMA },
  { name: 'Ink', role: 'Text: body copy and one-colour prints', hex: INK },
];

/** The exploration's pages: a Square page per lockup, then the palette. The app icon sits on
 *  Crema, the way a launcher would show it. */
export function logoDesignPages(): IllustratePage[] {
  return [
    ...BOARDS.map((b, i) =>
      templatePage(
        i + 1,
        'square',
        'portrait',
        b.name,
        b.variant === 'app-icon' ? { fill: { kind: 'solid', color: CREMA } } : undefined,
      ),
    ),
    templatePage(BOARDS.length + 1, 'square', 'portrait', 'Palette'),
  ];
}

// A lockup page: its number and name, the brand, the lockup centred in the room left, and where
// the lockup gets used. The first page also says how to use the exploration.
function boardPage(k: Kit, b: Board, i: number): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const els: Element[] = [
    k.text(0, 0, W * 0.6, u * 6, `${String(i + 1).padStart(2, '0')} · ${b.name}`, {
      textSize: 'lg',
      textBold: true,
    }),
    k.text(W * 0.5, 0, W * 0.5, u * 6, `${BRAND} Roasters`, { textAlignX: 'right' }),
    k.text(0, H - u * 6, W, u * 6, b.use),
  ];
  if (i === 0) {
    els.push(
      k.text(
        0,
        u * 8,
        W * 0.9,
        u * 10,
        'Pick the lockup that fits, delete the other pages, then swap in your own mark and name.',
      ),
    );
  }
  els.push(...lockup(b.variant, k.box.x + W / 2, k.box.y + H / 2));
  return els;
}

// The palette page: a 2 x 2 of locked swatches, each with its name, role and hex code.
function palettePage(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = heading(k, 'Palette', `${BRAND} Roasters, four colours and what each is for.`);
  const gap = u * 6;
  const cellW = (W - gap) / 2;
  const cellH = (H - head.top - gap) / 2;
  const swatchH = cellH - u * 15;
  return [
    ...head.els,
    ...SWATCHES.flatMap((s, i) => {
      const x = (i % 2) * (cellW + gap);
      const y = head.top + Math.floor(i / 2) * (cellH + gap);
      return [
        k.shape('square', x, y, cellW, swatchH, {
          label: '',
          borderRadius: 'lg',
          fillColor: s.hex,
          strokeColor: s.hex === CREMA ? '#fcd34d' : s.hex,
          themeLockFill: true,
        }),
        k.text(x, y + swatchH + u * 2, cellW, u * 6, `${s.name} · ${s.hex.toUpperCase()}`, {
          textSize: 'lg',
          textBold: true,
        }),
        k.text(x, y + swatchH + u * 8, cellW, u * 7, s.role),
      ];
    }),
  ];
}

export function buildLogoDesign(_cx: number, _cy: number): Element[] {
  const kits = pageKits(logoDesignPages());
  return [
    ...BOARDS.flatMap((b, i) => boardPage(kits[i]!, b, i)),
    ...palettePage(kits[BOARDS.length]!),
  ];
}
