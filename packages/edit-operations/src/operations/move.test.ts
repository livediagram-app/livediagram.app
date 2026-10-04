import { describe, expect, it } from 'vitest';
import type { Element, Tab } from '@livediagram/document';
import { applyEditOperations } from '../apply';
import { checkoutFlow, fixedIds } from '../fixtures/checkout-flow';
import { applied, lines, refused } from '../fixtures/outcomes';
import { parseEditOperations } from '../parse';
import { PLACEMENT_GAP } from '../vocabulary';

const run = (text: string, tab: Tab = checkoutFlow()) => {
  const parsed = parseEditOperations(text);
  if ('errors' in parsed) throw new Error(parsed.errors[0]!.details.join('\n'));
  return applyEditOperations(tab, parsed.operations, { makeId: fixedIds() });
};
const at = (tab: Tab, id: string) => {
  const el = tab.elements.find((e) => e.id === id) as Element & { x: number; y: number };
  return [el.x, el.y];
};

describe('move', () => {
  it('moves by an offset, printing the position change and the membership change', () => {
    const outcome = run('move n4 by=400,0');
    expect(at(applied(outcome).tab, 'n4')).toEqual([400, 300]);
    expect(lines(outcome)).toEqual(['~ n4  @40,300→@440,300', 'f2  -n4']);
  });

  it("places the targets' bounding box as one box", () => {
    const outcome = run('move n1 right-of:n8');
    expect(at(applied(outcome).tab, 'n1')).toEqual([140 + PLACEMENT_GAP, 720]);
  });

  it('carries what a moved frame holds, as » lines', () => {
    const outcome = run('move f2 by=500,0');
    const { tab, targets } = applied(outcome);
    expect(at(tab, 'n5')).toEqual([500, 400]);
    expect(targets).toEqual(['f2']);
    expect(lines(outcome)).toEqual(['~ f2  @0,280→@500,280', '» n4 n5  +500,+0 (carried)']);
  });

  it('carries a loose arrow by its free ends', () => {
    const loose = {
      id: 'loose',
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 300 },
      to: { kind: 'free', x: 60, y: 300 },
    } as Element;
    const tab = { ...checkoutFlow(), elements: [...checkoutFlow().elements, loose] };
    const moved = applied(run('move f2 by=10,0', tab)).tab.elements.find((e) => e.id === 'loose');
    expect(moved).toMatchObject({ from: { x: 10 }, to: { x: 70 } });
  });

  it('moves several with all, and nothing for a zero move (E4)', () => {
    expect(lines(run('move type:stadium by=0,10 all'))).toEqual([
      '~ n1  @40,0→@40,10',
      '~ n8  @40,720→@40,730',
    ]);
    expect(lines(run('move n3 by=0,0'))).toEqual([]);
  });

  it('moves a free arrow by an offset, and refuses to place one', () => {
    const loose = {
      id: 'loose',
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 900 },
      to: { kind: 'free', x: 60, y: 900 },
    } as Element;
    const tab = { ...checkoutFlow(), elements: [...checkoutFlow().elements, loose] };
    expect(lines(run('move loose by=5,5', tab))).toEqual([
      '~ loose  from @40,900→@45,905 · to @100,900→@105,905',
    ]);
    expect(refused(run('move loose below:n8', tab)).details).toEqual([
      'loose: arrows move with their ends; use by=dx,dy for a free arrow',
    ]);
  });

  it('refuses a lock anywhere in the moving set, and a reference that moves with it', () => {
    const lockedN5 = {
      ...checkoutFlow(),
      elements: checkoutFlow().elements.map((el) =>
        el.id === 'n5' ? { ...el, locked: true } : el,
      ),
    };
    expect(refused(run('move f2 by=10,0', lockedN5))).toMatchObject({ code: 'element_locked' });
    expect(refused(run('move f2 below:n4'))).toMatchObject({
      code: 'invalid_value',
      details: ['below:n4: n4 moves with it'],
    });
    expect(refused(run('move nope by=1,1')).code).toBe('target_not_found');
  });
});

describe('move and its lines', () => {
  it('prints nothing for what moved and moved back', () => {
    expect(lines(run('move f2 by=10,0\nmove f2 by=-10,0'))).toEqual([]);
  });

  it('prints a carried element an operation also changed as a ~ line', () => {
    expect(lines(run('set n4 label=Shipping\nmove f2 by=10,0'))).toEqual([
      '~ n4  label "Address"→"Shipping" · @40,300→@50,300',
      '~ f2  @0,280→@10,280',
      '» n5  +10,+0 (carried)',
    ]);
  });

  it('carries an arrow with one free end inside, its pinned end following its element', () => {
    const half = {
      id: 'half',
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 300 },
      to: { kind: 'pinned', elementId: 'n8', anchor: 'n' },
    } as Element;
    const tab = { ...checkoutFlow(), elements: [...checkoutFlow().elements, half] };
    const moved = applied(run('move f2 by=10,0', tab)).tab.elements.find((e) => e.id === 'half');
    expect(moved).toMatchObject({
      from: { kind: 'free', x: 10 },
      to: { kind: 'pinned', elementId: 'n8' },
    });
  });
});
