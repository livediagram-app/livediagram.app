// Placements that pair a side with a group or an alignment (docs/specs/024-agents/blueprints/edit-operations.md
// "Placement"): `inside:<g> right-of:<x>` (within), `below:<x> align:<y>` (alignTo) and `inside:<g> align:<y>`.
import { describe, expect, it } from 'vitest';
import type { Element, Tab } from '@livehuddle/document';
import { checkoutFlow } from '../fixtures/checkout-flow';
import { applied, refused } from '../fixtures/outcomes';
import { run } from '../fixtures/run';
import { parseEditOperations } from '../parse';
import { placementIssue } from '../parse-json';

type Box = Element & { x: number; y: number; width: number; height: number };
const at = (tab: Tab, id: string) => tab.elements.find((e) => e.id === id) as Box;

describe('placement combinations', () => {
  it('reads inside with align as an alignment within the group, and refuses an empty alignTo', () => {
    const parsed = parseEditOperations('add square inside:f2 align:n4');
    expect('operations' in parsed ? parsed.operations[0] : null).toMatchObject({
      place: { rel: 'align', ref: 'n4', within: 'f2' },
    });
    // Two alignments in one placement say two things.
    expect('errors' in parseEditOperations('add square align:n4 align:n5 below:f2')).toBe(true);
    expect(placementIssue({ rel: 'below', ref: 'f2', alignTo: '' })).toMatch(
      /"alignTo" a non-empty selector/,
    );
  });

  it('refuses a group that names nothing, and an alignment to nothing or to an arrow', () => {
    expect(refused(run('add square inside:nowhere right-of:n4'))).toBeTruthy();
    expect(refused(run('add square below:f2 align:nowhere'))).toBeTruthy();
    const arrowId = checkoutFlow().elements.find((e) => e.type === 'arrow')!.id;
    const outcome = run(`add square below:f2 align:${arrowId}`);
    expect(JSON.stringify(refused(outcome))).toMatch(/an arrow; align to a box/);
  });

  it('places beside a member of a group nested in the one named', () => {
    const tab = checkoutFlow();
    const outer: Element = {
      id: 'outer',
      type: 'shape',
      shape: 'frame',
      label: 'Checkout',
      x: -80,
      y: 240,
      width: 600,
      height: 300,
    };
    const nested = { ...tab, elements: [outer, ...tab.elements] };
    const { tab: out } = applied(run('add square id=x label=X inside:outer right-of:n4', nested));
    expect(at(out, 'x').x).toBeGreaterThan(at(out, 'n4').x);
  });

  it('centres a box placed right of a frame on the box it aligns to, across the side', () => {
    const { tab } = applied(run('add square id=x label=X right-of:f2 align:n4'));
    const [x, n4] = [at(tab, 'x'), at(tab, 'n4')];
    expect(x.y + x.height / 2).toBe(n4.y + n4.height / 2);
    expect(x.x).toBeGreaterThan(at(tab, 'f2').x + at(tab, 'f2').width);
  });
});
