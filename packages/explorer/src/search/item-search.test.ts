// What an editor's Search panel takes to find work in every app (Work Tracker #63).
import { describe, expect, it } from 'vitest';
import { makeItem } from '../test/fakeClient';
import { appLabel, EVERY_APP_MAX, everyAppResults } from './item-search';

describe('everyAppResults', () => {
  it('leaves out what the panel lists itself and anything trashed, in the index’s order, at most the cap', () => {
    const items = [
      makeItem(1),
      makeItem(2, { app: 'livediagram', kind: 'canvas' }),
      makeItem(3, { trashedAt: 5 }),
      makeItem(4, { app: 'livedesign', kind: 'design' }),
    ];
    expect(everyAppResults(items, new Set(['item-1'])).map((i) => i.id)).toEqual([
      'item-2',
      'item-4',
    ]);
    const many = Array.from({ length: 20 }, (_, k) => makeItem(k + 1));
    expect(everyAppResults(many, new Set())).toHaveLength(EVERY_APP_MAX);
    expect(everyAppResults(many, new Set(), 3).map((i) => i.id)).toEqual([
      'item-1',
      'item-2',
      'item-3',
    ]);
  });
});

describe('appLabel', () => {
  it('names the app with its colours, the deep one for a light ground', () => {
    const label = appLabel('liveplanner');
    expect(label.name).toBe('liveplanner');
    expect(label.accent).toMatch(/^#/);
    expect(label.deep).toMatch(/^#/);
    expect(label.deep).not.toBe(label.accent);
  });
});
