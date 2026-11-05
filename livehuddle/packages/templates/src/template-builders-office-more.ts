// The Focus Library (docs/specs/012-collaboration/virtual-office-template.md "Spaces"): an Office Space for quiet work,
// one room of bookshelves and study desks, two Office Pods for a call for two and a reading corner. Built from the
// office pieces with spacePlan (template-office-parts.ts).
//
// Pure: takes a centre (cx, cy) and returns a fresh Element[], floors first.

import type { Element } from '@livehuddle/document';
import {
  SPACE_BELOW,
  SPACE_HEAD,
  spacePlan,
  walkIn,
  type OfficeRoom,
} from './template-office-parts';

const LIBRARY_W = 1100;
const LIBRARY_H = 660;

export function buildFocusLibrary(cx: number, cy: number): Element[] {
  const width = LIBRARY_W;
  const height = SPACE_HEAD + LIBRARY_H + SPACE_BELOW;
  const x0 = cx - width / 2;
  const y0 = cy - height / 2;
  const rooms: OfficeRoom[] = [
    {
      name: 'Library',
      x: 0,
      y: 0,
      w: LIBRARY_W,
      h: LIBRARY_H,
      door: 's',
      pieces: [
        // The shelves along the back wall, the study desks in front of them as one row, an aisle round it
        // (docs/specs/007-editor/templates-by-mode.md "Every Space is roomy").
        ...[40, 180, 320, 460].map((x) => ({ kind: 'bookshelf' as const, x, y: 40 })),
        ...[40, 170, 300, 430].map((x) => ({
          kind: 'desk' as const,
          x,
          y: 230,
          facing: 's' as const,
        })),
        // Two Office Pods at the back right, their doors onto the floor, for a call without leaving the quiet.
        { kind: 'office-pod', x: 680, y: 40 },
        { kind: 'office-pod', x: 870, y: 40 },
        { kind: 'desk', x: 700, y: 304, facing: 's' },
        { kind: 'desk', x: 830, y: 304, facing: 's' },
        { kind: 'water-cooler', x: 1010, y: 300 },
        // The reading corner: a sofa on its rug and a chair facing it, away from the doorway.
        { kind: 'rug', x: 60, y: 462 },
        { kind: 'sofa', x: 84, y: 482, facing: 'n' },
        { kind: 'chair', x: 356, y: 482, facing: 'e' },
        { kind: 'plant', x: 444, y: 512 },
        { kind: 'plant', x: 1010, y: 512 },
      ],
    },
  ];
  return spacePlan(
    x0,
    y0,
    width,
    rooms,
    {
      text: 'Focus Library',
      width: 300,
      sticker: 'emoji-books',
      subtitle:
        'Somewhere quiet to get things done: take a desk, step into a pod for a call, or read on the sofa.',
    },
    walkIn(
      x0 + width,
      y0 + SPACE_HEAD + LIBRARY_H + SPACE_BELOW / 2,
      'Press Walk In (or W) to come in. Sit at a desk to work, or step into an Office Pod to talk without disturbing anyone.',
    ),
  );
}
