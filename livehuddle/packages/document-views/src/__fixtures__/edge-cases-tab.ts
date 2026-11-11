// The edge cases of docs/specs/024-agents/blueprints/document-views.md "Errors and edge cases" (E2 to
// E28) composed in one tab. Unknown kinds make it a tab `isValidTab` refuses, which is the point: views never drop
// what they do not know.
import { createSticky, type Element, type Tab } from '@livehuddle/document';
import { arrowBetween, retiredShapeAt, shapeAt, storedTableAt, strokeAt } from './build';

// Grid cells below the frames, 8 to a row.
const cell = (i: number): [number, number] => [(i % 8) * 250, 600 + Math.floor(i / 8) * 200];

export function edgeCasesTab(): Tab {
  const grid: Element[] = [
    shapeAt('signpost', 'bare', ...cell(0)),
    shapeAt('signpost', 'quoted', ...cell(1), 100, 50, {
      label: 'Line one\nsays "hi" → there | here',
    }),
    { ...shapeAt('signpost', 'tilted', ...cell(2)), rotation: 30 },
    shapeAt('signpost', 'secret', ...cell(3)),
    {
      id: 'holo',
      type: 'hologram',
      x: cell(4)[0],
      y: cell(4)[1],
      width: 80,
      height: 80,
      label: 'Unknown type',
    } as unknown as Element,
    { ...shapeAt('signpost', 'blob', ...cell(5)), shape: 'blob' } as unknown as Element,
    shapeAt('signpost', 'My node', ...cell(6), 100, 50, { label: 'Unsafe id' }),
    shapeAt('signpost', 'Q1', ...cell(7), 100, 50, { label: 'Short id' }),
    shapeAt('signpost', 'abcd', ...cell(8), 100, 50, { label: 'Slug prefix' }),
    shapeAt('signpost', 'abcd9999-X', ...cell(9), 100, 50, { label: 'Longer id' }),
    storedTableAt(...cell(10), {
      id: 'ragged',
      cells: [
        ['Name', 'Owner'],
        ['Orders', 'Sam', 'extra'],
      ],
    }),
    {
      ...createSticky(...cell(11)),
      id: 'customer',
      label: 'Customer',
    },
    strokeAt('lone', ...cell(12)),
    shapeAt('signpost', 'splitter', ...cell(13)),
    strokeAt('run-1', ...cell(14)),
    strokeAt('run-2', ...cell(15)),
    strokeAt('run-3', cell(15)[0] + 30, cell(15)[1], true),
  ];
  return {
    id: 'edge-tab',
    name: 'Edge cases',
    elements: [
      // Two stored boundaries overlapping (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine",
      // part 3): retired kinds that hold nothing, so what sits on them prints beside them.
      retiredShapeAt('boundary', 'frame-a', 0, 0, 600, 400, { label: 'A' }),
      retiredShapeAt('boundary', 'frame-b', 300, 0, 600, 400, { label: 'B' }),
      shapeAt('signpost', 'both', 400, 175, 100, 50, { label: 'In both' }),
      // Larger than the stored boundary its centre is on.
      shapeAt('signpost', 'huge', -10, -10, 620, 420, { label: 'Huge' }),
      ...grid,
      { id: 'nowhere', type: 'hologram', label: 'No geometry' } as unknown as Element,
      // Parallel arrows, a self-loop, an arrow to a plain element, free and on-arrow ends (E7 to E10).
      arrowBetween('par-1', 'bare', 'quoted', { label: 'one' }),
      arrowBetween('par-2', 'bare', 'quoted', {
        label: 'two',
        strokeStyle: 'dotted',
        arrowEnds: 'both',
      }),
      arrowBetween('loop', 'tilted', 'tilted'),
      arrowBetween('to-secret', 'bare', 'secret'),
      { ...arrowBetween('free-src', 'bare', 'bare'), from: { kind: 'free', x: 0, y: 0 } },
      { ...arrowBetween('free-dst', 'quoted', 'quoted'), to: { kind: 'free', x: 0, y: 0 } },
      {
        ...arrowBetween('rider', 'tilted', 'tilted'),
        to: { kind: 'on-arrow', arrowId: 'par-1', t: 0.5 },
      },
      {
        ...arrowBetween('rider-src', 'tilted', 'tilted'),
        from: { kind: 'on-arrow', arrowId: 'par-2', t: 0.5 },
      },
    ],
  };
}
