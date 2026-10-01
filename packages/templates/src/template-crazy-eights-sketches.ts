// The three worked sketches on the Crazy 8s sheet (template-builders-crazy-eights.ts):
// quick, low-fidelity answers to "How might we make reordering a favourite
// meal take two taps?", drawn the way a designer scribbles in a minute. Each
// is built from plain shapes in panel-local coordinates, in pen ink on the
// sheet's paper (both theme-locked, so the sheet reads as paper on a dark
// canvas too). Only the one call to action per screen and the numbered tap
// markers carry colour, because they ARE the idea: the markers ("1", "2")
// count the taps, which is the prompt's whole test.
//
// Every element is content: sketches are the Sketches layer. Pure.

import type { Element, ShapeElement, ShapeKind, TextElement } from '@livediagram/document';
import { textAt, uiAt } from './template-wireframe-kit';

// The sheet's paper and the pen it is drawn with.
export const PAPER = '#fffdf8';
export const INK = '#1e293b';
export const FAINT = '#94a3b8';
export const HAND = 'caveat';
// Plateful orange for the big button, rose for the tap markers.
const CTA = '#f97316';
const TAP = '#e11d48';

// The handwriting caption under each sketch, and how to draw it.
export type Sketch = { caption: string; draw: (ox: number, oy: number) => Element[] };

// Pen-on-paper factories for one sketch, positioned from its top-left.
function pen(ox: number, oy: number) {
  const ui = uiAt(ox, oy);
  const text = textAt(ox, oy);
  const shape = (
    kind: ShapeKind,
    x: number,
    y: number,
    w: number,
    h: number,
    extra: Partial<ShapeElement> = {},
  ) =>
    ui(kind, x, y, w, h, {
      fillColor: PAPER,
      strokeColor: INK,
      textColor: INK,
      themeLockFill: true,
      ...extra,
    });
  const write = (
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    extra: Partial<TextElement> = {},
  ) => text(x, y, w, h, label, { font: HAND, textSize: 'md', textColor: INK, ...extra });
  // A scribbled line of copy: a thin grey bar.
  const scribble = (x: number, y: number, w: number) =>
    shape('stadium', x, y, w, 6, { fillColor: '#cbd5e1', strokeColor: '#cbd5e1' });
  // The big orange button: the idea's one call to action.
  const cta = (x: number, y: number, w: number, h: number, label: string, kind: ShapeKind) =>
    shape(kind, x, y, w, h, {
      label,
      textSize: 'sm',
      textBold: true,
      fillColor: CTA,
      strokeColor: CTA,
      textColor: '#ffffff',
    });
  // A numbered tap marker centred on (x, y).
  const tap = (n: number, x: number, y: number) =>
    shape('circle', x - 13, y - 13, 26, 26, {
      label: `${n}`,
      textSize: 'sm',
      textBold: true,
      fillColor: TAP,
      strokeColor: '#ffffff',
      strokeWidth: 'thick',
      textColor: '#ffffff',
    });
  // A phone outline: rounded body, a speaker slot and a home bar.
  const phone = (x: number, y: number, w: number, h: number) => [
    shape('square', x, y, w, h, { borderRadius: 'lg', strokeWidth: 'thick' }),
    shape('stadium', x + w / 2 - 16, y + 9, 32, 6, { fillColor: INK }),
    shape('stadium', x + w / 2 - 22, y + h - 13, 44, 5, { fillColor: INK }),
  ];
  return { shape, write, scribble, cta, tap, phone };
}

// Every sketch fits a 250 x 236 drawing area.
const PX = 55;
const PW = 140;
const PH = 228;

export const SKETCHES: Sketch[] = [
  {
    // 1. The usual, right on the home screen: one tap to reorder, one to pay.
    caption: 'Your usual, on home',
    draw: (ox, oy) => {
      const p = pen(ox, oy);
      return [
        ...p.phone(PX, 4, PW, PH),
        p.write(PX + 14, 26, PW - 28, 28, 'Hi Maya!'),
        p.shape('square', PX + 12, 60, PW - 24, 98, { borderRadius: 'md' }),
        p.write(PX + 22, 64, PW - 44, 28, 'Pad thai'),
        p.scribble(PX + 22, 96, 64),
        p.cta(PX + 22, 114, PW - 44, 30, 'Reorder', 'stadium'),
        p.shape('square', PX + 12, 172, PW - 24, 30, {
          label: 'Pay £14.20',
          textSize: 'sm',
          textBold: true,
          borderRadius: 'md',
        }),
        p.tap(1, PX + PW - 12, 129),
        p.tap(2, PX + PW - 2, 187),
      ];
    },
  },
  {
    // 2. A Friday nudge on the lock screen that reorders from the banner,
    // confirmed with a glance.
    caption: 'Friday nudge at 5pm',
    draw: (ox, oy) => {
      const p = pen(ox, oy);
      return [
        ...p.phone(PX, 4, PW, PH),
        p.write(PX, 24, PW, 40, '17:00', { textSize: 'lg', textAlignX: 'center' }),
        p.shape('square', PX + 10, 74, PW - 20, 98, { borderRadius: 'md' }),
        p.write(PX + 20, 78, PW - 40, 24, 'Plateful', { textSize: 'sm', textBold: true }),
        p.write(PX + 20, 100, PW - 40, 28, 'Tacos again?'),
        p.cta(PX + 20, 134, PW - 40, 28, 'Reorder', 'stadium'),
        p.shape('icon', PX + PW / 2 - 18, 184, 36, 36, {
          iconId: 'smile',
          strokeColor: INK,
          fillColor: undefined,
        }),
        p.tap(1, PX + PW - 14, 148),
        p.tap(2, PX + PW / 2 + 28, 190),
      ];
    },
  },
  {
    // 3. On the wrist: the watch offers the usual; press Go, then the side
    // button to pay.
    caption: 'Tap it on your watch',
    draw: (ox, oy) => {
      const p = pen(ox, oy);
      const fx = PX;
      const fy = 50;
      const w = PW;
      const h = 144;
      return [
        p.shape('square', fx + 32, fy - 40, w - 64, 44, { borderRadius: 'sm' }),
        p.shape('square', fx + 32, fy + h - 4, w - 64, 40, { borderRadius: 'sm' }),
        p.shape('square', fx, fy, w, h, { borderRadius: 'lg', strokeWidth: 'thick' }),
        p.shape('square', fx + w - 2, fy + 44, 10, 28, { borderRadius: 'sm' }),
        p.write(fx + 10, fy + 12, w - 20, 28, 'The usual?', { textAlignX: 'center' }),
        p.cta(fx + w / 2 - 30, fy + 46, 60, 60, 'Go', 'circle'),
        p.scribble(fx + 40, fy + 120, 60),
        p.tap(1, fx + w / 2 + 28, fy + 100),
        p.tap(2, fx + w + 26, fy + 58),
      ];
    },
  },
];

// The empty panels' hints: faint handwriting that nudges the harder, stranger
// ideas the exercise exists to shake loose. Delete them as you sketch.
export const PANEL_HINTS = [
  'No screen at all?',
  'Steal from another app',
  'What if it took zero taps?',
  'The silly one',
  'Your wildcard',
];

// The hint in an empty panel: a pencil over a faint handwritten nudge,
// centred in a w x h drawing area.
export function panelHint(ox: number, oy: number, w: number, h: number, hint: string): Element[] {
  const p = pen(ox, oy);
  const icon = 36;
  return [
    p.shape('icon', (w - icon) / 2, h / 2 - icon - 4, icon, icon, {
      iconId: 'edit',
      strokeColor: FAINT,
      fillColor: undefined,
      themeLockFill: undefined,
    }),
    p.write(16, h / 2 + 6, w - 32, 32, hint, { textColor: FAINT, textAlignX: 'center' }),
  ];
}
