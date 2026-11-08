import { describe, expect, it } from 'vitest';
import type { Element, Tab } from '@livehuddle/document';
import { arrowBetween, shapeAt } from './__fixtures__/build';
import { buildViewModel } from './model';

describe('buildViewModel', () => {
  const tab: Tab = {
    id: '0b3481f3-59fb-4bd0-a21a-152f1ba9bba5',
    name: 'Checkout',
    elements: [
      shapeAt('square', 'a', 0, 0),
      shapeAt('square', 'h', 0, 0),
      { id: 'u', type: 'hologram' } as unknown as Element,
      arrowBetween('ah', 'a', 'h'),
      { ...arrowBetween('loose', 'a', 'a'), to: { kind: 'free', x: 0, y: 0 } },
    ],
  };

  it('counts printed and unknown elements and carries the revision', () => {
    const model = buildViewModel(tab, { rev: 7 });
    expect(model.facts).toMatchObject({
      tab: { ref: '0b34', name: 'Checkout', kind: 'diagram' },
      elements: 5,
      // The hologram and both stored arrows (retired elements since part 4 of the element engine).
      unknown: 3,
      rev: 7,
    });
    expect(model.kindOf(model.printed[2]!)).toBe('? hologram');
    expect(model.kindOf(model.printed[3]!)).toBe('? arrow');
  });

  it('refs every element (VW2)', () => {
    const model = buildViewModel(tab);
    expect(model.refs.refOf('h')).toBe('h');
    expect(model.facts.rev).toBeNull();
  });

  it("makes the tab ref unique among the document's tabs (VW4)", () => {
    const sibling = '0b34ffff-0000-4000-8000-000000000000';
    const model = buildViewModel(tab, { tabIds: [tab.id, sibling] });
    expect(model.facts.tab.ref).toBe('0b348');
    expect(model.tabRefOf(sibling)).toBe('0b34f');
    expect(model.tabRefOf('51c9abcd-0000')).toBe('51c9');
  });

  it('ignores tab ids that leave this tab out', () => {
    const model = buildViewModel(tab, { tabIds: ['other'] });
    expect(model.facts.tab.ref).toBe('0b34');
  });

  it('carries the finish only when one is set', () => {
    expect(buildViewModel(tab).facts).not.toHaveProperty('finish');
    expect(buildViewModel({ ...tab, finish: 'sketch' }).facts.finish).toBe('sketch');
  });
});
