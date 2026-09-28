// Logo-design template: a brand-exploration sheet for a made-up coffee
// roaster. Six labelled artboards (frames, so each lockup drags as one)
// show the compositions a designer actually weighs up: horizontal and
// stacked lockups with and without a tagline, the mark alone as an app
// icon, and a one-colour version. A palette strip underneath records the
// brand colours with their hex codes, so the sheet reads as a finished
// deliverable and the user edits rather than invents.
//
// Every lockup shares one mark (a sunrise disc) and one wordmark, built by
// the private helpers below, so the six variants stay consistent when the
// spacing constants change. See docs/specs/008-canvas/canvas-and-palette.md "Templates".
//
// Each builder is pure: takes a centre (cx, cy), returns a fresh Element[].

import { createShape, createText, type Element } from '@livediagram/diagram';

// The brand palette. Fills that carry the identity set `themeLockFill` so a
// theme switch can't flatten them into the theme's single element fill.
const ESPRESSO = '#3b1f14';
const SUNRISE = '#f59e0b';
const CREMA = '#fef3c7';
const INK = '#1f2937';
const TAGLINE = '#92400e';
const MUTED = '#64748b';

const BRAND = 'Sunny Side';
const TAG = 'Small-batch, roasted at dawn';

// Artboard grid: three columns by two rows.
const BOARD_W = 380;
const BOARD_H = 240;
const GAP = 40;
const CAPTION_H = 28;

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
    height: 44,
    label: BRAND,
    textSize: 'lg',
    textBold: true,
    textColor: color,
    textAlignX: align,
  };
}

function tagline(x: number, y: number, w: number, align: 'left' | 'center'): Element {
  return {
    ...createText(x, y),
    width: w,
    height: 24,
    label: TAG,
    textSize: 'sm',
    textColor: TAGLINE,
    textAlignX: align,
  };
}

type Variant = 'horizontal' | 'stacked' | 'app-icon' | 'horizontal-tag' | 'stacked-tag' | 'mono';

// One lockup composed around the artboard centre (bx, by). Widths are the
// measured ink of the Inter wordmark at `lg` (about 170px) plus a little
// slack, so the horizontal lockups sit optically centred instead of
// trailing an empty text box.
function lockup(variant: Variant, bx: number, by: number): Element[] {
  const wordW = 176;
  if (variant === 'horizontal' || variant === 'horizontal-tag' || variant === 'mono') {
    const size = 72;
    const gap = 18;
    const withTag = variant === 'horizontal-tag';
    const textW = withTag ? 236 : wordW;
    const left = bx - (size + gap + textW) / 2;
    const blockH = withTag ? 44 + 26 : 44;
    const textTop = by - blockH / 2;
    const mono = variant === 'mono';
    const els = [
      ...mark(left, by - size / 2, size, mono ? INK : SUNRISE, mono ? '#ffffff' : ESPRESSO),
      wordmark(left + size + gap, textTop, textW, mono ? INK : ESPRESSO, 'left'),
    ];
    if (withTag) els.push(tagline(left + size + gap, textTop + 46, textW, 'left'));
    return els;
  }
  if (variant === 'app-icon') {
    // The mark alone on a rounded app-icon tile: the favicon / avatar test.
    const tile = 150;
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
      ...mark(bx - 48, by - 48, 96, SUNRISE, ESPRESSO),
    ];
  }
  const size = 80;
  const withTag = variant === 'stacked-tag';
  const blockH = size + 12 + 44 + (withTag ? 26 : 0);
  const top = by - blockH / 2;
  const textW = 240;
  const els = [
    ...mark(bx - size / 2, top, size, SUNRISE, ESPRESSO),
    wordmark(bx - textW / 2, top + size + 12, textW, ESPRESSO, 'center'),
  ];
  if (withTag) els.push(tagline(bx - textW / 2, top + size + 12 + 46, textW, 'center'));
  return els;
}

export function buildLogoDesign(cx: number, cy: number): Element[] {
  const gridW = BOARD_W * 3 + GAP * 2;
  const left = cx - gridW / 2;
  const titleH = 84;
  const paletteH = 150;
  const gridH = (CAPTION_H + BOARD_H) * 2 + GAP;
  const top = cy - (titleH + gridH + GAP + paletteH) / 2;

  const out: Element[] = [
    {
      ...createText(left, top),
      width: gridW,
      height: 44,
      label: `${BRAND} Roasters · Logo exploration`,
      textSize: 'lg',
      textBold: true,
    },
    {
      ...createText(left, top + 46),
      width: gridW,
      height: 24,
      label: 'Pick the lockup that fits, delete the rest, then swap in your own mark and name.',
      textSize: 'sm',
      textColor: MUTED,
    },
  ];

  const boards: { variant: Variant; title: string }[] = [
    { variant: 'horizontal', title: '01 · Horizontal' },
    { variant: 'stacked', title: '02 · Stacked' },
    { variant: 'app-icon', title: '03 · App icon' },
    { variant: 'horizontal-tag', title: '04 · Horizontal + tagline' },
    { variant: 'stacked-tag', title: '05 · Stacked + tagline' },
    { variant: 'mono', title: '06 · One colour' },
  ];
  const gridTop = top + titleH;
  boards.forEach((b, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = left + col * (BOARD_W + GAP);
    const y = gridTop + row * (CAPTION_H + BOARD_H + GAP);
    out.push({
      ...createText(x, y),
      width: BOARD_W,
      height: 24,
      label: b.title,
      textSize: 'sm',
      textBold: true,
      textColor: MUTED,
    });
    // A frame, so dragging an artboard carries its lockup with it.
    out.push({
      ...createShape('frame', x, y + CAPTION_H),
      width: BOARD_W,
      height: BOARD_H,
      label: '',
      fillColor: '#ffffff',
      strokeColor: '#cbd5e1',
      strokeWidth: 'thin',
      themeLockFill: true,
    });
    out.push(...lockup(b.variant, x + BOARD_W / 2, y + CAPTION_H + BOARD_H / 2));
  });

  // Palette strip: four locked swatches, each captioned with its name + hex.
  const paletteTop = gridTop + gridH + GAP;
  out.push({
    ...createText(left, paletteTop),
    width: gridW,
    height: 24,
    label: 'Palette',
    textSize: 'sm',
    textBold: true,
    textColor: MUTED,
  });
  const swatches = [
    { name: 'Espresso', hex: ESPRESSO },
    { name: 'Sunrise', hex: SUNRISE },
    { name: 'Crema', hex: CREMA },
    { name: 'Ink', hex: INK },
  ];
  const swatchW = (gridW - GAP * 3) / 4;
  const swatchH = 72;
  swatches.forEach((s, i) => {
    const x = left + i * (swatchW + GAP);
    const y = paletteTop + CAPTION_H;
    out.push({
      ...createShape('square', x, y),
      width: swatchW,
      height: swatchH,
      label: '',
      borderRadius: 'lg',
      fillColor: s.hex,
      strokeColor: s.hex === CREMA ? '#fcd34d' : s.hex,
      themeLockFill: true,
    });
    out.push({
      ...createText(x, y + swatchH + 8),
      width: swatchW,
      height: 24,
      label: `${s.name} · ${s.hex.toUpperCase()}`,
      textSize: 'sm',
    });
  });
  return out;
}
