// Seeds the bench scenarios into a local api worker as one diagram, a tab per
// scenario, so the same shapes can be tried in the real editor.
//
//   bun bench/arrow-labels/seed.ts <apiBase> <ownerId>
//
// The owner id becomes the guest `X-Owner-Id`; put the same value in the
// browser's `livediagram:v2:self-id` to open the diagram as its owner.

import { SCENARIOS } from './scenarios';

const [apiBase, ownerId] = process.argv.slice(2);
if (!apiBase || !ownerId) {
  console.error('usage: bun bench/arrow-labels/seed.ts <apiBase> <ownerId>');
  process.exit(2);
}

const id = crypto.randomUUID();
const tabs = [
  ...SCENARIOS.map((s) => ({ id: `tab-${s.id}`, name: s.title, elements: s.elements })),
  // An arrow attached to nothing, for the move frame (docs/specs/008-canvas/arrow-bending.md).
  {
    id: 'tab-free',
    name: '11. Free arrow',
    elements: [
      {
        id: 'free',
        type: 'arrow' as const,
        from: { kind: 'free' as const, x: 200, y: 300 },
        to: { kind: 'free' as const, x: 600, y: 300 },
        label: 'drifting',
      },
    ],
  },
];
const res = await fetch(`${apiBase}/diagrams`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-owner-id': ownerId },
  body: JSON.stringify({ id, name: 'Arrow label bench', tabs }),
});
if (!res.ok) {
  console.error(`[seed] create failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}
console.log(id);
