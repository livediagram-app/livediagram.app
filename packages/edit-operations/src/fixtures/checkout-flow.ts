// The research's checkout flow (docs/research/agent-cli/editing-models.md §6): one tab, eight steps
// down a column joined by pinned arrows, a note beside the payment, and a frame `f2` holding the
// address and card steps. Every suite starts from a fresh copy.

import type { ArrowElement, Element, ShapeKind, Tab } from '@livediagram/document';

const step = (id: string, shape: ShapeKind, label: string, y: number, height = 60): Element => ({
  id,
  type: 'shape',
  shape,
  label,
  x: 0,
  y,
  width: 140,
  height,
  textSize: 'sm',
});

const arrow = (id: string, from: string, to: string, label?: string): ArrowElement => ({
  id,
  type: 'arrow',
  from: { kind: 'pinned', elementId: from, anchor: 's' },
  to: { kind: 'pinned', elementId: to, anchor: 'n' },
  ...(label ? { label } : {}),
});

export function checkoutFlow(): Tab {
  return {
    id: 'main',
    name: 'Checkout flow',
    elements: [
      {
        id: 'f2',
        type: 'shape',
        shape: 'frame',
        label: 'Payment',
        x: -40,
        y: 280,
        width: 220,
        height: 200,
      },
      step('n1', 'stadium', 'Start', 0),
      step('n2', 'square', 'Cart', 100),
      step('n3', 'square', 'Login', 200),
      step('n4', 'square', 'Address', 300),
      step('n5', 'square', 'Card details', 400),
      step('n6', 'diamond', '3-D Secure?', 500, 80),
      step('n7', 'square', 'Charge card', 620),
      step('n8', 'stadium', 'Receipt email', 720),
      {
        id: 't1',
        type: 'text',
        label: 'Retry up to 3 times',
        x: 150,
        y: 620,
        width: 160,
        height: 40,
        textSize: 'sm',
      },
      arrow('a1', 'n1', 'n2'),
      arrow('a2', 'n2', 'n3'),
      arrow('a3', 'n3', 'n4'),
      arrow('a4', 'n4', 'n5'),
      arrow('a5', 'n5', 'n6'),
      arrow('a6', 'n6', 'n7', 'yes'),
      arrow('a7', 'n7', 'n8'),
    ],
  };
}

// Deterministic ids for the elements no slug names (EO8): `id-1`, `id-2`, …
export function fixedIds(): () => string {
  let next = 0;
  return () => `id-${++next}`;
}
