import { describe, expect, it } from 'vitest';
import { applyElementDelta } from './element-deltas';
import { computeRefs, isSlugId, resolveRef, slugIdFor } from './element-refs';
import { createPinnedArrow, createShape } from './factories';
import type { Element } from './index';
import { isValidTab } from './validate';

// Element ids are opaque strings (docs/specs/024-agents/blueprints/document-views.md "Slug ids"): a tab
// whose elements carry the slug ids an agent's writes mint stores, validates and takes deltas like any.
describe('slug ids round trip (R7)', () => {
  const taken = new Set<string>();
  const mint = (label: string, kind: string) => {
    const id = slugIdFor(label, kind, taken);
    taken.add(id);
    return id;
  };
  const cache = {
    ...createShape('cylinder', 0, 0),
    id: mint('Redis cache', 'cylinder'),
    label: 'Redis cache',
  };
  const twin = {
    ...createShape('cylinder', 200, 0),
    id: mint('Redis cache', 'cylinder'),
    label: 'Redis cache',
  };
  const list: Element = {
    ...createShape('checklist', 0, 200),
    id: mint('Launch checklist', 'checklist'),
    checklistItems: [{ text: 'Ship', done: false }],
  };
  const arrow = { ...createPinnedArrow(cache.id, 'e', twin.id, 'w'), id: mint('', 'arrow') };
  const tab = { id: 'tab-1', name: 'Agent built', elements: [cache, twin, list, arrow] };

  it('mints slug ids, -2 on a clash, arrow for an unlabelled arrow', () => {
    expect(tab.elements.map((el) => el.id)).toEqual([
      'redis-cache',
      'redis-cache-2',
      'launch-checklist',
      'arrow',
    ]);
    expect(tab.elements.every((el) => isSlugId(el.id))).toBe(true);
  });

  it('passes isValidTab', () => {
    expect(isValidTab(tab)).toBe(true);
  });

  it('takes an element delta and keeps the id', () => {
    const ticked = applyElementDelta(list, { kind: 'check', index: 0, text: 'Ship', done: true });
    expect(ticked.id).toBe('launch-checklist');
    expect(ticked).not.toBe(list);
  });

  it('prints every slug as its own ref and resolves it back', () => {
    const refs = computeRefs(tab.elements.map((el) => el.id));
    for (const el of tab.elements) {
      expect(refs.refOf(el.id)).toBe(el.id);
      expect(resolveRef(el.id, refs)).toEqual({ kind: 'found', id: el.id });
    }
  });
});
