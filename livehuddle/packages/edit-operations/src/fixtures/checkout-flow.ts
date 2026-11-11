// The research's checkout flow (docs/research/agent-cli/editing-models.md §6): one tab, eight steps
// down a column (the diagram shapes it was drawn in are retired since part 5) with the stored arrows that once joined them (retired elements since part 4), a note beside the payment, and a stored boundary `f2` behind the
// address and card steps: a retired kind (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine",
// part 3), kept as a placeholder that holds nothing. Every suite starts from a fresh copy.

import type { Element, RetiredArrowElement, ShapeKind, Tab } from '@livehuddle/document';

// The steps were diagram shapes, retired in part 5 of the element engine: they are kept Space pieces here (signposts,
// room signs at the ends and a directory for the question), so the selectors still have shapes to tell apart.
const step = (
  id: string,
  label: string,
  y: number,
  height = 60,
  shape: ShapeKind = 'signpost',
): Element => ({
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

// A stored arrow (a retired element, docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 4).
const arrow = (id: string, from: string, to: string, label?: string): RetiredArrowElement => ({
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
        shape: 'boundary' as ShapeKind,
        label: 'Payment',
        x: -40,
        y: 280,
        width: 220,
        height: 200,
      },
      step('n1', 'Start', 0, 60, 'room-sign'),
      step('n2', 'Cart', 100),
      step('n3', 'Login', 200),
      step('n4', 'Address', 300),
      step('n5', 'Card details', 400),
      step('n6', '3-D Secure?', 500, 80, 'directory'),
      step('n7', 'Charge card', 620),
      step('n8', 'Receipt email', 720, 60, 'room-sign'),
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
