// Placements that pair a side with an alignment (docs/specs/024-agents/blueprints/edit-operations.md "Placement"):
// `below:<x> align:<y>` (alignTo). Nothing holds since the layout containers went
// (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 3), so there is no `inside:`.
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
  it('reads a side with align, and refuses an empty alignTo', () => {
    const parsed = parseEditOperations('add signpost align:n4 below:f2');
    expect('operations' in parsed ? parsed.operations[0] : null).toMatchObject({
      place: { rel: 'below', ref: 'f2', alignTo: 'n4' },
    });
    // Two alignments in one placement say two things.
    expect('errors' in parseEditOperations('add signpost align:n4 align:n5 below:f2')).toBe(true);
    expect(placementIssue({ rel: 'below', ref: 'f2', alignTo: '' })).toMatch(
      /"alignTo" a non-empty selector/,
    );
  });

  it('refuses an alignment to nothing or to an arrow', () => {
    expect(refused(run('add signpost below:f2 align:nowhere'))).toBeTruthy();
    const arrowId = checkoutFlow().elements.find((e) => e.type === 'arrow')!.id;
    const outcome = run(`add signpost below:f2 align:${arrowId}`);
    expect(JSON.stringify(refused(outcome))).toMatch(/an arrow; align to a box/);
  });

  it('centres a box placed right of a frame on the box it aligns to, across the side', () => {
    const { tab } = applied(run('add signpost id=x label=X right-of:f2 align:n4'));
    const [x, n4] = [at(tab, 'x'), at(tab, 'n4')];
    expect(x.y + x.height / 2).toBe(n4.y + n4.height / 2);
    expect(x.x).toBeGreaterThan(at(tab, 'f2').x + at(tab, 'f2').width);
  });
});
