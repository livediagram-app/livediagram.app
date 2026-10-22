// Shared parts of the lane-based process templates (swimlane flowchart and
// approval workflow, docs/specs/008-canvas/canvas-and-palette.md "Templates"): the
// per-lane hue and the muted key that names each step shape. Pure.

import { createShape, createText, type Element, type ShapeKind } from '@livediagram/document';

const MUTED = '#64748b';
const SAMPLE_STROKE = '#94a3b8';

// One role's colours: the lane body (band), its gutter (header), the lane
// outline (line), the outline of every step on it (node), the fill of its
// gates and soft steps (tint) and its title ink.
export type LaneHue = {
  band: string;
  header: string;
  line: string;
  node: string;
  tint: string;
  ink: string;
};

type Sample = { kind: ShapeKind; label: string; filled?: boolean; dashed?: boolean };
const SAMPLES: Sample[] = [
  { kind: 'stadium', label: 'Start or finish', filled: true },
  { kind: 'square', label: 'A step' },
  { kind: 'diamond', label: 'A decision' },
  { kind: 'square', label: 'The exception path', dashed: true },
];

// A one-row key under the lanes: "Key", then a small sample of each step
// shape beside its meaning. Samples are neutral grey so the key reads as
// "shape means this" in any lane's hue.
export function swimlaneKey(left: number, y: number, h: number): Element[] {
  const els: Element[] = [
    {
      ...createText(left, y),
      width: 48,
      height: h,
      label: 'Key',
      textSize: 'sm',
      textBold: true,
      textColor: MUTED,
      textAlignX: 'left',
    },
  ];
  const cell = 230;
  SAMPLES.forEach((s, i) => {
    const x = left + 64 + i * cell;
    const sw = s.kind === 'diamond' ? 44 : 40;
    const sh = s.kind === 'diamond' ? 26 : 20;
    els.push(
      {
        ...createShape(s.kind, x, y + (h - sh) / 2),
        width: sw,
        height: sh,
        label: '',
        fillColor: s.filled ? SAMPLE_STROKE : 'transparent',
        strokeColor: SAMPLE_STROKE,
        ...(s.dashed ? { strokeStyle: 'dashed' as const } : {}),
      },
      {
        ...createText(x + sw + 12, y),
        width: cell - sw - 24,
        height: h,
        label: s.label,
        textSize: 'sm',
        textColor: MUTED,
        textAlignX: 'left',
      },
    );
  });
  return els;
}
