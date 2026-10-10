import { describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/document';
import { applied, lines, refused } from '../fixtures/outcomes';
import { elementOf, flowWith, lockedFlow, run } from '../fixtures/run';

describe('connect', () => {
  it('draws a pinned arrow, anchors facing, after the later of its ends', () => {
    const outcome = run('connect n3 -> n7 label=retry');
    const { tab, createdIds } = applied(outcome);
    expect(lines(outcome)).toEqual(['+ retry  n3→n7 "retry"']);
    expect(elementOf(tab, 'retry')).toMatchObject({
      from: { kind: 'pinned', elementId: 'n3', anchor: 's' },
      to: { kind: 'pinned', elementId: 'n7', anchor: 'n' },
    });
    expect(createdIds).toEqual(['retry']);
    const ids = tab.elements.map((el) => el.id);
    expect(ids.indexOf('retry')).toBe(ids.indexOf('n7') + 1);
  });

  it('mints an arrow id from the kind word, and takes a given id', () => {
    expect(lines(run('connect n7 -> n3'))).toEqual(['+ arrow  n7→n3']);
    expect(lines(run('connect n1 -> n8 id=skip'))).toEqual(['+ skip  n1→n8']);
  });

  it('refuses a second arrow a→b without again, and draws it with again', () => {
    expect(refused(run('connect n3 -> n4'))).toMatchObject({
      code: 'arrow_exists',
      details: ['n3→n4 already has an arrow:', '  a3  arrow n3→n4'],
    });
    expect(lines(run('connect n3 -> n4 again'))).toEqual(['+ arrow  n3→n4']);
  });

  it('counts only an arrow the same way round', () => {
    expect(lines(run('connect n4 -> n3'))).toEqual(['+ arrow  n4→n3']);
  });

  it('joins two different boxes, never an arrow', () => {
    expect(refused(run('connect n3 -> n3')).details).toEqual([
      'n3 -> n3: an arrow joins two different boxes',
    ]);
    expect(refused(run('connect a1 -> n3')).details).toEqual([
      'a1: a1 is an arrow; arrows connect boxes',
    ]);
    expect(refused(run('connect n3 -> a1')).code).toBe('invalid_value');
    expect(refused(run('connect n3 -> nowhere')).code).toBe('target_not_found');
    expect(refused(run('connect nowhere -> n3')).code).toBe('target_not_found');
  });

  it('refuses a field the arrow lacks, and an id taken', () => {
    expect(refused(run('connect n1 -> n8 shape=square')).code).toBe('unknown_field');
    expect(refused(run('connect n1 -> n8 id=n2')).code).toBe('id_taken');
  });

  it("goes on its first end's layer", () => {
    const tab = {
      ...flowWith((el) => (el.id === 'n1' ? { ...el, layerId: 'top' } : el)),
      layers: [
        { id: 'base', name: 'Base' },
        { id: 'top', name: 'Top' },
      ],
    };
    expect(elementOf(applied(run('connect n1 -> n8', tab)).tab, 'arrow')).toMatchObject({
      layerId: 'top',
    });
  });
});

describe('rewire', () => {
  it('moves one end, re-anchors both facing, and drops the route', () => {
    const curved = flowWith((el) =>
      el.id === 'a6'
        ? { ...el, curveOffset: { dx: 40, dy: 0 }, elbowOffset: { dx: 3, dy: 0 } }
        : el,
    );
    const outcome = run('rewire a6 to=t1', curved);
    expect(lines(outcome)).toEqual([
      '~ a6  to n7→t1 · curveOffset (changed) · elbowOffset (changed)',
    ]);
    const a6 = elementOf(applied(outcome).tab, 'a6');
    expect(a6).toMatchObject({
      from: { elementId: 'n6', anchor: 's' },
      to: { elementId: 't1', anchor: 'n' },
    });
    expect(a6).not.toHaveProperty('curveOffset');
    expect(a6).not.toHaveProperty('elbowOffset');
  });

  it('moves the from end', () => {
    expect(lines(run('rewire a1 from=n3'))).toEqual(['~ a1  from n1→n3']);
  });

  it('keeps a free other end as it is', () => {
    const loose = flowWith((el) =>
      el.id === 'a1' ? ({ ...el, from: { kind: 'free', x: 300, y: 230 } } as Element) : el,
    );
    const a1 = elementOf(applied(run('rewire a1 to=n3', loose)).tab, 'a1');
    expect(a1).toMatchObject({
      from: { kind: 'free', x: 300, y: 230 },
      to: { elementId: 'n3', anchor: 'e' },
    });
  });

  it('keeps a free to end as it is when only the from end moves', () => {
    const loose = flowWith((el) =>
      el.id === 'a1' ? ({ ...el, to: { kind: 'free', x: 300, y: 230 } } as Element) : el,
    );
    const a1 = elementOf(applied(run('rewire a1 from=n3', loose)).tab, 'a1');
    expect(a1).toMatchObject({
      from: { kind: 'pinned', elementId: 'n3' },
      to: { kind: 'free', x: 300, y: 230 },
    });
  });

  it('keeps an end pinned to a box that is gone as it is', () => {
    const dangling = flowWith((el) =>
      el.id === 'a1'
        ? ({ ...el, from: { kind: 'pinned', elementId: 'gone', anchor: 'e' } } as Element)
        : el,
    );
    const a1 = elementOf(applied(run('rewire a1 to=n3', dangling)).tab, 'a1');
    expect(a1).toMatchObject({
      from: { kind: 'pinned', elementId: 'gone', anchor: 'e' },
      to: { kind: 'pinned', elementId: 'n3' },
    });
  });

  it('rewires only an arrow, onto a box, unlocked', () => {
    expect(refused(run('rewire n3 to=n4')).details).toEqual(['n3: n3 is not an arrow']);
    expect(refused(run('rewire a1 to=a2')).code).toBe('invalid_value');
    expect(refused(run('rewire nowhere to=n4')).code).toBe('target_not_found');
    expect(refused(run('rewire a1 from=nowhere')).code).toBe('target_not_found');
    expect(refused(run('rewire a1 from=a2')).details).toEqual([
      'a2: a2 is an arrow; arrows connect boxes',
    ]);
    expect(refused(run('rewire a1 to=n4', lockedFlow('a1'))).code).toBe('element_locked');
  });

  it('refuses a rewire that would join an arrow to the box at its other end, as connect does', () => {
    expect(refused(run('rewire a1 to=n1')).details).toEqual([
      'a1 to=n1: an arrow joins two different boxes',
    ]);
    expect(refused(run('rewire a1 from=n2')).code).toBe('invalid_value');
  });

  it('moves both ends in one operation, so a reversal never passes through a self-loop', () => {
    const { tab } = applied(run('rewire a1 from=n2 to=n1'));
    const arrow = tab.elements.find((el) => el.id === 'a1');
    expect(arrow).toMatchObject({
      from: { kind: 'pinned', elementId: 'n2' },
      to: { kind: 'pinned', elementId: 'n1' },
    });
    expect(refused(run('rewire a1 from=n3 to=n3')).details).toEqual([
      'a1 from=n3 to=n3: an arrow joins two different boxes',
    ]);
  });
});
