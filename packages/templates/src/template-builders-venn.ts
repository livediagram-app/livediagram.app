// The Venn template builder, split out of template-builders-diagrams.ts (which
// re-exports it) once the fully labelled redesign outgrew a shared file.
// Pure: (cx, cy) -> Element[]. See docs/specs/008-canvas/canvas-and-palette.md "Templates".

import { createShape, createText, type Element } from '@livediagram/document';

// Muted slate for the one-line explainers under each region label.
const MUTED = '#64748b';

// The design-thinking Venn: three tinted, translucent circles (Desirable /
// Feasible / Viable) whose overlaps visibly blend, so every region of the
// diagram is labelled. Each set carries a bold heading and a one-line
// meaning inside its own exclusive region; each pairwise overlap names what
// an idea missing the third lens becomes (the classic "Unsustainable /
// Useless / Unbuildable" reading); the three-way centre is the hero "Sweet
// spot" pill. A question title above frames it as a tool for testing an idea.
export function buildVenn(cx: number, cy: number): Element[] {
  const r = 330;
  // Each circle centre sits `d` from the centroid (cx, cy), in a triangle:
  // top, bottom-left, bottom-right. 0.6r keeps the pair lenses roomy enough
  // to hold a label while the three-way centre stays a clear lens.
  const d = r * 0.6;
  const sin60 = Math.sqrt(3) / 2;
  type Lens = {
    label: string;
    meaning: string;
    fill: string;
    ink: string;
    // Unit vector from the centroid towards this circle's centre.
    ux: number;
    uy: number;
  };
  const lenses: Lens[] = [
    {
      label: 'Desirable',
      meaning: 'People want it',
      fill: '#fda4af',
      ink: '#be123c',
      ux: 0,
      uy: -1,
    },
    {
      label: 'Feasible',
      meaning: 'We can build it',
      fill: '#93c5fd',
      ink: '#1d4ed8',
      ux: -sin60,
      uy: 0.5,
    },
    {
      label: 'Viable',
      meaning: 'It pays its way',
      fill: '#6ee7b7',
      ink: '#047857',
      ux: sin60,
      uy: 0.5,
    },
  ];
  // Pairwise overlaps, keyed by the two lenses they share. The label sits on
  // the bisector pointing away from the missing lens, halfway between where
  // the third circle ends (r - d from the centroid) and the lens tip.
  const pairs: { a: number; b: number; label: string; meaning: string }[] = [
    { a: 0, b: 1, label: 'Unsustainable', meaning: 'Loved and buildable, but no business' },
    { a: 1, b: 2, label: 'Useless', meaning: 'Buildable and profitable, but unwanted' },
    { a: 0, b: 2, label: 'Unbuildable', meaning: 'Loved and profitable, but out of reach' },
  ];

  const elements: Element[] = [];
  // Circles first so every label paints above the blended fills. Element
  // opacity (not a translucent fill) is what lets the overlaps mix, so the
  // stroke uses the deep ink to stay crisp at that opacity.
  for (const l of lenses) {
    elements.push({
      ...createShape('circle', cx + l.ux * d - r, cy + l.uy * d - r),
      width: r * 2,
      height: r * 2,
      label: '',
      fillColor: l.fill,
      strokeColor: l.ink,
      opacity: 0.45,
      // The hues ARE the legend (each region is named by the lenses it
      // mixes), so they survive a theme switch.
      themeLockFill: true,
    });
  }

  const titleW = 760;
  elements.push({
    ...createText(cx - titleW / 2, cy - d - r - 96),
    width: titleW,
    height: 56,
    label: 'Is this idea worth building?',
    textSize: 'lg',
    textAlignX: 'center',
  });

  // Set headings: pushed out along the lens direction into the region only
  // that circle covers.
  const headW = 280;
  for (const l of lenses) {
    const hx = cx + l.ux * (d + r * 0.42);
    const hy = cy + l.uy * (d + r * 0.42);
    elements.push({
      ...createText(hx - headW / 2, hy - 40),
      width: headW,
      height: 44,
      label: l.label,
      textSize: 'lg',
      textBold: true,
      textAlignX: 'center',
      textColor: l.ink,
    });
    elements.push({
      ...createText(hx - headW / 2, hy + 6),
      width: headW,
      height: 30,
      label: l.meaning,
      textSize: 'sm',
      textAlignX: 'center',
      textColor: MUTED,
    });
  }

  const lensTip = d / 2 + Math.sqrt(r * r - (3 * d * d) / 4);
  const pairDist = (r - d + lensTip) / 2;
  const pairW = 190;
  for (const p of pairs) {
    const a = lenses[p.a]!;
    const b = lenses[p.b]!;
    const len = Math.hypot(a.ux + b.ux, a.uy + b.uy);
    const px = cx + ((a.ux + b.ux) / len) * pairDist;
    const py = cy + ((a.uy + b.uy) / len) * pairDist;
    elements.push({
      ...createText(px - pairW / 2, py - 30),
      width: pairW,
      height: 28,
      label: p.label,
      textSize: 'sm',
      textBold: true,
      textAlignX: 'center',
    });
    elements.push({
      ...createText(px - pairW / 2, py),
      width: pairW,
      height: 40,
      label: p.meaning,
      textSize: 'sm',
      textAlignX: 'center',
      textColor: MUTED,
    });
  }

  // The three-way overlap is the answer the whole diagram points at.
  const spotW = 170;
  const spotH = 54;
  elements.push({
    ...createShape('stadium', cx - spotW / 2, cy - spotH / 2),
    width: spotW,
    height: spotH,
    label: 'Sweet spot',
    textSize: 'md',
    textBold: true,
    colorPreset: 'bold',
  });
  return elements;
}
