import { describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/document';
import { applied, lines, refused } from '../fixtures/outcomes';
import { boxIn, elementOf, flowWith, lockedFlow, run } from '../fixtures/run';
import { PLACEMENT_GAP } from '../vocabulary';

describe('insert', () => {
  it("answers the spec's example: the node between, room made, the arrow split", () => {
    const outcome = run(
      'set n3 label="Sign in" shape=stadium\ninsert square id=verify label="Verify email" between n3 n4',
    );
    expect(lines(outcome)).toEqual([
      '~ n3  label "Login"→"Sign in" · shape square→stadium · widened 140→160',
      '+ verify  square "Verify email" @45,300 131×120',
      '~ f2  taller 200→360',
      '~ a3  to n4→verify',
      '+ arrow  verify→n4 (style of a3)',
      '» n4 n5 n6 n7 n8  +0,+160 (make room)',
      'f2  +verify',
    ]);
    const { tab, targets, createdIds } = applied(outcome);
    expect(elementOf(tab, 'arrow')).toMatchObject({
      from: { kind: 'pinned', elementId: 'verify', anchor: 's' },
      to: { kind: 'pinned', elementId: 'n4', anchor: 'n' },
    });
    expect(targets).toEqual(['n3', 'n4', 'a3']);
    expect(createdIds).toEqual(['verify', 'arrow']);
  });

  it('copies the style of the arrow it splits, never its label or route', () => {
    const styled = flowWith((el) =>
      el.id === 'a6'
        ? ({
            ...el,
            strokeColor: '#ff0000',
            arrowStyle: 'curved',
            curveOffset: { dx: 9, dy: 0 },
          } as Element)
        : el,
    );
    const tab = applied(run('insert square between n6 n7', styled)).tab;
    const copy = elementOf(tab, 'arrow');
    expect(copy).toMatchObject({ strokeColor: '#ff0000', arrowStyle: 'curved' });
    expect(copy).not.toHaveProperty('label');
    expect(copy).not.toHaveProperty('curveOffset');
    expect(elementOf(tab, 'a6')).toMatchObject({ label: 'yes', strokeColor: '#ff0000' });
    expect(elementOf(tab, 'a6')).not.toHaveProperty('curveOffset');
  });

  it('keeps the gap there was, or PLACEMENT_GAP when the boxes nearly touch', () => {
    // n1 ends at 60 and n2 starts at 100: a gap of 40.
    expect(boxIn(applied(run('insert square between n1 n2')).tab, 'square')[1]).toBe(100);
    const touching = flowWith((el) => (el.id === 'n2' ? ({ ...el, y: 70 } as Element) : el));
    expect(boxIn(applied(run('insert square between n1 n2', touching)).tab, 'square')[1]).toBe(
      60 + PLACEMENT_GAP,
    );
  });

  it('runs along the horizontal axis, and backwards', () => {
    const row = flowWith((el) => (el.id === 'n8' ? ({ ...el, x: 400, y: 620 } as Element) : el));
    const tab = applied(run('connect n8 -> n7\ninsert square between n8 n7', row)).tab;
    const [x, y, width] = boxIn(tab, 'square');
    expect(y).toBe(620 + 30 - 60);
    // n7 ends at 140, n8 starts at 400: the node's right edge sits the gap left of n8.
    expect(x + width).toBe(400 - 260);
  });

  it('reads boxes on one centre as flowing down (E7)', () => {
    const stacked = flowWith((el) => (el.id === 'n2' ? ({ ...el, y: 0 } as Element) : el));
    const [, y] = boxIn(applied(run('insert square between n1 n2', stacked)).tab, 'square');
    expect(y).toBe(60 + PLACEMENT_GAP);
  });

  it('refuses ends with no arrow between, naming the arrows touching them', () => {
    expect(refused(run('insert square between n1 n4'))).toMatchObject({
      code: 'not_connected',
      details: [
        'no arrow n1→n4',
        'arrows touching them:',
        '  a1  arrow n1→n2',
        '  a3  arrow n3→n4',
        '  a4  arrow n4→n5',
      ],
      hint: 'connect n1 -> n4 first, or insert between the ends of one of these',
    });
    expect(refused(run('insert square between n1 t1')).details).toEqual([
      'no arrow n1→t1',
      'arrows touching them:',
      '  a1  arrow n1→n2',
    ]);
    expect(refused(run('insert square between t1 n1')).details).toEqual([
      'no arrow t1→n1',
      'arrows touching them:',
      '  a1  arrow n1→n2',
    ]);
    const lonely = flowWith((el) => el);
    lonely.elements.push({
      id: 'z',
      type: 'text',
      label: 'z',
      x: 900,
      y: 0,
      width: 40,
      height: 20,
    } as Element);
    expect(refused(run('insert square between z t1', lonely)).details).toEqual(['no arrow z→t1']);
  });

  it('refuses several a→b arrows as ambiguous', () => {
    expect(refused(run('connect n3 -> n4 again\ninsert square between n3 n4'))).toMatchObject({
      code: 'target_ambiguous',
      hint: 'rewire one of them by its ref instead',
    });
  });

  it('refuses a locked arrow, an unknown kind, and an end that is not a box', () => {
    expect(refused(run('insert square between n3 n4', lockedFlow('a3'))).code).toBe(
      'element_locked',
    );
    expect(refused(run('insert arrow between n3 n4')).code).toBe('invalid_value');
    expect(refused(run('insert square between a1 n4')).code).toBe('invalid_value');
    expect(refused(run('insert square between n3 a1')).code).toBe('invalid_value');
  });

  it('refuses a node whose layer is locked', () => {
    const tab = {
      ...flowWith((el) => el),
      layers: [
        { id: 'base', name: 'Base' },
        { id: 'top', name: 'Top', locked: true },
      ],
    };
    expect(refused(run('insert square layerId=top between n3 n4', tab))).toMatchObject({
      code: 'element_locked',
    });
  });
});
