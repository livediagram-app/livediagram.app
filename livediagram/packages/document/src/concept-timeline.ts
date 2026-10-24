// The Timeline (docs/specs/009-elements/concept-graphics.md "Timeline"): milestones along one spine, read left to
// right toward its arrowhead. Each milestone is a dot on the spine with a stem out to its words, its when (the row's
// note) nearest the dot and its name beyond, the milestones taking turns above and below the spine so each name has
// two slots of room. PURE, so the canvas face and the headless renderer place every milestone from the same numbers.
//
// A LEAF module: types only.

import { clamp } from '@liveworkspace/model-core/geometry-primitives';
import type { LayoutRect } from './web-components';

export type TimelineMilestone = {
  dot: { x: number; y: number };
  // Out from the dot to the words: above the spine the stem runs up, below it runs down.
  stem: { y1: number; y2: number };
  above: boolean;
  // The when (the row's note), nearest the stem, and the name beyond it.
  note: LayoutRect;
  label: LayoutRect;
};

export type TimelineLayout = {
  spine: { x1: number; x2: number; y: number };
  // The arrowhead at the spine's right end: time runs that way.
  head: { tip: { x: number; y: number }; size: number };
  dotR: number;
  milestones: TimelineMilestone[];
  labelPx: number;
  notePx: number;
};

export function timelineLayout(w: number, h: number, n: number): TimelineLayout {
  const count = Math.max(1, n);
  const y = h / 2;
  const head = clamp(h * 0.06, 6, 12);
  // The milestones sit in even slots along the spine, short of the arrowhead.
  const span = Math.max(1, w - head * 1.5);
  const slot = span / count;
  const dotR = clamp(Math.min(h * 0.055, slot * 0.14), 5, 12);
  const labelPx = Math.round(clamp(h * 0.075, 11, 17));
  const notePx = Math.round(clamp(labelPx * 0.8, 10, 14));
  const gap = 4;
  // Words on one side are two slots apart, so each takes up to two slots' width, centred on its dot; near an end it
  // narrows to stay centred inside the element (never under one slot).
  const wordsW = Math.min(w, slot * 1.9);
  const noteH = notePx * 1.5;
  const milestones = Array.from({ length: count }, (_, i) => {
    const x = slot * (i + 0.5);
    const above = i % 2 === 0;
    const room = Math.max(0, y - dotR - gap);
    const stemLen = Math.max(6, Math.min(room * 0.3, 28));
    const width = Math.min(wordsW, Math.max(slot * 0.95, Math.min(x, w - x) * 2));
    const left = clamp(x - width / 2, 0, Math.max(0, w - width));
    // The name sits right against its when, one line tall (it shrinks to fit, then ellipses, as every concept row),
    // within what is left of its half once the stem and the when are placed.
    const labelH = Math.max(0, Math.min(room - stemLen - noteH - gap, labelPx * 1.6));
    if (above) {
      const y2 = y - dotR;
      const y1 = y2 - stemLen;
      const noteY = y1 - gap - noteH;
      return {
        dot: { x, y },
        stem: { y1, y2 },
        above,
        note: { x: left, y: noteY, width, height: noteH },
        label: { x: left, y: Math.max(0, noteY - labelH), width, height: labelH },
      };
    }
    const y1 = y + dotR;
    const y2 = y1 + stemLen;
    const noteY = y2 + gap;
    return {
      dot: { x, y },
      stem: { y1, y2 },
      above,
      note: { x: left, y: noteY, width, height: noteH },
      label: { x: left, y: noteY + noteH, width, height: labelH },
    };
  });
  return {
    spine: { x1: 0, x2: w - head * 0.2, y },
    head: { tip: { x: w, y }, size: head },
    dotR,
    milestones,
    labelPx,
    notePx,
  };
}
