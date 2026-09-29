import { describe, expect, it } from 'vitest';
import type { Tab } from './index';
import { stampTabKind, tabKindOf } from './tab-kind';

const tab = (t: Partial<Tab> = {}): Tab => ({ id: 't', name: 'T', elements: [], ...t }) as Tab;

describe('tabKindOf', () => {
  it('names the ordinary board rather than leaving it an absence', () => {
    expect(tabKindOf(tab())).toBe('diagram');
  });

  it('reads a specialised kind', () => {
    expect(tabKindOf(tab({ kind: 'event-storming' }))).toBe('event-storming');
  });

  it('treats a tab written before the field as an ordinary diagram', () => {
    expect(tabKindOf(tab({ kind: undefined }))).toBe('diagram');
  });
});

describe('stampTabKind', () => {
  it('writes the default kind onto a tab that has none', () => {
    expect(stampTabKind(tab()).kind).toBe('diagram');
  });

  it('leaves a specialised kind alone', () => {
    expect(stampTabKind(tab({ kind: 'event-storming' })).kind).toBe('event-storming');
  });

  it('returns the SAME object when nothing needs stamping', () => {
    // Identity matters: this runs at the editor's commit choke point on
    // every tab of every commit, and a fresh object for an unchanged tab
    // would defeat the memoised element views downstream.
    const already = tab({ kind: 'diagram' });
    expect(stampTabKind(already)).toBe(already);
    const es = tab({ kind: 'event-storming' });
    expect(stampTabKind(es)).toBe(es);
  });

  it('does not otherwise touch the tab', () => {
    const before = tab({ name: 'Cart', theme: 'slate' });
    const after = stampTabKind(before);
    expect({ ...after, kind: undefined }).toEqual({ ...before, kind: undefined });
  });
});

// The stamp is a ONE-WAY write: whatever it puts on a tab is what that tab
// is from then on. So it must resolve the kind the same way a reader does,
// legacy signals included — branding a pre-`kind` event-storming board as an
// ordinary 'diagram' would take its palette, stationery and note menu away
// permanently, and no later load could tell the difference.
describe('stampTabKind — legacy boards', () => {
  it('recognises a pre-kind event-storming board by its layer', () => {
    const legacy = tab({ layers: [{ id: 'layer:es:board', name: 'Event Storming' }] });
    expect(stampTabKind(legacy).kind).toBe('event-storming');
  });

  it('recognises the older stage-layer boards too', () => {
    for (const id of ['layer:es:big-picture', 'layer:es:process', 'layer:es:design']) {
      expect(stampTabKind(tab({ layers: [{ id, name: 'stage' }] })).kind).toBe('event-storming');
    }
  });

  it('still calls an ordinary layered tab a diagram', () => {
    const ordinary = tab({ layers: [{ id: 'layer:template:content', name: 'Cards' }] });
    expect(stampTabKind(ordinary).kind).toBe('diagram');
  });
});
