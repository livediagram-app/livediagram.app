// The edge cases of docs/specs/024-agents/blueprints/document-views.md "Errors and edge cases" (E2 to
// E28) composed in one tab, with every kind that has a state attribute. Unknown kinds make it a tab
// `isValidTab` refuses, which is the point: views never drop what they do not know.
import {
  createSticky,
  createTable,
  type Element,
  type ShapeKind,
  type Tab,
} from '@livediagram/document';
import { arrowBetween, shapeAt, strokeAt } from './build';

const STATE_KINDS: [ShapeKind, Record<string, unknown>][] = [
  ['estimate', { responses: [{ participantId: 'p', value: '5', at: 0 }], responsesRevealed: true }],
  ['temperature', { responses: [] }],
  ['done-check', { responses: [{ participantId: 'p', value: 'done', at: 0 }] }],
  ['idea-box', { ideaCards: ['a', 'b'] }],
  ['qa-board', { qaNotes: [] }],
  [
    'agenda',
    {
      agendaItems: [
        { label: 'Intro', minutes: 5 },
        { label: 'Demo', minutes: 10 },
      ],
      agendaCurrent: 1,
    },
  ],
  ['decision', { decisionStatus: 'accepted' }],
  ['roll-call', { rollCall: [] }],
  ['quiz', { quizStartedAt: 1 }],
  ['picker', { pickerResult: 'Sam' }],
  ['reveal', { revealed: true }],
  ['stat-row', {}],
  ['process', {}],
  ['site-header', {}],
  ['legend', {}],
  ['rating', { rating: 4 }],
  ['progress-bar', { progress: 40 }],
  ['progress-ring', {}],
  ['timeline-rail', {}],
  ['page', { pageTitle: 'Quarterly review' }],
];

// Grid cells below the frames, 8 to a row.
const cell = (i: number): [number, number] => [(i % 8) * 250, 600 + Math.floor(i / 8) * 200];

export function edgeCasesTab(): Tab {
  const grid: Element[] = [
    shapeAt('square', 'bare', ...cell(0)),
    shapeAt('square', 'quoted', ...cell(1), 100, 50, {
      label: 'Line one\nsays "hi" → there | here',
    }),
    { ...shapeAt('square', 'tilted', ...cell(2)), rotation: 30 },
    { ...shapeAt('square', 'secret', ...cell(3)), layerId: 'hidden' },
    {
      id: 'holo',
      type: 'hologram',
      x: cell(4)[0],
      y: cell(4)[1],
      width: 80,
      height: 80,
      label: 'Unknown type',
    } as unknown as Element,
    { ...shapeAt('square', 'blob', ...cell(5)), shape: 'blob' } as unknown as Element,
    shapeAt('square', 'My node', ...cell(6), 100, 50, { label: 'Unsafe id' }),
    shapeAt('square', 'Q1', ...cell(7), 100, 50, { label: 'Short id' }),
    shapeAt('square', 'abcd', ...cell(8), 100, 50, { label: 'Slug prefix' }),
    shapeAt('square', 'abcd9999-X', ...cell(9), 100, 50, { label: 'Longer id' }),
    {
      ...createTable(...cell(10)),
      id: 'ragged',
      cells: [
        ['Name', 'Owner'],
        ['Orders', 'Sam', 'extra'],
      ],
    },
    {
      ...createSticky(...cell(11)),
      id: 'es-actor',
      label: 'Customer',
      esKind: 'actor',
      fixedSize: true,
    },
    strokeAt('lone', ...cell(12)),
    shapeAt('square', 'splitter', ...cell(13)),
    strokeAt('run-1', ...cell(14)),
    strokeAt('run-2', ...cell(15)),
    strokeAt('run-3', cell(15)[0] + 30, cell(15)[1], true),
    shapeAt('mind-node', 'mind-a', ...cell(16), 100, 50, { label: 'A', mindParentId: 'mind-c' }),
    shapeAt('mind-node', 'mind-b', ...cell(17), 100, 50, { label: 'B', mindParentId: 'mind-a' }),
    shapeAt('mind-node', 'mind-c', ...cell(18), 100, 50, { label: 'C', mindParentId: 'mind-b' }),
    shapeAt('mind-node', 'mind-d', ...cell(19), 100, 50, { label: 'D', mindParentId: 'gone' }),
    ...STATE_KINDS.map(([kind, state], i) =>
      shapeAt(kind, `state-${kind}`, ...cell(24 + i), 100, 50, state),
    ),
  ];
  return {
    id: 'edge-tab',
    name: 'Edge cases',
    layers: [
      { id: 'default', name: 'Default' },
      { id: 'hidden', name: 'Hidden', visible: false },
    ],
    elements: [
      // Two frames of equal area overlapping: the earlier holds what sits in both (E4).
      shapeAt('frame', 'frame-a', 0, 0, 600, 400, { label: 'A' }),
      shapeAt('frame', 'frame-b', 300, 0, 600, 400, { label: 'B' }),
      shapeAt('square', 'both', 400, 175, 100, 50, { label: 'In both' }),
      // Larger than the frame its centre is in (E5).
      shapeAt('square', 'huge', -10, -10, 620, 420, { label: 'Huge' }),
      ...grid,
      { id: 'nowhere', type: 'hologram', label: 'No geometry' } as unknown as Element,
      // Parallel arrows, a self-loop, an arrow to a hidden element, free and on-arrow ends (E7 to E10).
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
