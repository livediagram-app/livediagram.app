import { describe, expect, it } from 'vitest';
import { createShape, type Element, type Tab } from '@liveplanner/document';
import {
  labelled,
  patchActiveElements,
  touchesPinned,
  type GrowthHookOpts,
} from './useGrowthLanding';

const shape = { ...createShape('mind-node', 0, 0), id: 'a', label: 'Old' } as Element;
const arrow = (from: string, to: string) =>
  ({
    id: `${from}-${to}`,
    type: 'arrow',
    from: { kind: 'pinned', elementId: from },
    to: { kind: 'pinned', elementId: to },
  }) as unknown as Element;

function commitWith(participating: boolean) {
  let tabs = [
    { id: 't', name: 'Map', elements: [shape] },
    { id: 'u', name: 'Other', elements: [] },
  ] as unknown as Tab[];
  const opts = {
    activeId: 't',
    participating,
    commitTabs: (update: (tabs: Tab[]) => Tab[]) => {
      tabs = update(tabs);
    },
  } as unknown as GrowthHookOpts;
  patchActiveElements(opts, (els) => els.filter((e) => e.id !== 'a'));
  return tabs;
}

describe('growth shared helpers', () => {
  it('writes a plain label, dropping formatted runs', () => {
    const rich = { ...shape, richText: [{ text: 'Old' }] } as unknown as Element;
    expect(labelled(rich, 'New')).toMatchObject({ label: 'New', richText: undefined });
  });

  it('finds the arrows pinned at either end of an element, and only those', () => {
    expect(touchesPinned(arrow('a', 'b'), 'a')).toBe(true);
    expect(touchesPinned(arrow('b', 'a'), 'a')).toBe(true);
    expect(touchesPinned(arrow('b', 'c'), 'a')).toBe(false);
    expect(touchesPinned(shape, 'a')).toBe(false);
  });

  it('patches only the active tab, marking its template chosen unless a Participant grew it', () => {
    const editor = commitWith(false);
    expect(editor[0]).toMatchObject({ elements: [], templateChosen: true });
    expect(editor[1]).not.toHaveProperty('templateChosen');
    expect(commitWith(true)[0]).not.toHaveProperty('templateChosen');
  });
});
