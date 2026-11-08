import { describe, expect, it } from 'vitest';
import type { Element, Tab } from '@livehuddle/document';
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
  it('moves by an offset, printing the position change', () => {
    const outcome = run('move n4 by=400,0');
    expect(at(applied(outcome).tab, 'n4')).toEqual([400, 300]);
    expect(lines(outcome)).toEqual(['~ n4  @40,300→@440,300']);
  });

  it("places the targets' bounding box as one box", () => {
    const outcome = run('move n1 right-of:n8');
    expect(at(applied(outcome).tab, 'n1')).toEqual([140 + PLACEMENT_GAP, 720]);
  });

  it("keeps clear of what sits outside the reference's frame, which a move never grows", () => {
    const blocker = {
      id: 'b',
      type: 'shape',
      shape: 'square',
      x: 200,
      y: 300,
      width: 140,
      height: 60,
    };
    const tab = { ...checkoutFlow(), elements: [...checkoutFlow().elements, blocker as Element] };
    const [x, y] = at(applied(run('move n1 right-of:n4', tab)).tab, 'n1');
    const clear = x! >= 340 || x! + 140 <= 200 || y! >= 360 || y! + 60 <= 300;
    expect(clear).toBe(true);
  });

  // docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 3: f2 is a stored boundary that
  // holds nothing, so moving it moves it alone: what sat on it, boxes and loose arrows, stays where it was.
  it('moves a stored boundary alone, carrying nothing', () => {
    const loose = {
      id: 'loose',
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 300 },
      to: { kind: 'free', x: 60, y: 300 },
    } as Element;
    const tab = { ...checkoutFlow(), elements: [...checkoutFlow().elements, loose] };
    const outcome = run('move f2 by=500,0', tab);
    const { tab: next, targets } = applied(outcome);
    expect(at(next, 'n5')).toEqual([0, 400]);
    expect(next.elements.find((e) => e.id === 'loose')).toEqual(loose);
    expect(targets).toEqual(['f2']);
    expect(lines(outcome)).toEqual(['~ f2  @0,280→@500,280']);
  });

  it('moves an arrow with one pinned end by its free end alone', () => {
    const half = {
      id: 'half',
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 900 },
      to: { kind: 'pinned', elementId: 'n8', anchor: 'n' },
    } as Element;
    const tab = { ...checkoutFlow(), elements: [...checkoutFlow().elements, half] };
    const moved = applied(run('move half by=10,0', tab)).tab.elements.find((e) => e.id === 'half');
    expect(moved).toMatchObject({
      from: { kind: 'free', x: 10, y: 900 },
      to: { kind: 'pinned', elementId: 'n8' },
    });
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

  it('refuses a reference that moves with it', () => {
    expect(refused(run('move type:square below:n4 all'))).toMatchObject({
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

  it('prints a moved element an operation also changed as one ~ line', () => {
    expect(lines(run('set n4 label=Shipping\nmove n4 by=10,0'))).toEqual([
      '~ n4  label "Address"→"Shipping" · @40,300→@50,300',
    ]);
  });
});
