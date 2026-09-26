// The ten arrow shapes the label bench renders
// (docs/specs/008-canvas/arrow-labels.md "Open decisions"). The first is the
// diagram that prompted the spec; the rest isolate one arrow shape each.

import type { Anchor, ArrowElement, Element, ShapeElement } from '../../src/index';

export type Scenario = { id: string; title: string; note: string; elements: Element[] };

const box = (id: string, label: string, x: number, y: number, w = 212, h = 117): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'square',
  x,
  y,
  width: w,
  height: h,
  label,
  fillColor: '#eff6ff',
  strokeColor: '#38bdf8',
  textColor: '#0c4a6e',
});

const pin = (elementId: string, anchor: Anchor) => ({ kind: 'pinned' as const, elementId, anchor });

let seq = 0;
const link = (
  from: [string, Anchor],
  to: [string, Anchor],
  label: string,
  over: Partial<ArrowElement> = {},
): ArrowElement => ({
  id: `ar${++seq}`,
  type: 'arrow',
  from: pin(...from),
  to: pin(...to),
  label,
  ...over,
});

const dashed = { strokeStyle: 'dashed' as const };

export const SCENARIOS: Scenario[] = [
  {
    id: 'screenshot',
    title: '1. The diagram that started it',
    note: 'Fan-out, a swooping curve, a near-vertical line, two crossings.',
    elements: [
      box('webber', 'Webber', 600, 90, 120, 60),
      box('x', 'x', 173, 342),
      box('spinner', 'Spinner', 554, 342),
      box('minis', 'Minis Studio', 951, 342),
      box('runa', 'Runa (Backend)', 357, 637),
      box('worker', 'Studio Worker', 768, 637),
      link(['webber', 's'], ['x', 'n'], 'UI'),
      link(['webber', 's'], ['spinner', 'n'], 'UI'),
      link(['webber', 's'], ['minis', 'n'], 'UI'),
      link(['x', 'e'], ['runa', 'w'], 'Use personal assistant', {
        ...dashed,
        arrowStyle: 'curved',
        curveOffset: { dx: -200, dy: 0 },
      }),
      link(['runa', 'e'], ['spinner', 'w'], 'Do coding work', dashed),
      link(['spinner', 's'], ['worker', 'e'], 'Context summarisation', dashed),
      link(['minis', 's'], ['worker', 'w'], '', {
        ...dashed,
        arrowStyle: 'curved',
        curveOffset: { dx: 40, dy: 60 },
      }),
      link(['runa', 's'], ['worker', 'n'], 'Speech to text', dashed),
    ],
  },
  {
    id: 'short',
    title: '2. Short horizontal, long label',
    note: 'Too little line to hold the words: wraps, then moves beside.',
    elements: [
      box('a', 'Gateway', 0, 0, 160, 80),
      box('b', 'Auth', 250, 0, 160, 80),
      link(['a', 'e'], ['b', 'w'], 'Validates the signed request payload'),
    ],
  },
  {
    id: 'long-h',
    title: '3. Long horizontal, short label',
    note: 'The easy case: one line, centred, the line broken around it.',
    elements: [
      box('a', 'Client', 0, 0, 160, 80),
      box('b', 'API', 620, 0, 160, 80),
      link(['a', 'e'], ['b', 'w'], 'calls'),
    ],
  },
  {
    id: 'vertical',
    title: '4. Vertical, long label',
    note: 'Text crosses the line, so the width cap decides the wrap.',
    elements: [
      box('a', 'Orders', 0, 0, 180, 80),
      box('b', 'Message bus', 0, 300, 180, 80),
      link(['a', 's'], ['b', 'n'], 'Publishes domain events to the message bus'),
    ],
  },
  {
    id: 'angled-l',
    title: '5. Angled L, long first leg',
    note: 'Horizontal leg much longer than the vertical one.',
    elements: [
      box('a', 'Draft', 0, 0, 160, 80),
      box('b', 'Published', 460, 220, 160, 80),
      link(['a', 'e'], ['b', 'n'], 'on approval', { arrowStyle: 'angled' }),
    ],
  },
  {
    id: 'angled-l2',
    title: '6. Angled L, short first leg',
    note: 'Short horizontal leg, long vertical one: where does the label go?',
    elements: [
      box('a', 'Invoice', 0, 0, 160, 80),
      box('b', 'Archive', 180, 360, 160, 80),
      link(['a', 'e'], ['b', 'n'], 'after 30 days', { arrowStyle: 'angled' }),
    ],
  },
  {
    id: 'angled-z',
    title: '7. Angled Z, three segments',
    note: '300 across, 100 down, 240 across: the path middle falls on the short drop.',
    elements: [
      box('a', 'Worker', 0, 0, 160, 80),
      box('b', 'Queue', 700, 100, 160, 80),
      link(['a', 'e'], ['b', 'w'], 'retry with backoff', {
        arrowStyle: 'angled',
        curvePoints: [
          { dx: 30, dy: -50 },
          { dx: 30, dy: 50 },
        ],
      }),
    ],
  },
  {
    id: 'pair',
    title: '8. Two arrows between the same boxes',
    note: 'Request and response run side by side; labels must not collide.',
    elements: [
      box('a', 'Browser', 0, 0, 160, 100),
      box('b', 'Server', 480, 0, 160, 100),
      link(['a', 'e'], ['b', 'w'], 'request'),
      link(['b', 'w'], ['a', 'e'], 'response'),
    ],
  },
  {
    id: 'curved',
    title: '9. Curved bow, long label',
    note: 'The label follows the curve, not its chord.',
    elements: [
      box('a', 'Sensor', 0, 200, 160, 80),
      box('b', 'Dashboard', 560, 200, 160, 80),
      link(['a', 'n'], ['b', 'n'], 'Streams readings every second', {
        arrowStyle: 'curved',
        curveOffset: { dx: 0, dy: -300 },
      }),
    ],
  },
  {
    id: 'fan-in',
    title: '10. Fan-in to one box',
    note: 'Three labelled arrows converging; labels crowd near the target.',
    elements: [
      box('o', 'Orders', 0, 0, 160, 70),
      box('p', 'Payments', 0, 150, 160, 70),
      box('r', 'Refunds', 0, 300, 160, 70),
      box('l', 'Ledger', 420, 150, 160, 70),
      link(['o', 'e'], ['l', 'w'], 'order placed'),
      link(['p', 'e'], ['l', 'w'], 'payment captured'),
      link(['r', 'e'], ['l', 'w'], 'refund issued'),
    ],
  },
];
