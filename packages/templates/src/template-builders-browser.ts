// The web page wireframe, split out of template-builders-wireframes.ts (which
// re-exports it) when it grew a real landing page and an annotation rail.
// Pure: (cx, cy) -> Element[]. See docs/specs/008-canvas/canvas-and-palette.md "Templates".

import { createShape, type Element } from '@livediagram/document';
import { TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';
import {
  WIREFRAME_HEADING_H,
  WIREFRAME_MUTED,
  annotationPin,
  annotationRail,
  annotationRailHeight,
  textAt,
  uiAt,
  wireframeHeading,
} from './template-wireframe-kit';

// Web page wireframe: a believable landing page for a made-up bookkeeping
// app (Pocketbook), laid out the way converting pages are: a nav with one
// CTA, a hero (eyebrow chip, two-line promise, subcopy, primary + secondary
// buttons, a trust line) beside a product shot that shows real numbers, a
// logo strip of social proof, three benefit cards with line-art glyphs, and
// a footer. Five numbered pins mark the design decisions and match the amber
// notes in a rail on the right, so the template teaches why the page is
// shaped this way, not just what is on it. The browser frame is the "Frames"
// scaffold; the page and its notes are "UI". Colours stay theme-owned; the
// primary CTAs take the bold preset and the eyebrow chip the soft one.
const BROWSER_NOTES = [
  'One promise, in the customer’s words. A/B test the headline before the layout.',
  'The same “Start free trial” label in the nav and the hero: one next step.',
  'Real numbers in the product shot; a blurred mock-up reads as fake.',
  'Social proof sits just above the fold on a 13-inch laptop.',
  'Three benefits, each titled with what the user gets, not the feature name.',
];

export function buildBrowserWireframe(cx: number, cy: number): Element[] {
  const browserW = 1216;
  const browserH = 860;
  const railGap = 64;
  const railW = 300;
  const noteH = 72;
  const totalW = browserW + railGap + railW;
  const totalH = WIREFRAME_HEADING_H + browserH;
  const x0 = cx - totalW / 2;
  const y0 = cy - totalH / 2;
  const bx = x0;
  const by = y0 + WIREFRAME_HEADING_H;
  const ui = uiAt(bx, by);
  const text = textAt(bx, by);
  const muted = { textColor: WIREFRAME_MUTED };
  const bold = { textBold: true };
  const thin = { strokeWidth: 'thin' as const };

  const elements: Element[] = [
    ...wireframeHeading(
      x0,
      y0,
      totalW,
      'Pocketbook · landing page wireframe',
      'A real page to react to: numbered pins on the page match the notes on the right. Swap in your own copy.',
    ),
    {
      ...createShape('browser', bx, by),
      width: browserW,
      height: browserH,
      layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
    },
  ];

  // The address, written over the chrome's URL pill (which starts 140px in).
  elements.push(text(154, 14, 300, 20, 'pocketbook.app', muted));

  // Nav: brand, three links, a quiet log-in and the one CTA.
  elements.push(ui('icon', 64, 78, 30, 30, { iconId: 'book' }));
  elements.push(text(102, 76, 180, 34, 'Pocketbook', { textSize: 'md', ...bold }));
  ['Features', 'Pricing', 'Customers'].forEach((label, i) => {
    elements.push(text(470 + i * 104, 80, 96, 26, label, { textAlignX: 'center' }));
  });
  elements.push(text(880, 80, 96, 26, 'Log in', { textAlignX: 'center' }));
  elements.push(
    ui('stadium', 1000, 72, 152, 42, {
      label: 'Start free trial',
      textSize: 'sm',
      colorPreset: 'bold',
    }),
  );

  // Hero copy column.
  elements.push(
    ui('stadium', 64, 156, 272, 32, {
      label: 'New · Receipts that sort themselves',
      textSize: 'sm',
      colorPreset: 'soft',
    }),
  );
  elements.push(
    text(64, 200, 460, 100, 'Bookkeeping that does itself while you work', {
      textSize: 'lg',
      ...bold,
    }),
  );
  elements.push(
    text(
      64,
      316,
      480,
      48,
      'Snap receipts, send invoices that chase themselves, and always know what to set aside for tax.',
      muted,
    ),
  );
  elements.push(
    ui('stadium', 64, 384, 184, 50, {
      label: 'Start free trial',
      textSize: 'sm',
      textBold: true,
      colorPreset: 'bold',
    }),
  );
  elements.push(
    ui('stadium', 264, 384, 164, 50, {
      label: 'Book a demo',
      textSize: 'sm',
      colorPreset: 'outline',
    }),
  );
  elements.push(text(64, 448, 480, 22, 'No card needed · 14-day trial · Cancel anytime', muted));

  // Product shot: a card with the app's own chart and the tax pot.
  elements.push(ui('square', 648, 150, 504, 330, { borderRadius: 'md', ...thin }));
  elements.push(text(672, 166, 300, 28, 'Income by month (£k)', { textSize: 'md', ...bold }));
  elements.push(
    ui('bar-chart', 672, 202, 456, 200, {
      pieSlices: [
        { label: 'Jun', value: 3.1 },
        { label: 'Jul', value: 4.2 },
        { label: 'Aug', value: 3.8 },
        { label: 'Sep', value: 5.0 },
        { label: 'Oct', value: 5.6 },
      ],
      chartLegend: false,
    }),
  );
  elements.push(
    ui('stadium', 672, 420, 260, 38, {
      label: 'Set aside for tax · £1,240',
      textSize: 'sm',
      colorPreset: 'soft',
    }),
  );

  // Social proof strip.
  elements.push(
    text(64, 506, 1088, 22, 'Trusted by 4,000+ freelancers and small studios', {
      ...muted,
      textAlignX: 'center',
    }),
  );
  ['Northwind', 'Lumen Studio', 'Fable & Co', 'Brightpath', 'Oakley Design'].forEach((label, i) => {
    elements.push(ui('stadium', 64 + i * 234.5, 538, 150, 36, { label, textSize: 'sm', ...thin }));
  });

  // Three benefit cards.
  const benefits: [string, string, string][] = [
    ['camera', 'Snap a receipt', 'Photograph it and it is matched to the right expense.'],
    ['send', 'Invoices that chase', 'Polite reminders go out on day 7, 14 and 30.'],
    ['pie-chart', 'Tax, already set aside', 'See what you owe for Self Assessment, every day.'],
  ];
  benefits.forEach(([iconId, title, copy], i) => {
    const x = 64 + i * 368;
    elements.push(ui('square', x, 604, 352, 160, { borderRadius: 'md', ...thin }));
    elements.push(ui('icon', x + 24, 624, 36, 36, { iconId }));
    elements.push(text(x + 24, 670, 304, 28, title, { textSize: 'md', ...bold }));
    elements.push(text(x + 24, 702, 304, 44, copy, muted));
  });

  // Footer.
  elements.push(ui('square', 64, 788, 1088, 48, { borderRadius: 'md', ...thin }));
  elements.push(text(88, 800, 300, 24, '© 2027 Pocketbook Ltd', muted));
  elements.push(
    text(760, 800, 368, 24, 'Privacy · Terms · Help centre', { ...muted, textAlignX: 'right' }),
  );

  // Pins, numbered in reading order, on the decisions the notes explain.
  const pins: [number, number][] = [
    [520, 228],
    [248, 384],
    [1152, 150],
    [214, 538],
    [1152, 604],
  ];
  pins.forEach(([rx, ry], i) => elements.push(annotationPin(i + 1, bx + rx, by + ry)));

  const railH = annotationRailHeight(noteH, BROWSER_NOTES.length);
  elements.push(
    ...annotationRail(
      bx + browserW + railGap,
      by + (browserH - railH) / 2,
      railW,
      noteH,
      BROWSER_NOTES,
    ),
  );

  return elements;
}
