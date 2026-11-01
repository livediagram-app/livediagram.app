import { describe, expect, it } from 'vitest';
import { applyComponentPatch, diffComponent } from './component-patch';
import {
  clampComponentName,
  componentRefIds,
  componentRefIdsFromData,
  isInstance,
  libraryLookup,
  libraryOf,
  mayGoInComponent,
  nextComponentName,
  placeableComponents,
} from './components';
import { box, instanceOf, navMain } from './components.test.fixtures';
import type { Element } from './index';

describe('applyComponentPatch', () => {
  it('removes, upserts, appends, reorders, renames and archives', () => {
    const main = navMain();
    const next = applyComponentPatch(
      main,
      {
        remove: ['icon'],
        upsert: [box('bar', 0, 0, 10, 10), box('new', 1, 1)],
        order: ['new', 'brand'],
        name: '  Top   bar ',
        archived: true,
      },
      7,
    );
    expect(next.elements.map((e) => e.id)).toEqual(['new', 'brand', 'bar']);
    expect(next.elements.find((e) => e.id === 'bar')).toMatchObject({ width: 10 });
    expect(next).toMatchObject({ name: 'Top bar', archived: true, updatedAt: 7 });
    expect(applyComponentPatch(next, { archived: false, name: '   ' }, 8)).not.toHaveProperty(
      'archived',
    );
    expect(applyComponentPatch(next, { name: '   ' }, 8).name).toBe('Top bar');
    expect(applyComponentPatch(main, {}, 2).elements).toBe(main.elements);
  });

  it('merges two patches to different elements of one main', () => {
    const main = navMain();
    const a = applyComponentPatch(
      main,
      { upsert: [{ ...main.elements[0]!, fillColor: '#f00' } as Element] },
      2,
    );
    const b = applyComponentPatch(a, { upsert: [{ ...main.elements[1]!, label: 'B' }] }, 3);
    expect(b.elements[0]).toMatchObject({ fillColor: '#f00' });
    expect(b.elements[1]).toMatchObject({ label: 'B' });
  });
});

describe('diffComponent', () => {
  it('is null for the same main, and round-trips through apply', () => {
    const main = navMain();
    expect(diffComponent(main, { ...main })).toBeNull();
    const after = {
      ...main,
      name: 'X',
      archived: true,
      elements: [
        box('new', 0, 0),
        main.elements[2]!,
        { ...main.elements[0]!, fillColor: '#abc' } as Element,
      ],
    };
    const patch = diffComponent(main, after)!;
    expect(patch.remove).toEqual(['brand']);
    expect(patch.upsert!.map((e) => e.id)).toEqual(['new', 'bar']);
    expect(patch.order).toEqual(['new', 'icon', 'bar']);
    expect(applyComponentPatch(main, patch, 1).elements).toEqual(after.elements);
  });

  it('orders without other changes', () => {
    const main = navMain();
    const flipped = { ...main, elements: [...main.elements].reverse() };
    expect(diffComponent(main, flipped)).toEqual({ order: ['icon', 'brand', 'bar'] });
  });
});

describe('the vocabulary', () => {
  it('names, refs, lookups and the band', () => {
    expect(clampComponentName(` a  b ${'x'.repeat(80)}`)).toHaveLength(60);
    const lib = [
      navMain({ name: 'Component 2' }),
      navMain({ id: 'c2', name: 'B', updatedAt: 9, archived: true }),
    ];
    expect(nextComponentName(lib)).toBe('Component 3');
    expect(nextComponentName([navMain({ name: 'Component 2' })])).toBe('Component 3');
    const map = libraryOf(lib);
    expect(libraryLookup(map)('c2')!.name).toBe('B');
    expect(libraryLookup(null)('c2')).toBeUndefined();
    expect(placeableComponents(map.values()).map((c) => c.id)).toEqual(['cmp1']);
    const els: Element[] = [
      instanceOf(navMain()),
      instanceOf(navMain(), { id: 'i2' }),
      box('a', 0, 0),
    ];
    expect(componentRefIds(els)).toEqual(['cmp1']);
    expect(componentRefIdsFromData(JSON.stringify({ elements: els }))).toEqual(['cmp1']);
    expect(componentRefIdsFromData('{"componentId": nope')).toEqual([]);
    expect(componentRefIdsFromData('{"componentId":1}')).toEqual([]);
    expect(componentRefIdsFromData('{}')).toEqual([]);
    expect(isInstance(undefined)).toBe(false);
    expect(mayGoInComponent({ id: 'v', type: 'video', x: 0, y: 0, width: 1, height: 1 })).toBe(
      false,
    );
    expect(mayGoInComponent(box('t', 0, 0, 1, 1, { shape: 'tab-window' }))).toBe(false);
    expect(mayGoInComponent(box('t', 0, 0))).toBe(true);
  });
});
